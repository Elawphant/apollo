import { tracked } from 'tracked-built-ins';
import { Connection, Node } from '../model';
import { assert } from '@ember/debug';
import { getOwner, setOwner } from '@ember/owner';
import type { NodeRegistry } from '../model/registry';
import { dasherize } from '@ember/string';
import type { RequestDocument, Variables } from 'graphql-request';
import type { ConnectionRootRef, ConnectionRef, GraphQlErrorData, TAliasedConnectionData, TAliasedNodeData } from '../model/types';
import type ApplicationInstance from '@ember/application/instance';
import { TirService } from 'ember-apollo-data/';
import { configureModelConstructor } from 'ember-apollo-data/configurators/node-type';
import { ADDON_PREFIX } from 'ember-apollo-data/-private/globals';
import { parse, type ParseOptions, visit, type OperationDefinitionNode, type FieldNode } from 'graphql';
import { ConnectionRoot } from '../model/connection-root';
import type { AttrField, RelationshipField } from '../model/field-mappings';
import { getObjectAtPath } from '../model/utils';
import { TirCache } from './cache';


function toOutput(output: Record<string, any>, enclose: boolean = true, enclosable: Record<string, any>) {
  if (enclose) {
    Object.assign(output, enclosable);
  }
}


export interface FieldStatus {
  loaded: boolean;
  initialValue: any;
  currentValue: any;
}

type PartialFieldStatusUpdate = {
  [K in keyof FieldStatus]?: FieldStatus[K];
};

export class InMemoryCache extends TirCache {
  /** Map of modelName to server side identifier field, e.g. user: username */
  declare protected readonly RECORD_TYPE_TO_IDF: Map<keyof NodeRegistry, AttrField["propertyName"]>;

  /** Main KEY table */
  @tracked
  declare protected readonly CLIENT_ID_TO_NODE: Map<Node["CLIENT_ID"], Node>;
  @tracked
  declare protected readonly IDENTIFIER_TO_CLIENT_ID: Map<
    `${keyof NodeRegistry}:${AttrField["propertyName"]}:${(typeof Node.Meta)[string]["dataKey"]}`,
    Node["CLIENT_ID"]
  >;

  @tracked
  declare protected readonly TO_ONE_RELATIONS: Map<
    `${Node["CLIENT_ID"]}:${RelationshipField["propertyName"]}`,
    `${Node["CLIENT_ID"]}:${RelationshipField["propertyName"]}` | null
  >;

  @tracked
  declare protected readonly LISTS: Map<
    `${keyof NodeRegistry}:${(typeof Node.Meta)[string]["propertyName"]}:${Node["CLIENT_ID"]}` | `${string}:${keyof NodeRegistry}`,
    Set<Node["CLIENT_ID"]>
  >;

  @tracked // string in map key is the root field name of the GraphQL query
  declare protected readonly ROOTS: Map<
    `${keyof NodeRegistry}:${(typeof Node.Meta)[string]["propertyName"]}:${Node["CLIENT_ID"]}` | `${string}:${keyof NodeRegistry}`,
    ConnectionRoot
  >;

  @tracked
  declare protected readonly FIELD_STATE: Map<Node["CLIENT_ID"], { [fieldName: AttrField["propertyName"]]: FieldStatus }>;
  @tracked
  declare protected readonly FIELD_ERRORS: Map<Node["CLIENT_ID"], { [fieldName: AttrField["propertyName"]]: string[] }>;

  @tracked
  declare protected readonly REMOVED_NODES: Set<Node["CLIENT_ID"]>;

  constructor(store: TirService, defaultIdentifierField?: string) {
    super(store, defaultIdentifierField);
    this.RECORD_TYPE_TO_IDF = new Map();
    this.CLIENT_ID_TO_NODE = new Map();
    this.IDENTIFIER_TO_CLIENT_ID = new Map();
    this.TO_ONE_RELATIONS = new Map();
    this.LISTS = new Map();
    this.ROOTS = new Map();
    this.FIELD_STATE = new Map();
    this.REMOVED_NODES = new Set();
  };


