import { tracked } from 'tracked-built-ins';
import { Connection, Node } from '.';
import { assert } from '@ember/debug';
import { getOwner, setOwner } from '@ember/owner';
import type { NodeRegistry } from './registry';
import { camelize, capitalize, dasherize } from '@ember/string';
import type { RequestDocument, Variables } from 'graphql-request';
import type { AggregatorRef, ConnectionRef, GraphQlErrorData, TAliasedConnectionData, TAliasedNodeData } from './types';
import type ApplicationInstance from '@ember/application/instance';
import type { TirService } from 'ember-apollo-data/';
import { configureModelConstructor } from 'ember-apollo-data/configurators/node-type';
import { ADDON_PREFIX } from 'ember-apollo-data/-private/globals';
import { parse, type ParseOptions, visit, type OperationDefinitionNode, type FieldNode } from 'graphql';
import { ConnectionRoot } from './connection-root';
import type { FieldProcessor } from 'ember-apollo-data/field-processor';
import { DefaultFieldProcessors } from 'ember-apollo-data/field-processors/default-field-processors';
import type { AttrField, RelationshipField } from './field-mappings';
import { getObjectAtPath } from './utils';


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

export class TirStore {
  declare private readonly STORE: TirService;

  declare private readonly KNOWN_NODE_TYPES: Map<keyof NodeRegistry, typeof Node>;


  /** A global default key to use if no key is specified. defaults to "id" */
  declare private readonly DEFAULT_IDENTIFIER_FIELD: AttrField["dataKey"];

  /** Map of modelName to server side identifier field, e.g. user: username */
  declare private readonly RECORD_TYPE_TO_IDF: Map<keyof NodeRegistry, AttrField["dataKey"]>;

  /** Main KEY table */
  @tracked
  declare private readonly CLIENT_ID_TO_NODE: Map<Node["CLIENT_ID"], Node>;
  @tracked
  declare private readonly IDENTIFIER_TO_CLIENT_ID: Map<`${keyof NodeRegistry}:${AttrField["propertyName"]}`, Node["CLIENT_ID"]>;

  @tracked
  declare private readonly TO_ONE_RELATIONS: Map<
    `${Node["CLIENT_ID"]}:${RelationshipField["dataKey"]}`,
    `${Node["CLIENT_ID"]}:${RelationshipField["dataKey"]}` | null
  >;

  @tracked
  declare private readonly TO_MANY_RELATIONS: Map<Node["CLIENT_ID"], Node["CLIENT_ID"][]>;

  /**
   * A map of ConnectionRoots
   * The key is in form of `<fieldName>:<modelName>:<CLIENT_ID|null>`: null if it is a root field.
   */
  @tracked
  declare private readonly CONNECTIONS_AGGREAGORS: Map<string, ConnectionRoot>;

  @tracked
  declare private readonly FIELD_STATE: Map<Node["CLIENT_ID"], { [fieldName: string]: FieldStatus }>;
  @tracked
  declare private readonly FIELD_ERRORS: Map<Node["CLIENT_ID"], { [fieldName: string]: string[] }>;


  constructor(store: TirService, defaultIdentifierField?: string) {
    setOwner(this, getOwner(store)!);
    this.STORE = getOwner(this)?.lookup(`service:${dasherize(store.constructor.name)}`) as TirService;
    this.KNOWN_NODE_TYPES = new Map();
    this.DEFAULT_IDENTIFIER_FIELD = defaultIdentifierField ?? "id";
    this.RECORD_TYPE_TO_IDF = new Map();
    this.CLIENT_ID_TO_NODE = new Map();
    this.IDENTIFIER_TO_CLIENT_ID = new Map();
    this.TO_ONE_RELATIONS = new Map();
    this.TO_MANY_RELATIONS = new Map();
    this.FIELD_STATE = new Map();
    this.CONNECTIONS_AGGREAGORS = new Map();
  };


