import { service } from '@ember/service';
import { Node } from 'ember-apollo-data/model';
import { Edge, type TRelayEdgeData } from './edge';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import { TrackedArray, TrackedMap, tracked } from 'tracked-built-ins';
import { identifyObject } from 'ember-apollo-data/-private/util';
import {
  confgureOperationDependencies,
  configureConnectionQuery,
  configureConnectionVariables,
  configureNodeFragment,
  configureNodeQuery,
  configureNodeVariables,
} from 'ember-apollo-data/-private/configurators';
import type { RelationshipField } from './field-mappings';
import { ApolloError, NetworkStatus, gql } from '@apollo/client';
import { getOwner } from '@ember/owner';
import type ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import type {
  TRelayEdge,
  TRelayPageInfo,
} from '@apollo/client/utilities/policies/pagination';
import { capitalize, dasherize } from '@ember/string';
import type { GraphQLError } from 'graphql';
import { addObserver, removeObserver } from '@ember/object/observers';
import { Queryable } from './queryable';

export class Connection extends Queryable {
  @service('ead-store') declare store: EADStoreService;

  declare parentNode?: Node;
  declare fieldNameOnParent?: string;

  declare modelName: string;
  declare queryParams: object;

  get NodeType() {
    return this.store.modelFor(this.modelName);
  }

  private __addedNodes = new TrackedArray<Node>([]);
  private __removedNodes = new TrackedArray<Node>([]);

  /**
   * Adds Nodes to the connection without persisting to the database
   * This method should be called for managing local state of the connection
   */
  public addNodes = (...nodes: Node[]) => {
    nodes.forEach((node) => {
      if (this.__removedNodes.includes(node)) {
        this.__removedNodes.splice(this.__removedNodes.indexOf(node), 1);
      }
    });
    this.__addedNodes.push(...nodes);
  };

  public removeNodes = (...nodes: Node[]) => {
    nodes.forEach((node) => {
      if (this.__addedNodes.includes(node)) {
        this.__addedNodes.splice(this.__addedNodes.indexOf(node), 1);
      }
    });
    this.__removedNodes.push(...nodes);
  };

  @tracked
  declare pageInfo: TRelayPageInfo;

  private __internalReferences: Map<Node, Edge> = tracked(Map);

  /**
   * Configures the connection
   * @param modelName
   * @param queryParams
   * @param parentNode
   * @param fieldNameOnParent
   */
  public configure = (
    modelName: string,
    queryParams: object,
    parentNode?: Node,
    fieldNameOnParent?: string,
  ): void => {
    this.modelName = modelName;
    this.queryParams = queryParams;
    this.parentNode = parentNode;
    this.fieldNameOnParent = fieldNameOnParent;
    this.query();
  };

  get CLIENT_ID(): string {
    return identifyObject({
      modelName: this.modelName,
      queryParams: this.queryParams,
      parentNodeId: this.parentNode?.id,
      fieldNameOnParent: this.fieldNameOnParent,
    });
  }

  get edges(): Edge[] {
    return Array.from(this.__internalReferences).map(([node, edge]) => {
      return edge;
    });
  }

  get nodes(): Node[] {
    const nodes = [
      ...Array.from(this.__internalReferences).map(([node, edge]) => node),
      ...this.__addedNodes,
    ].filter((node) => !this.__removedNodes.includes(node));
    return nodes;
  }

  @tracked
  isLoading: boolean = false;

  @tracked
  declare networkStatus: NetworkStatus;

  configureConnectionQueryOperation = (index: number = 0): string => {
    const NodeConstructor = this.NodeType;
    const { suffix, fragment, variables } = confgureOperationDependencies(
      this.store,
      NodeConstructor,
      '',
      index.toString(),
    );
    const query = configureConnectionQuery(
      this.store,
      NodeConstructor.modelName,
      '',
      suffix,
    );
    const operation = `
      ${fragment}
      query ${this.NodeType.name}ConnectionQueryOperation (${variables.join(
      ', ',
    )}) {
      ${query}
      }
    `;
    return operation;
  };