  private parseAlias = (alias: string): {
    typeName: keyof NodeRegistry | undefined,
    type: "Node" | "Connection" | undefined,
    identifier: string | null
  } | null => {
    // Define a regular expression to capture the essential parts of the alias
    // This regex looks for a starting capital letter (indicating PascalCase)
    // followed by any combination of letters (the type name),
    // and then it tries to capture either "Node" or "Connection" followed by any characters (additional suffixes or identifiers).
    // This regex ensures that both typeName and type are present in the alias
    const regex = /^([A-Z][a-zA-Z]*)(Node|Connection)(.*)$/;
    const match = alias.match(regex);

    if (match) {
      return {
        typeName: match[1], // The type name extracted
        type: match[2] as "Node" | "Connection" | undefined, // Whether it's a Node or Connection
        identifier: match[3] || null // The additional identifier/suffix, if any
      };
    } else {
      // Return null if alias doesn't follow the expected format. This will result in skipping encapuslation
      return null;
    }
  }


  // TODO imporve IDF logic
  public getIDInfo = (modelName: keyof NodeRegistry): {
    dataKey: (typeof Node.Meta)[string]["dataKey"];
    propertyName: (typeof Node.Meta)[string]["propertyName"];
    dbKeyPrefix: `${keyof NodeRegistry}:${(typeof Node.Meta)[string]["propertyName"]}`;
  } => {
    const pkField = this.RECORD_TYPE_TO_IDF.get(modelName) ?? this.DEFAULT_IDENTIFIER_FIELD;
    const NodeType = this.modelFor(modelName);
    return {
      dataKey: NodeType.Meta[pkField]?.dataKey ?? NodeType.Meta[pkField]!.propertyName,
      propertyName: NodeType.Meta[pkField]!.propertyName,
      dbKeyPrefix: `${modelName}:${NodeType.Meta[pkField]!.propertyName}`
    };
  };

  /**
   * Returns the key for LISTS and ROOTS maps 
   * @param fieldName 
   * @param modelName 
   * @param clientId 
   * @returns 
   */
  public getListId = (
    fieldName: string | RelationshipField["propertyName"],
    modelName: keyof NodeRegistry,
    clientId?: Node["CLIENT_ID"]
  ): `${string}:${keyof NodeRegistry}` => {
    return clientId ? `${modelName}:${fieldName}:${clientId}` : `${fieldName}:${modelName}`;
  }

  public createNode = (modelName: keyof NodeRegistry) => {
    const NodeType = this.modelFor(modelName);
    const node = new NodeType(this.store);
    const data: TAliasedNodeData = {};
    const meta = (node.constructor as typeof Node).Meta;
    Object.values(meta).forEach(field => {
      if (field.fieldType === "attribute") {
        Object.assign(data, {
          [field.propertyName]: field.defaultValue,
        })
      }
    });
    this.updateNode(modelName, data);
    return this.getNodeByClientId(node.CLIENT_ID)!;
  }

  public addNode = (modelName: keyof NodeRegistry, data: TAliasedNodeData): Node => {
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(modelName);
    assert(`${ADDON_PREFIX}: Node data must contain the identifier field "${dataKey}"`, data[dataKey] !== undefined);
    const NodeType = this.modelFor(modelName);
    const newNode = new NodeType(this.store);
    this.CLIENT_ID_TO_NODE.set(newNode.CLIENT_ID, newNode);
    this.initializeFields(newNode);
    this.identifyNode(newNode);
    return this.getNodeByClientId(newNode.CLIENT_ID)!;
  };


  private updateNode = (modelName: keyof NodeRegistry, data: TAliasedNodeData) => {
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(modelName);
    const node = this.getNode(modelName, propertyName);
    // this should never happen
    if (!node) {
      throw new Error(`No such node of type ${modelName} with identifier field ${propertyName}:${data[dataKey]}.`);
    };
    const NodeType = this.modelFor(modelName);
    const meta = NodeType.Meta;
    Object.values(NodeType.Meta).forEach(metaField => {
      if (metaField.fieldType === "attribute") {
        if (data[metaField.dataKey] !== undefined) {
          this.updatefieldState(node, metaField.propertyName, {
            loaded: true,
            initialValue: data[dataKey],
            currentValue: data[dataKey],
          });
        }
      };
      // leave relations to be updated in the serialized
    });
  }