  public modelFor = (modelName: string): typeof Node => {
    if (!this.KNOWN_NODE_TYPES.get(modelName)) {
      const RawModelConstructor = (
        getOwner(this) as ApplicationInstance
      ).resolveRegistration(`node:${modelName}`) as typeof Node | undefined;
      assert(
        `${ADDON_PREFIX}: No model extending Node found for ${modelName}`,
        RawModelConstructor && typeof RawModelConstructor === typeof Node,
      );
      const shimInstance = new RawModelConstructor(this.STORE);
      const constructor = configureModelConstructor(shimInstance, modelName);
      this.KNOWN_NODE_TYPES.set(modelName, constructor);
    }
    return this.KNOWN_NODE_TYPES.get(modelName)!;
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


  public getIDF = (modelName: keyof NodeRegistry): `${keyof NodeRegistry}:${keyof Node & string}` => {
    const pk = this.RECORD_TYPE_TO_IDF.get(modelName);
    return `${modelName}:${pk ?? this.DEFAULT_IDENTIFIER_FIELD}`;
  };


  private initializeNode = (modelName: keyof NodeRegistry) => {
    const NodeType = this.modelFor(modelName)!
    const node = new NodeType(this.STORE);
    this.CLIENT_ID_TO_NODE.set(node.CLIENT_ID, node);
    const Meta = NodeType.Meta;
    Object.keys(Meta).forEach((fieldName) => {
      const propertyName: string = Meta[fieldName]!.propertyName;
      const fieldProcessorName = Meta[fieldName]!.fieldProcessorName;
      if (fieldProcessorName) {
        // Lookup for defined field processor in field processors
        let Processor = getOwner(this)!.lookup(
          `field-processor:${fieldProcessorName}`,
        ) as typeof FieldProcessor | undefined;
        // Try looking up in default field processors
        if (!Processor) {
          Processor =
            DefaultFieldProcessors[fieldProcessorName];
        }
        assert(
          `No field processor with name "${Meta[fieldName]!.fieldProcessorName}" was found.`,
          Processor,
        );
        if (Processor) {
          // initialize a field processor and set it on _meta
          // TODO: change process initialization to accept store instead of owner
          (node._meta[fieldName] as AttrField).fieldProcessor = new Processor(
            this.STORE,
          )!;
        }
      }
      Object.defineProperty(node, propertyName, {
        get: Meta[propertyName]!.getter,
        set: Meta[propertyName]!.setter,
        enumerable: true,
        configurable: true,
      });
    });

    return this.getNodeByClientId(node.CLIENT_ID);
  }

  public createNode = (modelName: keyof NodeRegistry) => {
    const node = this.initializeNode(modelName)!;
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
    const IDF = this.getIDF(modelName);
    assert(`${ADDON_PREFIX}: Node data must contain the identifier field "${IDF}"`, data[IDF]);
    const NodeType = this.modelFor(modelName);
    const newNode = new NodeType(this.STORE);
    this.CLIENT_ID_TO_NODE.set(newNode.CLIENT_ID, newNode);
    this.initializeFields(newNode);
    this.identifyNode(newNode);
    return this.getNodeByClientId(newNode.CLIENT_ID)!;
  };


  public updateNode = (modelName: keyof NodeRegistry, data: TAliasedNodeData) => {
    const IDF = this.getIDF(modelName);
    const NODE = this.getNode(modelName, IDF);
    if (!NODE) {
      throw new Error(`No such node with ${IDF}:${data[IDF]}.`);
    };
    const NodeType = NODE.constructor as typeof Node;
    const meta = NodeType.Meta;
    const fields = Object.values(NodeType.Meta).map(meta => meta.dataKey);
    Object.entries(data).forEach(([key, val]) => {
      if (fields.includes(key)) {
        Object.values(meta).forEach(metaField => {
          if (metaField.fieldType === "attribute") {
            // use setters on the node instance to update values.
            NODE[key] = val;
          }
        });
      };
    });
  }


  public removeNode = (node: Node): void => {
    // TODO: REMOVE FROM ALL MAPS
    const NodeType = (node.constructor as typeof Node)
    const IDF = this.getIDF(NodeType.modelName);


    this.TO_ONE_RELATIONS.forEach((relation, key) => {
      if (relation === node.CLIENT_ID) {
        this.TO_ONE_RELATIONS.set(key, null);
      };
    })
    this.CLIENT_ID_TO_NODE.delete(node.CLIENT_ID);
    this.IDENTIFIER_TO_CLIENT_ID.delete(IDF);
  };

  /** Associates the Node instance with server side identifier field */
  public identifyNode = (node: Node) => {
    const IDF = this.getIDF(dasherize(node.constructor.name));
    if (node[IDF]) {
      this.IDENTIFIER_TO_CLIENT_ID.set(node[IDF], node.CLIENT_ID);
    }
  };

  public getNode = (modelName: keyof NodeRegistry, identifier: keyof Node & string): Node | undefined => {
    const clientId = this.IDENTIFIER_TO_CLIENT_ID.get(`${modelName}:${identifier}`);
    return clientId ? this.getNodeByClientId(clientId) : undefined;
  };

  private getCreatedOrUpdatedNode = (modelName: keyof NodeRegistry, data: TAliasedNodeData): Node => {
    const IDF = this.getIDF(modelName);
    let NODE = this.getNode(modelName, IDF);
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

  public getOrCreateAggregator = (ref: AggregatorRef) => {
    const { fieldName, modelName, parentNodeClientId } = ref;
    const id = `${fieldName}${modelName}${parentNodeClientId ?? "null"}`;
    let aggregator = this.CONNECTIONS_AGGREAGORS.get(id);
    if (!aggregator) {
      this.CONNECTIONS_AGGREAGORS.set(id, new ConnectionRoot(this.STORE, ref));
    };
    return this.CONNECTIONS_AGGREAGORS.get(id)!;
  }

  /** 
   * Creates of overwrites the internal connection with the data recieved from the server 
   * */
  public getCreatedOrUpdatedConnection = (ref: ConnectionRef, data: TAliasedConnectionData) => {
    const aggregator = this.getOrCreateAggregator(ref);
    const { modelName } = ref;
    const { edges } = data;
    edges?.forEach(edge => {
      const { node, ...rest } = edge;
      if (node) {
        // create or update the relevant nodes
        this.getCreatedOrUpdatedNode(modelName, node);
      }
    });
    // create or updat ethe connection data
    aggregator.createOrUpdateConnection(ref, data);
    return aggregator.getConnection(ref)!;
  };


  public getConnection = (ref: ConnectionRef) => {
    const aggregator = this.getOrCreateAggregator(ref);
    return aggregator.getConnection(ref.variables);
  };


  public parseGraphQlDocument = (source: RequestDocument, options?: ParseOptions | undefined) => {
    const AST = typeof source === "object" ? source : parse(source);
    const connections: Map<string, {
      fieldName: string,
      variables: Variables
    }> = new Map();
    const connectionAliasRegex = /^[A-Z][a-zA-Z]*Connection.*/;

    visit(AST, {
      // Only process operation definitions (queries, mutations, subscriptions)
      OperationDefinition: {
        enter(node: OperationDefinitionNode) {
          // Traverse through the selection set of the operation
          node.selectionSet.selections.forEach((selection) => {
            if (selection.kind === 'Field') {
              const field: FieldNode = selection;

              // Check if the field has an alias and if it matches the connection naming convention
              if (field.alias && connectionAliasRegex.test(field.alias.value)) {
                const alias = field.alias.value;
                const variables: Variables = {};

                // Collect arguments (variables) of the connection field
                field.arguments?.forEach((arg) => {
                  if (arg.value.kind === 'IntValue' || arg.value.kind === 'StringValue') {
                    // Store only integer and string values for simplicity; adjust as needed
                    variables[arg.name.value] = arg.value.value;
                  }
                });

                if (connections.has(alias)) {
                  throw new Error(`${ADDON_PREFIX}: Duplicate connection identifier ${alias}`);
                };
                // Add the connection and its variables to the map
                connections.set(alias, {
                  fieldName: field.name.value,
                  variables: variables
                });
              }
            }
          });
        },
      },
    });
    return connections;
  }


  public serialize = (
    aliases: Map<string, { fieldName: string, variables: Variables }>,
    data: Record<string, unknown>,
    parentNode?: Node,
    fieldNameOnParent?: RelationshipField["propertyName"],
    skipNodeEncapsulationOnConnections: boolean = false,
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
            parentNodeClientId: parentNode?.CLIENT_ID,
          };
          const CONNECTION = this.getCreatedOrUpdatedConnection(ref, value as TAliasedConnectionData);
          // TODO: handle to-many relation registration
          const { edges, ...rest } = value as TAliasedConnectionData;
          edges?.forEach(edge => {
            const node = edge.node;
            if (node) {
              const IDF = this.getIDF(modelName);
              this.serialize(aliases, node, parentNode, variables.fieldName, !skipNodeEncapsulationOnConnections, false);
            }
          });
          // overwrite the data with encapsulated value
          toOutput(output, encloseInOutput, {
            [key]: CONNECTION
          })
        };
        if (type === "Node") {
          const nodeData = value as TAliasedNodeData
          if (!skipNodeEncapsulationOnConnections) {
            // for performance improvement skip node encapuslation, because it was already done inside getCreatedOrUpdatedConnection
            const currentNode = this.getCreatedOrUpdatedNode(modelName, nodeData);
            Object.values(NodeType.Meta).forEach(field => {
              if (field.fieldType === "relationship"){
                if (field.relationshipType === "belongsTo"){
                  this.updateToOneRelations(currentNode, field.propertyName, null)

                  // TODO CONTINUE FROM HERE <---------- 
                }
              }
            })
          }
          const IDF = this.getIDF(modelName);
          // potentially, this should never happen
          if (!this.IDENTIFIER_TO_CLIENT_ID.get(nodeData[IDF])) {
            throw new Error(`${ADDON_PREFIX}: No "CLIENT_ID" found for ${capitalize(camelize(modelName))} with ${IDF} = ${nodeData[IDF]}`);
          };
          const currentNode = this.getNodeByClientId(this.IDENTIFIER_TO_CLIENT_ID.get(nodeData[IDF])!)!;
          this.serialize(aliases, nodeData, currentNode, variables.fieldName, false, false);
          toOutput(output, encloseInOutput, {
            [key]: this.getNode(modelName, nodeData[IDF]),
          });
        }
      } else {
        toOutput(output, true, {
          [key]: value,
        });
      };
    });
    return output;
  };


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
  }

  /** Creates/updates to-one backward relations on many-to-one relations */
  private updateOneToManyRelations = (
    parentNode: Node,
    fieldName: RelationshipField["propertyName"],
    childNodes: Node[]
  ) => {
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
            const IDF = this.getIDF(typeName);
            if (record[IDF]) {
              const node = this.getNode(typeName, IDF);
              if (node) {
                this.addFieldError(node, fieldErrorField, error.message);
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

  public updatefieldState = (node: Node, fieldName: typeof Node.Meta[string]["dataKey"], status: PartialFieldStatusUpdate) => {
    const field = this.stateForField(node, fieldName);
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

  public stateForField = (node: Node, fieldName: typeof Node.Meta[string]["dataKey"]): FieldStatus => {
    return this.FIELD_STATE.get(node.CLIENT_ID)![fieldName]!;
  };

  /**
   * Returns true if any of the fields is not loaded or has no registered state
   */
  public getStateForNodeFields = (clientId: Node["CLIENT_ID"]): boolean => {
    const state = this.FIELD_STATE.get(clientId);
    return state ? Object.values(state).some(status => {
      status.loaded === false
    }) : true;
  }

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

}
