import Service from '@ember/service';

import { getOwner, setOwner } from '@ember/application';
import Node from 'ember-apollo-data/model/node';
import ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { registerDestructor } from '@ember/destroyable';
import {
  ApolloClient,
  InMemoryCache,
  gql,
  HttpLink,
  type NormalizedCacheObject,
  type DocumentNode,
  type MutationOptions,
  type TypePolicies,
  type ApolloClientOptions,
  type OperationVariables,
  ApolloError,
} from '@apollo/client';
import { capitalize, dasherize } from '@ember/string';
import { pluralize } from 'ember-inflector';
import { computed, get, set } from '@ember/object';
import {
  configureNodeFragment,
  configureModelConstructor,
  configureConnectionQuery,
  configureNodeMutation,
  configureMutationDependences,
  configureNodeQuery,
} from 'ember-apollo-data/-private/configurators';
import { relayStylePagination } from '@apollo/client/utilities';
import { PaginationKeyArgs } from 'ember-apollo-data/queries/pagination';
import { identifyObject } from 'ember-apollo-data/-private/util';
import type {
  AttrField,
  RelationshipField,
} from 'ember-apollo-data/model/field-mappings';
import { Connection } from 'ember-apollo-data/model';
import { type FieldProcessor } from 'ember-apollo-data/field-processor';
import { DefaultFieldProcessors } from 'ember-apollo-data/field-processors/default-field-processors';
import { tracked } from 'tracked-built-ins';
import InternalStore from 'ember-apollo-data/model/store';

const apollo_client_destructor = (destroyable: EADStoreService) => {
  if (
    destroyable.client &&
    typeof destroyable.client.clearStore === 'function'
  ) {
    destroyable.client.clearStore();
  }
};

export default class EADStoreService extends Service {
  public declare client: ApolloClient<NormalizedCacheObject>;

  private declare internalStore: InternalStore;


  @tracked
  public CONNECTIONS = new Map<string, Connection>();

  @tracked
  public NODES = new Map<string, Node>();

  public connection = (
    modelName: string,
    queryParams: any,
    parentNode?: Node,
    fieldNameOnParent?: string,
  ): Connection => {
    const connectionParams = {
      modelName: modelName,
      queryParams: queryParams,
      parentNodeId: parentNode?.id,
      fieldNameOnParent: fieldNameOnParent,
    };
    let connection = this.internalStore.getConection(connectionParams);
    if (!connection) {
      connection = new Connection();
      setOwner(connection, getOwner(this));
      connection.configure(
        modelName,
        queryParams,
        parentNode,
        fieldNameOnParent,
      );
      this.internalStore.addConnection(connection);
      return this.internalStore.getConection(connectionParams)!;
    }
    return connection!;
  };

  public node = (modelName: string, data?: any): Node => {
    const NodeType = this.modelFor(modelName);
    const nodeId: string | undefined = data ? data['id'] : undefined;
    let node: Node | undefined;

    // try to get the same node encapsulator
    if (nodeId) {
      node = this.internalStore.getNode(nodeId);
    }
    // initialize a new encapsulator
    if (!node) {
      node = this.INITIALIZE_MODEL_INSTANCE(NodeType);
      this.internalStore.addNode(node);
    }
    if (nodeId) {
      this.internalStore.identifyNode(node, nodeId)
      const fragment = configureNodeFragment(this, NodeType)
      const exists = this.client.readFragment({
        id: this.client.cache.identify({
          __typename: NodeType.name,
          id: nodeId,
        }),
        fragment: gql(fragment),
      });
      if (!exists) {
        node!.query();
      }
      return this.internalStore.getNode(nodeId)!;
    }
    return this.internalStore.getNodeByClientId(node.CLIENT_ID)!;
  };


  /**
   * No cache config is allowed. It is preconfigured, otherwise we get weird cache behavior
   * */
  public readonly APOLLO_CACHE_CONFIG = {
    typePolicies: {
      // Configure Connection type
      Connection: {
        keyFields: ['edges', 'pageInfo'],
      },
      // Configure Edge type
      Edge: {
        keyFields: ['node', 'cursor'],
      },
      // Configure Node type
      Node: {
        keyFields: ['id'],
      },
      // Add other type policies as needed
    },
  };

  public init(): void {
    super.init();
    this.client = new ApolloClient(this.clientOptions());
    this.internalStore = new InternalStore();
    registerDestructor(this, apollo_client_destructor);
  }

  /**
   * This is the options hash that will be passed to the ApolloClient constructor.
   * You can override it if you wish to customize the ApolloClient.
   * Overwriting `APOLLO_CACHE_CONFIG` and `link` will suffice most of the time instead of overwriting `clientOptions`
   * @method clientOptions
   * @return {!Object}
   * @public
   */
  public clientOptions = (): ApolloClientOptions<NormalizedCacheObject> => {
    return {
      cache: this.INITIALIZE_IN_MEMORY_CACHE(),
      link: this.link(),
    };
  };

  /**
   * Apollo Client Link
   * Overwrite this method for authorization and other stuff.
   * @returns { HttpLink } Apollo Client Link
   */
  public link = (): HttpLink => {
    const link = new HttpLink({
      uri: this.options['apiURL'],
    });
    return link;
  };