  public removeNode = (node: Node): void => {
    // TODO: REMOVE FROM ALL MAPS
    const NodeType = (node.constructor as typeof Node)
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(NodeType.modelName);

    this.updateToOneRelations(node, propertyName, null);
    this.CLIENT_ID_TO_NODE.delete(node.CLIENT_ID);
    this.IDENTIFIER_TO_CLIENT_ID.delete(`${dbKeyPrefix}:${node[propertyName]}`);
  };

  /** Associates the Node instance with server side identifier field */
  public identifyNode = (node: Node) => {
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo((node.constructor as typeof Node).modelName);
    if (node[dataKey]) {
      this.IDENTIFIER_TO_CLIENT_ID.set(`${dbKeyPrefix}:${node[propertyName]}`, node.CLIENT_ID);
    }
  };

  public getNode = (
    modelName: keyof NodeRegistry,
    identifier: Node[(typeof Node.Meta)[string]["propertyName"]] | TAliasedNodeData[(typeof Node.Meta)[string]["dataKey"]]
  ): Node | undefined => {
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(modelName);

    const clientId = this.IDENTIFIER_TO_CLIENT_ID.get(`${dbKeyPrefix}:${identifier}`);
    return clientId ? this.getNodeByClientId(clientId) : undefined;
  };

  private getCreatedOrUpdatedNode = (modelName: keyof NodeRegistry, data: TAliasedNodeData): Node => {
    const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(modelName);
    let NODE = this.getNode(modelName, data[dataKey]);
    if (!NODE) {
      NODE = this.addNode(modelName, data);
    };
    this.resetFieldErrors(NODE);
    this.updateNode(modelName, data);
    return NODE;
  }

  public getNodeByClientId = (clientId: string): Node | undefined => {
    return clientId && this.CLIENT_ID_TO_NODE.get(clientId)
      ? new Proxy(this.CLIENT_ID_TO_NODE.get(clientId) as Node, {})
      : undefined;
  };

  /** Always returns a ConnectonRoot instance */
  public getConnectionRoot = (ref: ConnectionRootRef) => {
    const { fieldName, modelName, clientId } = ref;
    const key = this.getListId(modelName, fieldName, clientId);
    let connectionRoot = this.ROOTS.get(key);
    if (!connectionRoot) {
        this.ROOTS.set(key as any, new ConnectionRoot(this.store, ref))
    };
    return this.ROOTS.get(key)!;
  };

  /** 
   * Creates of overwrites the internal connection with the data recieved from the server 
   * */
  public getCreatedOrUpdatedConnection = (ref: ConnectionRef, data: TAliasedConnectionData) => {
    const connectionRoot = this.getConnectionRoot(ref);
    // create or update the connection data
    // do not create or update nodes, becuase it is the job of the serializer
    // TODO: Reimplement: // connectionRoot.createOrUpdateConnection(ref, data);
    return connectionRoot.getConnection(ref)!;
  };


  public getConnection = (ref: ConnectionRef) => {
    const connectionRoot = this.getConnectionRoot(ref);
    return connectionRoot.getConnection(ref.variables);
  };


