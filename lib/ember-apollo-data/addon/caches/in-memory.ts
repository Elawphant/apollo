import { tracked } from 'tracked-built-ins';
import { Pod } from '../model';
import { assert } from '@ember/debug';
import { getOwner } from '@ember/owner';
import type { PodRegistry } from '../model/registry';
import { dasherize } from '@ember/string';
import type { RequestDocument, Variables } from 'graphql-request';
import type { RootRef, GraphQlErrorData, TStemData, TPodData, ClientId } from '../model/types';
import { TirService } from 'ember-apollo-data/';
import { ERROR_MESSAGE_PREFIX } from 'ember-apollo-data/-private/globals';
import { parse, type ParseOptions, visit, type OperationDefinitionNode, type FieldNode } from 'graphql';
import { ConnectionRoot } from './connection-root';
import type { AttrField, RelationshipField } from '../model/field-mappings';
import { getObjectAtPath } from '../model/utils';
import { TirCache } from './cache';
import type { FieldProcessor } from 'ember-apollo-data/field-processor';
import { DefaultFieldProcessors } from 'ember-apollo-data/field-processors';
import { ScalarRoot } from './scalar-root';
import { NodeRoot } from './node-root';


// ATTENTION!!!
// For internal store must use the dataKey instead of propertyName, because 
// non-relation LISTS and ROOTS do not have propertyName, also accessing via dataKey saves overhead


export class InMemoryCache extends TirCache {
  /** Map of modelName to server side identifier field, e.g. user: username */
  declare protected readonly RECORD_TYPE_TO_IDF: Map<keyof PodRegistry, AttrField["dataKey"]>;

  @tracked
  declare protected readonly IDENTIFIER_TO_CLIENT_ID: Map<
    `${keyof PodRegistry}:${AttrField["dataKey"]}`,
    ClientId
  >;

  @tracked // string in map key is the root field name of the GraphQL query
  declare protected readonly ROOTS: Map<
    `${keyof PodRegistry}:${RelationshipField["dataKey"]}:${ClientId}` | `${keyof PodRegistry}:${string}`,
    ScalarRoot<any> | NodeRoot | ConnectionRoot
  >;

  @tracked
  declare protected readonly REMOVED_PODS: Set<ClientId>;

  constructor(store: TirService, defaultIdentifierField?: string) {
    super(store, defaultIdentifierField);
    this.RECORD_TYPE_TO_IDF = new Map();
    this.IDENTIFIER_TO_CLIENT_ID = new Map();
    this.ROOTS = new Map();
    this.REMOVED_PODS = new Set();
  };

  public getIDInfo = (modelName: keyof PodRegistry): {
    dataKey: AttrField["dataKey"];
    propertyName: AttrField["propertyName"];
    dbKeyPrefix: `${keyof PodRegistry}:${AttrField["dataKey"]}`;
  } => {
    const pkField = this.RECORD_TYPE_TO_IDF.get(modelName) ?? this.DEFAULT_IDENTIFIER_FIELD;
    const metaField = this.getFieldMetaForType(modelName).get(pkField);
    assert(`No such dataKey ${pkField} is configured on ${modelName}`, metaField);
    return {
      dataKey: pkField,
      propertyName: metaField!.propertyName,
      dbKeyPrefix: `${modelName}:${pkField}`
    };
  };

  /**
   * Returns the key for LISTS and ROOTS maps 
   */
  public getRootId = (
    modelName: keyof PodRegistry,
    root: string | (AttrField | RelationshipField)["dataKey"],
    clientId?: ClientId
  ): `${keyof PodRegistry}:${string}` | `${keyof PodRegistry}:${(AttrField | RelationshipField)["dataKey"]}:${ClientId}` => {
    return clientId ? `${modelName}:${root}:${clientId}` : `${modelName}:${root}`;
  };

  /** 
   * Retrives the inverse root dataKey
   * */
  protected getInverseDataKey = (
    inverseFieldModelName: keyof PodRegistry,
    inverseFieldPropertyName: (AttrField | RelationshipField)["propertyName"],
  ) => {
    // ensure schema registration
    this.modelFor(inverseFieldModelName);
    return this.getPropertiesForType(inverseFieldModelName).get(inverseFieldPropertyName);
  };