  /**
   * Initializes a cache with APOLLO_CACHE_CONFIG and default options
   * See <https://www.apollographql.com/docs/react/caching/cache-configuration> for more info
   * @returns { InMemoryCache } instance
   */
  private INITIALIZE_IN_MEMORY_CACHE = (): InMemoryCache => {
    return new InMemoryCache(this.APOLLO_CACHE_CONFIG);
  };

  /**
   * Adds type policy from given list of Node subclasses.
   *
   * **IMPORTANT !**
   *
   * ADD_TYPE_POLICIES method should be called before performing a Query or Mutation to enforce the TypePolicy.
   * @param { Array<typeof Node> } Nodes the array of Node subtypes to define the policies for/from.
   */
  private ADD_TYPE_POLICIES = (Nodes: (typeof Node)[]): void => {
    Nodes.forEach((cls) => {
      const newPolicy = this.CONFIGURE_TYPE_POLICIES(cls);

      if (this.client.cache instanceof InMemoryCache) {
        this.client.cache.policies.addTypePolicies(newPolicy);
      }
    });
  };

  private CONFIGURE_TYPE_POLICIES = (cls: typeof Node): TypePolicies => {
    const keyArgs = Object.keys(cls.APOLLO_CONFIG?.keyArgs || {});
    const policies = {
      [cls.name]: {
        keyFields: ['id'],
        fields: {
          [cls.APOLLO_CONFIG.queryRootField]: relayStylePagination([
            ...PaginationKeyArgs,
            ...Object.keys(keyArgs),
          ]),
        },
        // avoid setting field policies on fields, as we will be managing fields in the model via getters and setters
      },
    };
    return policies;
  };

  public save = async (saveables: Node[], onlyFields?: string[]) => {
    const map: {
      [key: string]: {
        mutation: string;
        data: any;
        inputTypeName: string;
        node: Node;
      };
    } = {};
    saveables.forEach((node, index) => {
      const { inputTypeName, mutationRootFieldName } =
        configureMutationDependences(node);
      const suffix = index.toString();
      const mutation = configureNodeMutation(
        this,
        node.__modelName__,
        mutationRootFieldName,
        '',
        suffix,
        onlyFields,
      );
      const data = {
        ['input' + suffix]: {
          clientMutationId: node.id,
          data: node.serialize(),
        },
      };
      map[node.id] = {
        mutation: mutation,
        data: data,
        inputTypeName: inputTypeName,
        node: node
      };
    });
    const operationVars = Object.values(map)
      .map(({ mutation, data, inputTypeName }, index) => {
        return `$input${index}: ${inputTypeName}!`;
      })
      .join(', ');
    const mutations = Object.values(map)
      .map(({ mutation, data, inputTypeName }) => mutation)
      .join('\n');
    const operation = `
      mutation MutationOperation(${operationVars}) {
        ${mutations}
      }
    `;
    saveables.map((node) => {
      node.isLoading = true;
    });
    const variables = Object.assign(
      {},
      ...Object.values(map).map(({ mutation, data, inputTypeName }) => data),
    );
    this.client.mutate({
      mutation: gql(operation),
      variables: variables,
    }).then((data) => {
      // update nodes and connections
      Object.values(data).forEach((dataField: any) => {
        const { clientMutationId, ...nodeData } = dataField;
        const node = map[clientMutationId]!.node;
        node.identifyNode(nodeData.id);
      });
    }).catch((failure) => {
      // TODO! implement errors
    });
  };

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
    const RawModelConstructor = (
      getOwner(this) as ApplicationInstance
    ).resolveRegistration(`node:${modelName}`) as typeof Node | undefined;
    assert(
      `No model extending Node found for ${modelName}`,
      RawModelConstructor && typeof RawModelConstructor === typeof Node,
    );
    const shimInstance = new RawModelConstructor();
    const constructor = configureModelConstructor(shimInstance, modelName);
    // configureTransformers(this, constructor);
    // add the type policy to the apollo cache.
    this.ADD_TYPE_POLICIES([constructor]);
    return constructor;
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
        let Processor = getOwner(this)
          .lookup(`field-processor:${Meta[fieldName].fieldProcessorName}`) as typeof FieldProcessor | undefined;
        // Try looking up in default field processors
        if (!Processor) {
          Processor = DefaultFieldProcessors[Meta[fieldName].fieldProcessorName];
        }
        assert(
          `No field processor with name "${Meta[fieldName].fieldProcessorName}" was found.`,
          Processor
        );
        if (Processor) {
          // initialize a field processor and set it on _meta
          (model._meta[fieldName] as AttrField).fieldProcessor = new Processor(getOwner(this))!;
        }
      }

      // const { getter, setter } = trackedData<T, K>(key, desc && desc.initializer);

      // define property getters and setter on the instance
      Object.defineProperty(model, propertyName, {
        get: Meta[propertyName]!.getter,
        set: Meta[propertyName]!.setter,
        enumerable: true,
        configurable: true,
      }
      );
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