  public parseGraphQlDocument = (source: RequestDocument, options?: ParseOptions | undefined) => {
    const AST = typeof source === "object" ? source : parse(source);
    const aliasMap: Map<string, {
      fieldName: string,
      variables: Variables,
      isNode?: boolean
    }> = new Map();
    const AliasRegex = /^[A-Z][A-Za-z]*Node.*$|^[A-Z][A-Za-z]*Connection.*$/;

    visit(AST, {
      // Only process operation definitions (queries, mutations, subscriptions)
      OperationDefinition: {
        enter(node: OperationDefinitionNode) {
          // Traverse through the selection set of the operation
          node.selectionSet.selections.forEach((selection) => {
            if (selection.kind === 'Field') {
              const field: FieldNode = selection;

              // Check if the field has an alias and if it matches the naming convention
              // todo implement node/connetion type assignemnt too
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
                  throw new Error(`${ADDON_PREFIX}: Duplicate identifier ${alias}`);
                };
                // Add the connection and its variables to the map
                aliasMap.set(alias, {
                  fieldName: field.name.value,
                  variables: variables
                });
              }
            }
          });
        },
      },
    });
    return aliasMap;
  }


  public serialize = (
    aliases: Map<string, { fieldName: string, variables: Variables }>,
    data: Record<string, unknown>,
    parentNode?: Node,
    fieldNameOnParent?: RelationshipField["propertyName"],
    encloseInOutput: boolean = true,
    // TODO: improve output type
  ): Record<string, Node | Connection | Record<string, any>> => {
    assert(`${ADDON_PREFIX}: Serialize method expects data in form of Record<string, any>.`, typeof data === "object" && !Array.isArray(data));
    const output = {};
    Object.entries(data).forEach(([key, value]) => {
      const { typeName, type, identifier } = this.parseAlias(key) ?? {};
      const variables = aliases.get(key);
      if (!variables) {
        // this is not supposed happen ever, if the server adheres to GraphQL spec
        throw new Error(`${ADDON_PREFIX}: Cannot infer alias and variables. Ensure that server responds with sent aliases!`);
      };
      if (typeName && type) {
        const modelName = dasherize(typeName);
        const NodeType = this.modelFor(modelName);
        if (type === "Connection") {
          const ref: ConnectionRef = {
            modelName: modelName,
            variables: variables.variables,
            fieldName: variables.fieldName,
            clientId: parentNode?.CLIENT_ID,
          };
          const CONNECTION = this.getCreatedOrUpdatedConnection(ref, value as TAliasedConnectionData);
          // TODO: handle to-many relation registration
          const { edges, ...rest } = value as TAliasedConnectionData;
          edges?.forEach(edge => {
            const node = edge.node;
            if (node) {
              this.serialize(aliases, node, parentNode, variables.fieldName, false);
            }
          });
          // overwrite the data with encapsulated value
          toOutput(output, encloseInOutput, {
            [key]: CONNECTION
          });
        };
        if (type === "Node") {
          const nodeData = value as TAliasedNodeData
          // for performance improvement skip node encapuslation, because it was already done inside getCreatedOrUpdatedConnection
          const currentNode = this.getCreatedOrUpdatedNode(modelName, nodeData);
          Object.values(NodeType.Meta).forEach(field => {
            if (field.fieldType === "relationship") {
              if (field.relationshipType === "belongsTo") {
                // if to-one relation is null
                if (nodeData[field.dataKey] === null) {
                  this.updateToOneRelations(currentNode, field.propertyName, null)
                };
                // else -> leave for childNode to perform relation updating. see below
              };
            };
          });
          const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(modelName);
          // potentially, this should never happen
          if (!this.IDENTIFIER_TO_CLIENT_ID.get(`${dbKeyPrefix}:${nodeData[dataKey]}`)) {
            throw new Error(`${ADDON_PREFIX}: No "CLIENT_ID" found for ${modelName} with ${propertyName} = ${nodeData[dataKey]}`);
          };
          // update to-one relations restrospectively and bi-directionally
          if (parentNode && fieldNameOnParent) {
            const childField = NodeType.Meta[fieldNameOnParent];
            if (childField && childField.fieldType === "relationship") {
              if (childField.relationshipType === "belongsTo") {
                this.updateToOneRelations(parentNode, childField.propertyName, currentNode);
              };
            };
          };
          this.serialize(aliases, nodeData, currentNode, variables.fieldName, false);
          toOutput(output, encloseInOutput, {
            [key]: this.getNode(modelName, nodeData[dataKey]),
          });
        };
      } else {
        toOutput(output, true, {
          [key]: value,
        });
      };
    });
    // TODO: iterate over Nodes, check if any is marked as deleted, check if there is no error with that node, call removeNode on it.
    return output;
  };


  /** 
   * Bi-directionally updates one-to-one relations.
   * If `skipInverses` is `true`, updates one-to-one relation unidirectionally (used for many-to-one updates)
   * */
  private updateToOneRelations = (
    parentNode: Node,
    fieldName: RelationshipField['propertyName'],
    childeNode: Node | null,
    // Used in updateToManyRelations to perform unidirectional relation setting
    skipInverses: boolean = false
  ): void => {
    const ParentType = parentNode.constructor as typeof Node;
    const field = ParentType.Meta[fieldName] as RelationshipField;
    assert(
      `${ADDON_PREFIX}: No such relation ${fieldName} on ${ParentType.name}`,
      field && field.fieldType === "relationship" && field.relationshipType === "belongsTo"
    );
    const ChildType = childeNode ? childeNode.constructor as typeof Node : undefined;

    // Polymorphic types must be explicitly defined on the relations
    if (ChildType) {
      assert(
        `${ADDON_PREFIX}: Type ${ChildType.modelName} is not declared on ${ParentType.name} ${field.propertyName} as polymorphicType. 
        All polymorphic types must be explicitly declared on relations.`,
        !field.polymorphicTypes || field.polymorphicTypes!.includes(ChildType.modelName)
      );
    };
    const key = this.keyForBelongsTo(parentNode.CLIENT_ID, fieldName);
    const newInverseKey = childeNode && field.inverse ? this.keyForBelongsTo(childeNode.CLIENT_ID, field.inverse) : null;

    if (!skipInverses) {
      // if inverse keys are supported
      if (field.inverse && ChildType?.Meta[field.inverse]) {
        const oldInverseKey = this.TO_ONE_RELATIONS.get(key);
        if ((oldInverseKey && oldInverseKey !== newInverseKey && newInverseKey) || (!oldInverseKey && newInverseKey)) {
          if (oldInverseKey) {
            // remove the old inverse Key
            this.TO_ONE_RELATIONS.set(oldInverseKey, null);
          }
          // set a new inverse key
          this.TO_ONE_RELATIONS.set(newInverseKey, key);
        }
        // remove inverse if newInverseKey is null
        if (oldInverseKey && oldInverseKey !== newInverseKey && newInverseKey === null) {
          this.TO_ONE_RELATIONS.set(oldInverseKey, null);
        }
      }
    }
    // register current relation
    this.TO_ONE_RELATIONS.set(key, newInverseKey);
  };


  public getList = (modelName: keyof NodeRegistry, fieldName: RelationshipField['propertyName'], clientId: Node["CLIENT_ID"]) => {
    const key = this.getListId(modelName, fieldName, clientId);
    let list = this.LISTS.get(key);
    if (!list) {
      this.LISTS.set(key, new Set());
    };
    return this.LISTS.get(key)!;
  };

  /** Creates/updates to-one backward relations on many-to-one relations */
  public updateList = (
    parentNode: Node,
    fieldName: RelationshipField["propertyName"],
    childNodes: Node[]
  ): void => {
    const ParentType = parentNode.constructor as typeof Node;
    const field = ParentType.Meta[fieldName] as RelationshipField;
    if (field.inverse) {
      childNodes.forEach(node => {
        const ChildType = node.constructor as typeof Node;
        const inverseField = ChildType.Meta[field.inverse!];
        if (inverseField && inverseField.fieldType === "relationship") {
          if (inverseField.relationshipType === "belongsTo") {
            this.updateToOneRelations(node, inverseField.propertyName, parentNode, true);
          };
          if (inverseField.relationshipType === "hasMany") {
            const newNodes = new Set(childNodes.map(node => node.CLIENT_ID));
            const key = this.getListId(ParentType.modelName, fieldName, parentNode.CLIENT_ID);
            let oldNodes = this.getList(ParentType.modelName, fieldName, parentNode.CLIENT_ID);
            const validList = Array.from(oldNodes).filter(clientId => this.CLIENT_ID_TO_NODE.has(clientId));
            this.LISTS.set(key, new Set(...validList, ...newNodes));
          };
        };
      });
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
            const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(typeName);
            if (record[dataKey]) {
              const node = this.getNode(typeName, record[dataKey]);
              if (node) {
                this.addFieldError(node, fieldErrorField, message);
              };
            };
          };
        };
      };
    });
  };

  private keyForBelongsTo = (
    clientId: Node["CLIENT_ID"],
    toOneFieldName: RelationshipField["propertyName"]
  ): `${Node["CLIENT_ID"]}:${RelationshipField["propertyName"]}` => {
    return `${clientId}:${toOneFieldName}`;
  }

  // TODO: redo
  private setToOne = (
    parentNodeClientId: Node["CLIENT_ID"], fieldNameOnParent: RelationshipField["propertyName"], childNode: Node | null
  ) => {

    const key = this.keyForBelongsTo(parentNodeClientId, fieldNameOnParent);
    let inverseField: RelationshipField | undefined;
    if (childNode) {
      inverseField = Object.values((childNode.constructor as typeof Node).Meta)
        .filter(field => field.fieldType === "relationship" && field.relationshipType === "belongsTo")
        .find(field => (field as RelationshipField).inverse === fieldNameOnParent) as RelationshipField | undefined;
    };

    const inverseKey = childNode && inverseField ? this.keyForBelongsTo(childNode?.CLIENT_ID, inverseField.propertyName) : null;
    this.TO_ONE_RELATIONS.set(key, inverseKey);
    if (inverseKey) {
      this.TO_ONE_RELATIONS.set(inverseKey, key);
    }
  };

  public getToOne = (node: Node, fieldName: RelationshipField["propertyName"]) => {
    const belongsToClientId = this.TO_ONE_RELATIONS.get(this.keyForBelongsTo(node.CLIENT_ID, fieldName));
    if (belongsToClientId) {
      return this.getNodeByClientId(belongsToClientId);
    };
    return null;
  }

  public updatefieldState = (node: Node, fieldName: typeof Node.Meta[string]["propertyName"], status: PartialFieldStatusUpdate) => {
    const field = this.stateForField(node.CLIENT_ID, fieldName);
    Object.assign(field, status);
  };

  private initializeFields = (node: Node) => {
    const newState: { [key: typeof Node.Meta[string]["dataKey"]]: FieldStatus } = {};
    const newErrorState: { [key: typeof Node.Meta[string]["dataKey"]]: string[] } = {};
    Object.values((node.constructor as typeof Node).Meta).map(field => {
      if (field.fieldType === "attribute") {
        Object.assign(newState, {
          [field.dataKey]: {
            loaded: !node.isNew,
            initialValue: field.defaultValue ?? null,
            currentValue: field.defaultValue ?? null,
          }
        });
      };
      Object.assign(newErrorState, {
        [field.dataKey]: []
      });
    });
    this.FIELD_STATE.set(node.CLIENT_ID, newState);
  }

  public stateForField = (clientId: Node["CLIENT_ID"], fieldName: typeof Node.Meta[string]["propertyName"]): FieldStatus => {
    return this.FIELD_STATE.get(clientId)![fieldName]!;
  };

  /**
   * Returns true if any of the fields is not loaded or has no registered state
   */
  public getStateForNodeFields = (clientId: Node["CLIENT_ID"]): boolean => {
    const state = this.FIELD_STATE.get(clientId);
    return state ? Object.values(state).some(status => {
      status.loaded === false
    }) : true;
  };

  public revert = (clientId: Node["CLIENT_ID"]) => {
    const state = this.FIELD_STATE.get(clientId);
    if (state) {
      Object.values(state).forEach(field => {
        field.currentValue = field.initialValue;
      });
    };
  };

  /** Adds a single error message to the errors */
  public addFieldError = (node: Node, fieldErrorField: typeof Node.Meta[string]["dataKey"], errorMessage: GraphQlErrorData["message"]) => {
    const errorsState = this.FIELD_ERRORS.get(node.CLIENT_ID)!;
    errorsState[fieldErrorField]?.push(errorMessage);
  };

  /** Removes all error messages for every field for a Node */
  public resetFieldErrors = (node: Node) => {
    const errorsState = this.FIELD_ERRORS.get(node.CLIENT_ID);
    if (errorsState) {
      Object.values(errorsState).forEach(field => field.splice(0, field.length));
    };
  };


  public getRemovedNodes = (): Set<Node["CLIENT_ID"]> => {
    return this.REMOVED_NODES;
  };

  public markNodeForRemoval = (clientId: Node["CLIENT_ID"]): void => {
    this.REMOVED_NODES.add(clientId);
  };

  public unmarkNodeForRemoval = (clientId: Node["CLIENT_ID"]): void => {
    this.REMOVED_NODES.delete(clientId);
  };


}