  public createPod = (modelName: keyof PodRegistry) => {
    const PodType = this.modelFor(modelName);
    const pod = new PodType(this.store);
    this.CLIENT_ID_TO_POD.set(pod.CLIENT_ID, pod);
    return this.getPodByClientId(pod.CLIENT_ID)!;
  };



  public removePod = (pod: Pod): void => {
    // TODO: REMOVE FROM ALL MAPS
    const PodType = (pod.constructor as typeof Pod)
    const { dataKey, dbKeyPrefix } = this.getIDInfo(PodType.modelName);

    this.CLIENT_ID_TO_POD.delete(pod.CLIENT_ID);
    this.IDENTIFIER_TO_CLIENT_ID.delete(`${dbKeyPrefix}:${pod[dataKey]}`);
  };

  /** Associates the Pod instance with server side identifier field */
  public identifyPod = (pod: Pod) => {
    const { dataKey, dbKeyPrefix } = this.getIDInfo((pod.constructor as typeof Pod).modelName);
    if (pod[dataKey]) {
      this.IDENTIFIER_TO_CLIENT_ID.set(`${dbKeyPrefix}:${pod[dataKey]}`, pod.CLIENT_ID);
    };
  };

  public getPodByClientId = (clientId: ClientId): Pod | undefined => {
    return this.CLIENT_ID_TO_POD.get(clientId);
  };

  public getPod = (
    modelName: keyof PodRegistry,
    identifier: Pod[AttrField["dataKey"]] | TPodData[AttrField["dataKey"]]
  ): Pod | undefined => {
    const { dbKeyPrefix } = this.getIDInfo(modelName);

    const clientId = this.IDENTIFIER_TO_CLIENT_ID.get(`${dbKeyPrefix}:${identifier}`);
    return clientId ? this.getPodByClientId(clientId) : undefined;
  };

  protected getOrCreatePod = (modelName: keyof PodRegistry, data: TPodData) => {
    const { dataKey, propertyName } = this.getIDInfo(modelName);
    assert(`${ERROR_MESSAGE_PREFIX}Cannot encapsulate a pod. key ${dataKey} is missing in "${data}"`, data[dataKey]);
    let pod = this.getPod(modelName, data[dataKey]);
    if (!pod) {
      pod = this.createPod(modelName);
      pod[propertyName] = data[dataKey];
    };
    return this.getPodByClientId(pod.CLIENT_ID)!;
  };

  /** Always returns a Root instance */
  public getRoot = (ref: RootRef) => {
    const { modelName, root, clientId } = ref;
    const key = this.getRootId(modelName, root, clientId);
    let connectionRoot = this.ROOTS.get(key);
    if (!connectionRoot) {
      const meta = this.getFieldMetaForType(modelName);
      // if this is a realtion
      if (clientId) {
        const field = meta.get(root);
        assert(`No such field with dataKey ${root} on ${modelName}`, field);
        if (field.fieldType === "relationship") {
          if (field.relationshipType === "belongsTo") {
            this.ROOTS.set(key, new NodeRoot(null, field.dataKey, clientId, this.updateRoot.bind(this)));
          };
          if (field.relationshipType === "hasMany") {
            this.ROOTS.set(key, new ConnectionRoot(this.store, ref));
          };
        };
        if (field.fieldType === "attribute") {
          let Processor: typeof FieldProcessor | undefined;
          if (field.fieldProcessorName) {
            Processor = getOwner(this)?.lookup(
              `field-processor:${field.fieldProcessorName}`,
            ) as typeof FieldProcessor | undefined;
            // Try looking up in default field processors
            if (!Processor) {
              Processor =
                DefaultFieldProcessors[field.fieldProcessorName];
            };
            assert(
              `No field processor with name "${field.fieldProcessorName}" was found.`,
              Processor,
            );
          };
          const processor = Processor ? new Processor(this.store) : undefined;
          const value = field.defaultValue
            ? processor?.process(field.defaultValue)
            : null
          this.ROOTS.set(key, new ScalarRoot<any>(value, field.dataKey, clientId, processor))
        };
      };
      // support only root level connection roots
      this.ROOTS.set(key, new ConnectionRoot(this.store, ref));
    };
    return this.ROOTS.get(key)!;
  };


