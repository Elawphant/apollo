import Service from '@ember/service';
import { getOwner, setOwner } from '@ember/application';
import Node, { type TRelayNodeData } from 'ember-apollo-data/model/node';
import ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { dasherize } from '@ember/string';
import { type RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { AttrField } from 'ember-apollo-data/model/field-mappings';
import { Connection } from 'ember-apollo-data/model';
import { type FieldProcessor } from 'ember-apollo-data/field-processor';
import { DefaultFieldProcessors } from 'ember-apollo-data/field-processors/default-field-processors';
import { tracked } from 'tracked-built-ins';
import InternalStore from 'ember-apollo-data/model/store';
import type { NodeRegistry } from 'ember-apollo-data/model-registry';
import { configureModelConstructor } from 'ember-apollo-data/configurators/node-type';
import { AutoGraph } from 'ember-apollo-data/configurators/graph-author/author';
import Client from 'ember-apollo-data/client/client';
import type { TRelayConnectionData } from 'ember-apollo-data/model/connection';
import type { TRelayEdgeData } from 'ember-apollo-data/model/edge';
import type { VariableDeclaration } from 'ember-apollo-data/configurators/graph-author/variables';

export default class EADStoreService extends Service {
  public declare client: Client;
  public declare internalStore: InternalStore;

  get NAME() {
    const [, serviceName] = this.toString().match(/service:(.*)::ember\d+/)!;
    return serviceName!;
  }

  @tracked
  private configuredNodeTypes: Map<keyof typeof NodeRegistry, typeof Node> =
    new Map();

  @tracked
  public CONNECTIONS = new Map<string, Connection>();

  @tracked
  public NODES = new Map<string, Node>();

  public connection = (
    modelName: string,
    queryParams: any,
    parentNode?: Node,
    fieldNameOnParent?: string,
    data?: any,
  ): Connection => {
    const connectionParams = {
      modelName: modelName,
      queryParams: queryParams,
      parentNodeId: parentNode?.id,
      fieldNameOnParent: fieldNameOnParent,
    };
    let connection = this.internalStore.getConection(connectionParams);
    if (!connection) {
      connection = new Connection(this, modelName, queryParams, parentNode, fieldNameOnParent);
      this.internalStore.addConnection(connection);
      connection = this.internalStore.getConection(connectionParams)!;
      if (data){
        connection.encapsulate(data);
        connection.setLoadedOnce();
      }
    }
    if (!connection.loaded) {
      connection.query();
    }
    return connection;
  };

  public node = (modelName: string, data?: TRelayNodeData): Node => {
    const NodeType = this.modelFor(modelName);
    const { id, ...rest } = data!;
    let node: Node | undefined;

    // try to get the same node encapsulator
    if (id) {
      node = this.internalStore.getNode(id);
    }
    // initialize a new encapsulator
    if (!node) {
      node = this.INITIALIZE_MODEL_INSTANCE(NodeType);
      this.internalStore.addNode(node);
    }
    if (id) {
      this.internalStore.identifyNode(node, id);
      if (rest){
        node.encapsulate(data!);
        node.setLoadedOnce();
      }
      if (!node.loaded && !node.isNew) {
        node!.query();
      }
      return this.internalStore.getNode(id)!;
    }
    return this.internalStore.getNodeByClientId(node.CLIENT_ID)!;
  };

  public init(): void {
    super.init();
    const ClientClass = (getOwner(this) as ApplicationInstance).resolveRegistration(`client:application`) as typeof Client;
    assert(`An ApplicationClient extending Client must be implemented.`, ClientClass);
    this.client = new ClientClass();
    this.internalStore = new InternalStore();
  }

  public save = async (saveables: Node[], onlyFields?: string[]) => {
    console.warn("Not Implemented")
  };


  query = async (
    queries: { [modelName: keyof typeof NodeRegistry]: RootQueryDescription }[],
    options: any = {},
  ): Promise<(Node|Connection)[] | undefined> => {
    // initialize a AutpGraph instance to prepare query
    const autoGraph = new AutoGraph(getOwner(this), this.NAME, queries);
    let result: (Node | Connection)[] = []
    try {
      const data = await this.client.request(
        autoGraph.configureOperaton(),
        autoGraph.configureOperationVariables(),
        options,
      ) as Record<string, TRelayConnectionData | TRelayNodeData>;
      const ConnectionStr = "Connection";
      const NodeStr = "Node";
      Object.entries(data).forEach(([alias, record]) => {
        const { __typename, ...rest } = record as TRelayConnectionData | TRelayNodeData;
        if (__typename) {
          const [name, index] = alias.split("_");
          // assume server responded with aliases we sent with the request
          assert(`Expected server to respond with submitted aliases, however, received data in a different form`, name && index)

          const variables = autoGraph.getVariables(index)!;
          let rootQueryParams: Record<string, any> = {};
          Object.entries(variables).forEach(([path, decl]) => {
            const level = path.split(".").length
            if (level === 1) {
              Object.assign(rootQueryParams, { [path]: decl });
            }
          });
          if (name!.endsWith(ConnectionStr)) {
            const modelName = dasherize(__typename.substring(0, __typename.indexOf(ConnectionStr)));
            const encapsulated = this.connection(modelName, rootQueryParams, undefined, undefined, record);
            result.push(encapsulated);
            (record as TRelayConnectionData).edges.forEach(edge => {
              const node = this.node(modelName, edge.node)!
              this.encapsulateRelations(variables, edge.node, node, 2);
            })
          } else if (__typename.endsWith(NodeStr)) {
            const modelName = dasherize(__typename);
            const encapsulated = this.node(modelName, record as TRelayNodeData);
            result.push(encapsulated);
            this.encapsulateRelations(variables, record, encapsulated, 2);
          }
        }
      });
      return result
    } catch (e) {
      //TODO handle errors
    }
  };

  private flattenRelationVariablePath = (variables: Record<string, any>, level: number): Record<string, any> => {
    const result: Record<string, any> = {}
    Object.entries(variables).forEach(([pathName, vars]) => {
      const path = pathName.split(".");
      if (path.length === level){
        const keyArg = path[-1]!
        Object.assign(result, {[keyArg]: vars});
      }
    });
    return result
  }

  private encapsulateRelations = (
    variables: Record<string, any>, 
    data: TRelayConnectionData | TRelayNodeData, 
    parentNode: Node, 
    nextLevel: number
  ) => {
    const ParentNodeType = parentNode.constructor as typeof Node;
    Object.entries(data).forEach(([fieldName, fieldValue]) => {
      const field = Object.values(ParentNodeType.Meta).find(field => field.dataKey === fieldName);
      // although server is not supposed to return a non-requested field, hence it cannot be undefined, but still
      if (field && field.fieldType === "relationship") {
        const { __typename, ..._ } = fieldValue;
        assert(`This field does not appear to be a relationship, the server responded without typename`, __typename)
        if (field.relationshipType === "belongsTo") {
          const node = this.node(field.modelName, fieldValue);
          this.internalStore.updatefieldState(parentNode, field.propertyName, { loaded: true, initialValue: node });
          this.internalStore.toBelongsToRelation(parentNode, field.propertyName, node);
          this.encapsulateRelations(variables, fieldValue, node, nextLevel + 1);
        } else if (field.relationshipType === "hasMany") {
          // we only need this for connections, because nodes are identified via id
          const rootQueryParams = this.flattenRelationVariablePath(variables, nextLevel);
          this.connection(field.modelName, rootQueryParams, parentNode, field.propertyName as string, fieldValue);
          // TODO implement a connection manager
          this.internalStore.updatefieldState(parentNode, field.propertyName, { loaded: true, initialValue: "$connection" });
          (fieldValue as TRelayConnectionData).edges.forEach(edge => {
            // use this.internalStore.getNode, because this.connection already did encapsulation
            const node = this.internalStore.getNode(edge.node.id)!;
            this.encapsulateRelations(variables, edge.node, node, nextLevel + 1);
          });
        }
      }
    });
  }


  // options are configured in your environment.js.
  public get options() {
    // config:environment not injected into tests, so try to handle that gracefully.
    const config = (getOwner(this) as ApplicationInstance).resolveRegistration(
      'config:environment',
    ) as {
      ['ember-apollo-data']?: Record<string, string>;
      [key: string | number | symbol]: unknown;
    };
    if (config && config['ember-apollo-data']) {
      return config['ember-apollo-data'];
    }
    // else if (macroCondition(isTesting())) {
    //   return {
    //     apiURL: 'http://testserver.example/v1/graph',
    //   };
    // }
    throw new Error('No Apollo service options are defined!');
  }

  /**
   * Creates in-memory cache object with default values, encapsulates it and returns a proxy to it.
   * If you need initial values, instead pass them via @attr options.defaultValue or the transformer that does encapsulation.
   * @param modelName
   * @param rootField
   * @param options
   * @returns
   */
  create = (modelName: string) => {
    const newNode = this.node(modelName);
    newNode.setDefaultData();
    return newNode;
  };

  public modelFor = (modelName: string): typeof Node => {
    if (!this.configuredNodeTypes.get(modelName)) {
      const RawModelConstructor = (
        getOwner(this) as ApplicationInstance
      ).resolveRegistration(`node:${modelName}`) as typeof Node | undefined;
      assert(
        `No model extending Node found for ${modelName}`,
        RawModelConstructor && typeof RawModelConstructor === typeof Node,
      );
      const shimInstance = new RawModelConstructor();
      const constructor = configureModelConstructor(shimInstance, modelName);
      this.configuredNodeTypes.set(modelName, constructor);
    }
    return this.configuredNodeTypes.get(modelName)!;
  };

  private INITIALIZE_MODEL_INSTANCE = (ModelConstructor: typeof Node): Node => {
    // initialize a node instance. at this point, it has no owner, no fragment, no fields
    const model = new ModelConstructor();
    // set owner
    const Meta = model.constructor.prototype.Meta;
    setOwner(model, getOwner(this));
    // pass the consturctor.Meta to instance._meta
    model._meta = Meta;
    Object.keys(Meta).forEach((fieldName) => {
      const propertyName: string = Meta[fieldName]!.propertyName;
      if (Meta[fieldName].fieldProcessorName) {
        // Lookup for defined field processor in field processors
        let Processor = getOwner(this).lookup(
          `field-processor:${Meta[fieldName].fieldProcessorName}`,
        ) as typeof FieldProcessor | undefined;
        // Try looking up in default field processors
        if (!Processor) {
          Processor =
            DefaultFieldProcessors[Meta[fieldName].fieldProcessorName];
        }
        assert(
          `No field processor with name "${Meta[fieldName].fieldProcessorName}" was found.`,
          Processor,
        );
        if (Processor) {
          // initialize a field processor and set it on _meta
          (model._meta[fieldName] as AttrField).fieldProcessor = new Processor(
            getOwner(this),
          )!;
        }
      }

      // const { getter, setter } = trackedData<T, K>(key, desc && desc.initializer);

      // define property getters and setter on the instance
      Object.defineProperty(model, propertyName, {
        get: Meta[propertyName]!.getter,
        set: Meta[propertyName]!.setter,
        enumerable: true,
        configurable: true,
      });
    });
    // at this point our model encapsulates the data in apollo cache and is ready take off.
    return model;
  };
}

// Don't remove this declaration: this is what enables TypeScript to resolve
// this service using `Owner.lookup('service:ead-store')`, as well
// as to check when you pass the service name as an argument to the decorator,
// like `@service('ead-store') declare altName: EadStoreService;`.
declare module '@ember/service' {
  interface Registry {
    'ead-store': EADStoreService;
  }
}
