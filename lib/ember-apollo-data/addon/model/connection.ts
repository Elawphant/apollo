import { Node } from 'ember-apollo-data/model';
import { Edge, type TRelayEdgeData } from './edge';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import { tracked } from 'tracked-built-ins';
import { identifyConnection, type RootQueryDescription } from 'ember-apollo-data/-private/util';
import { Queryable } from './queryable';
import type { TRelayPageInfo } from './page-info';
import { AutoGraph } from 'ember-apollo-data/configurators/graph-author/author';
import { getOwner, setOwner } from '@ember/owner';


export interface TRelayConnectionData {
  edges: TRelayEdgeData[],
  pageInfo: TRelayPageInfo,
  [key: string]: any,
}

export class Connection extends Queryable {
  declare store: EADStoreService;

  declare parentNode?: Node;
  declare fieldNameOnParent?: string;

  declare modelName: string;
  declare queryParams: object;

  @tracked connectionInfo: any;

  get NodeType() {
    return this.store.modelFor(this.modelName);
  }

  @tracked
  private __addedNodes: Node[] = [];
  @tracked
  private __removedNodes: Node[] = [];

  @tracked
  declare pageInfo: TRelayPageInfo;

  @tracked
  private __internalReferences: Map<Node, Edge> = new Map();

  constructor(
    store: EADStoreService,
    modelName: string,
    queryParams: object,
    parentNode?: Node,
    fieldNameOnParent?: string,
  ) {
    super();
    const owner = getOwner(store)!
    setOwner(this, owner);
    this.store = owner.lookup(`service:${store.NAME}`) as EADStoreService;
    this.modelName = modelName;
    this.queryParams = queryParams;
    this.parentNode = parentNode;
    this.fieldNameOnParent = fieldNameOnParent;
    const variables: { [modelName: string]: RootQueryDescription }[] = this.parentNode
      ? [{
        [this.modelName]: {
          type: "connection",
          variables: this.queryParams,
        }
      }]
      : [{
        [(this.parentNode!.constructor as typeof Node).modelName]: {
          type: "node",
          variables: this.queryParams,
          fields: [`${this.fieldNameOnParent!}`],
        }
      }]
    this.autoGraph = new AutoGraph(owner, this.store.NAME, variables)
  }

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
      if (!this.__removedNodes.includes(node)){
        this.__removedNodes.push(node);
      }
    });
  };


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
  };

  get CLIENT_ID(): string {
    return identifyConnection({
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

  public encapsulate = (data: TRelayConnectionData): void => {
    const {edges, ...rest} = data;
    this.connectionInfo = rest;
    edges.forEach(edgeData => {
      const { node, ...rest } = edgeData;
      const edge = new Edge(rest);
      const NodeInstance = this.store.node(this.modelName, node);
      this.__internalReferences.set(NodeInstance, edge);
    });
  }

}