  // TODO: review
  public parseGraphQlDocument = (source: RequestDocument, options?: ParseOptions | undefined) => {
    const AST = typeof source === "object" ? source : parse(source);
    const aliasMap: Map<string, {
      dataKey: string,
      variables: Variables,
    }> = new Map();
    const AliasRegex = /^[A-Z][A-Za-z]*Pod.*$|^[A-Z][A-Za-z]*Stem.*$/;

    visit(AST, {
      // Only process operation definitions (queries, mutations, subscriptions)
      OperationDefinition: {
        enter(pod: OperationDefinitionNode) {
          // Traverse through the selection set of the operation
          pod.selectionSet.selections.forEach((selection) => {
            if (selection.kind === 'Field') {
              const field: FieldNode = selection;

              // Check if the field has an alias and if it matches the naming convention
              // todo implement pod/connetion type assignemnt too
              if (field.alias && AliasRegex.test(field.alias.value)) {
                const alias = field.alias.value;
                const variables: Variables = {};

                // TODO: understand this
                // Collect arguments (variables) of the connection field
                field.arguments?.forEach((arg) => {
                  if (arg.value.kind === 'IntValue' || arg.value.kind === 'StringValue') {
                    // Store only integer and string values for simplicity; adjust as needed
                    variables[arg.name.value] = arg.value.value;
                  }
                });

                if (aliasMap.has(alias)) {
                  throw new Error(`${ERROR_MESSAGE_PREFIX}Duplicate identifier ${alias}`);
                };
                // Add the connection and its variables to the map
                aliasMap.set(alias, {
                  dataKey: field.name.value,
                  variables: variables
                });
              }
            }
          });
        },
      },
    });
    return aliasMap;
  };

  /** Primary gateway to serialize the incoming data */
  public serialize = (
    aliases: Map<string, { dataKey: string, variables: Variables }>,
    data: Record<string, unknown>,
  ): Record<string, unknown> => {
    this.serializeRoot(aliases, data);
    return data;
  };