  configureRelationQueryOperation = (index: number = 0) => {
    assert(
      `Cannot configure query on relation connection without a 'parentNode' and 'fieldNameOnParent!`,
      this.parentNode && this.fieldNameOnParent,
    );
    const ParentNodeType = this.parentNode.constructor as typeof Node;
    const ConnectionFieldNodeType = this.store.modelFor(
      (
        ParentNodeType.Meta[
        this.fieldNameOnParent as string
        ] as RelationshipField
      ).modelName,
    );
    const suffix = index.toString();
    const prefix = `${ParentNodeType.modelName}_${this.fieldNameOnParent}_`;
    const parentNodeVars = Object.values(
      configureNodeVariables('', suffix),
    ).map(([keyArg, varName]) => `$${keyArg}: ${varName}`);
    const connectionFieldVars = Object.values(
      configureConnectionVariables(ConnectionFieldNodeType, prefix, suffix),
    ).map(([keyArg, varName]) => `$${keyArg}: ${varName}`);
    const parentNodeQuery = configureNodeQuery(
      this.store,
      ParentNodeType.modelName,
      '',
      suffix,
      [this.fieldNameOnParent],
      prefix,
      suffix,
    );
    const connectionTypeFragment = configureNodeFragment(
      this.store,
      ConnectionFieldNodeType,
    );
    const operation = `
      ${connectionTypeFragment}
      query ${capitalize(this.fieldNameOnParent)}On${ParentNodeType.name
      }QueryOperation (${[...parentNodeVars, ...connectionFieldVars].join(
        ', ',
      )}) {
      ${parentNodeQuery}
      }
    `;
    return operation;
  };

  @tracked
  declare errors?: GraphQLError[];

  @tracked
  declare error?: ApolloError;

  public resetErrors = () => {
    this.error = this.errors = undefined;
  };

  public query = async (): Promise<void> => {
    this.isLoading = true;
    this.parentNode ? this.queryAsRelation() : this.queryAsRootConnection();
  };


  private encapsulate = (connection: {
    edges: TRelayEdgeData[];
    pageInfo: TRelayPageInfo;
  }) => {
    const edges = connection.edges;
    this.pageInfo = connection.pageInfo;
    edges.forEach((edge) => {
      const { node, ...otherFields } = edge;
      const edgeInstance = new Edge();
      edgeInstance.configure(otherFields);
      const nodeInstance = this.store.node(dasherize(node['__typename']), node);
      this.__internalReferences.set(nodeInstance, edgeInstance);
    });
  };

  /**
   * A default implementation of querying a relation on the node.
   * Queries the parent node only with the conection field.
   * The expected data is a node with connection data.
   * Returned nodes in the connection are again relationshipless.
   */
  private queryAsRelation = async () => {
    assert(
      `
      Connections without parent node should be queried only via 'queryAsRootConnection' method!
      `,
      this.parentNode,
    );
    // No need to query the server, if parentNode is new.
    if (this.parentNode.isNew) {
      return;
    };
    // do not dispatch queries if a query is already dispatched
    const operation = this.configureRelationQueryOperation();
    const promise = this.registerQuery(this.store.client.query({
        query: gql(operation),
        variables: {
          id0: this.parentNode.id,
          ...this.queryParams,
        },
      }));
    const { data, errors, error, loading, networkStatus, partial } = await promise;
    this.networkStatus = networkStatus;
    this.isLoading = loading;

    // TODO maybe implement error encapsulation
    this.error = error;
    this.errors = errors as unknown as GraphQLError[];

    if (data) {
      // remove previous errors
      this.resetErrors();
      const parentData = data[Object.keys(data)[0]!];
      Object.keys(data).forEach((fieldName) => {
        this.encapsulate(parentData[`${this.NodeType.name}Connection0`]);
      });
    }
    this.resetQueryInProgress();
  };

  private queryAsRootConnection = async () => {
    assert(
      `
      Connections on nodes (i.e. relations) should be queried only via 'queryAsRelation' method!
    `,
      !this.parentNode,
    );
    const operation = this.configureConnectionQueryOperation();
    const promise = this.registerQuery(this.store.client.query({
      query: gql(operation),
      variables: this.queryParams,
    }));
    const { data, errors, error, loading, networkStatus, partial } = await promise;
    this.networkStatus = networkStatus;
    this.isLoading = loading;

    // TODO maybe implement error encapsulation
    this.error = error;
    this.errors = errors as unknown as GraphQLError[];

    if (data) {
      // remove previous errors
      this.resetErrors();
      // Since the purpose of connection.query method is to query single connection,
      // here we assume there is only single connection key.
      Object.keys(data).forEach((connection) => {
        this.encapsulate(data[connection]);
      });
    }
    this.resetQueryInProgress();
  };

}