  /** Serializes data by calling the encapsulator on aliased fields or passing it further down the nested objects */
  private serializeRoot = (
    aliases: Map<string, { dataKey: string, variables: Variables }>,
    data: unknown,
    clientId?: ClientId,
    items?: Set<ClientId>,
  ) => {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      Object.entries(data).forEach(([dataKey, keyData]) => {
        const { typeName, type } = this.parseAlias(dataKey) ?? {};
        if (typeName && type && keyData) {
          this.encapsulate(aliases, typeName, type, dataKey, keyData as TPodData | TStemData, clientId, items);
        } else {
          // proceed finding nested stems and pods
          this.serializeRoot(aliases, keyData);
        };
      });
    }; // else is wrong data. we should probably not consider that options
  };

  private encapsulate = (
    aliases: Map<string, { dataKey: string, variables: Variables }>,
    typeName: keyof PodRegistry,
    type: TirCache["namingConventions"]["item"] | TirCache["namingConventions"]["set"],
    dataKey: RelationshipField["dataKey"],
    data: TPodData | TStemData,
    clientId?: ClientId,
    items?: Set<ClientId>,
  ): void => {
    const modelName = dasherize(typeName);
    // this is not supposed happen ever, if the server adheres to GraphQL spec
    // TODO: move to connections
    // assert(`${ERROR_MESSAGE_PREFIX}Cannot infer alias and variables. Ensure that server responds with sent aliases!`, aliased)

    if (type === this.namingConventions.set) {
      // ensure that an object is returned
      const stemData = data as TStemData;
      // const ref: ConnectionRef = {
      //   modelName: modelName,
      //   variables: aliased.variables,
      //   root: aliased.dataKey,
      // };

      // root reference
      const ref = {
        modelName: modelName,
        root: dataKey,
        clientId: clientId
      };

      // TODO. resolve a connection
      // TODO. implement passing of non relay complient list

      const { edges } = stemData;
      const clientIdsInList: Set<ClientId> = new Set();
      edges?.forEach(edge => {

        const nodeData = edge[this.namingConventions.item] as TPodData;
        if (nodeData) {
          // continue serialization of a node
          this.serializeRoot(aliases, nodeData as TPodData, undefined, clientIdsInList);
        };
      });
      // set the root or relation data
      this.updateRoot(ref, null, clientIdsInList, null, false, true, true); // do not replace value, instead add them
    } else if (type === this.namingConventions.item) {
      const podData = data as TPodData;
      // create/update pod
      const podInstance = this.getOrCreatePod(modelName, podData);
      // add this node to passed parent clientIdList to be included in the enclosing ConnectionRoot
      if (items) {
        items.add(podInstance.CLIENT_ID);
      };
      const meta = this.getFieldMetaForType(modelName);
      Object.entries(podData).forEach(([key, value]) => {
        const field = meta.get(key);
        // skip unregistered attrs and relations, letting serializeRoot handle them
        if (field && field.fieldType === "attribute") {
          // update attribute root
          this.updateRoot({
            modelName: modelName,
            root: field.dataKey,
            clientId: podInstance.CLIENT_ID
          }, value, null, null, false, true, true);
        };
        // handle next level
        this.serializeRoot(aliases, value, podInstance.CLIENT_ID);
      });
    };
  };


  /** Creates/updates roots inlcuding backwards */
  public updateRoot = (
    ref: RootRef,
    replace: Set<ClientId> | (ClientId | null),
    add: Set<ClientId> | null,
    remove: Set<ClientId> | null,
    skipInverses: boolean = false,
    // whether the initial state on the ScalarRoot should also be updated
    updateInitial: boolean = false,
    markLoaded: boolean = false,
  ): void => {
    const { modelName, root, clientId } = ref;
    const rootField = this.getRoot(ref);
    if (!clientId) {
      assert(`${ERROR_MESSAGE_PREFIX}Cannot update a root, because only connection roots are supported on top level roots`, rootField instanceof ConnectionRoot);
    };
    if (rootField instanceof ConnectionRoot) {
      // for both, top and relation level, update the root field in cache
      rootField.update({
        add: add ?? new Set(),
        remove: remove ?? new Set(),
      }, updateInitial, markLoaded);
    } else {
      rootField.update(replace, updateInitial, markLoaded)
    };
    if (!skipInverses && clientId) {
      const meta = this.getFieldMetaForType(modelName).get(root);
      if (meta && meta.fieldType === "relationship" && meta.realInverse) {
        const inverseDataKey = this.getInverseDataKey(meta.modelName, meta.propertyName);
        // if not unidirectional inverses
        if (inverseDataKey){
          if (meta.relationshipType === "hasMany") {
            add?.forEach(id => {
              this.updateRoot({
                modelName: meta.modelName,
                root: inverseDataKey,
                clientId: id,
              }, null, new Set([clientId]), new Set(), true, true, markLoaded);
            });
            remove?.forEach(id => {
              this.updateRoot({
                modelName: meta.modelName,
                root: inverseDataKey,
                clientId: id,
              }, null, new Set(), new Set([clientId]), true, true, markLoaded);
            });
          } else {
            this.updateRoot({
              modelName: meta.modelName,
              root: inverseDataKey,
              clientId: replace as ClientId,
            }, clientId, null, null, true, true, markLoaded);
          };
        };
      };
    };
  };


  public encapsulateFieldErrors = (data: Record<string, any>, errors: GraphQlErrorData[]) => {
    errors.forEach(error => {
      const { message, locations, path, extensions } = error;
      if (path) {
        const { key, record, fieldErrorField } = getObjectAtPath(data, path);
        if (key && record && fieldErrorField) {
          const { typeName, type } = this.parseAlias(key) ?? {};
          if (typeName && type) {
            const { dataKey } = this.getIDInfo(typeName);
            if (record[dataKey]) {
              const pod = this.getPod(typeName, record[dataKey]);
              if (pod) {
                // TODO: implement this
                throw new Error(`${ERROR_MESSAGE_PREFIX}NOT IMPLEMENTED`)
                // pod.registerError(pod, fieldErrorField, message);
              };
            };
          };
        };
      };
    });
  };



  public getRemovedPods = (): Set<ClientId> => {
    return this.REMOVED_PODS;
  };

  public markPodForRemoval = (clientId: ClientId): void => {
    this.REMOVED_PODS.add(clientId);
  };

  public unmarkPodForRemoval = (clientId: ClientId): void => {
    this.REMOVED_PODS.delete(clientId);
  };


  /** returns the first part of the ":" separated string, which in Cache conventions is the modelName */
  public modelNameFrom = (clientId: ClientId): keyof PodRegistry => {
    return clientId.split(":")[0]!;
  }

}
