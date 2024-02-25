import type { AggregatorRef, ConnectionRef, InternalConnectionData, Node, TAliasedConnectionData, TRelayEdgeData } from "./types";
import type { TirService } from "ember-apollo-data/";
import { configure } from "ember-apollo-data/utils";
import type { Variables } from "graphql-request";
import type { NodeRegistry } from "./registry";
import { identifyConnection } from "ember-apollo-data/-private/util";
import { Connection } from "./connection";
import { tracked } from "tracked-built-ins";



/** Ensures the same node is node added to the list multiple times */
function shouldAddNode(node: Node, list: string[]) {
  return !list.includes(node.CLIENT_ID);
}


class ConnectionRoot {
  declare public readonly store: TirService;
  declare private readonly modelName: keyof NodeRegistry;
  declare private readonly fieldName: keyof Node & string;
  declare private readonly parentNodeClientId?: Node["CLIENT_ID"];


  declare private readonly NodeType: typeof Node;

  /** Variables string key to Connection */
  declare private readonly connections: Map<string, Connection>;

  /** variables string key to data */
  declare private readonly data: Map<string, InternalConnectionData>;

  /** All known nodes */
  public get records() {
    return [...Array.from(this.connections.values()).map(connection => [...connection])].flat();
  };

  declare public readonly identificator: `${string}:${keyof NodeRegistry}:${Node["CLIENT_ID"] | null}`;

  public get isRelation() {
    return Boolean(this.parentNodeClientId);
  }

  @tracked
  private added: Node["CLIENT_ID"][] = [];

  @tracked
  private removed: Node["CLIENT_ID"][] = [];

  declare private internalConnections: Map<number, Node["CLIENT_ID"]>;

  constructor(store: TirService, ref: AggregatorRef) {
    configure(store, this);
    this.connections = new Map();
    const { modelName, fieldName, parentNodeClientId } = ref;
    this.modelName = modelName;
    this.NodeType = this.store.modelFor(modelName)!;
    this.fieldName = fieldName;
    this.parentNodeClientId = parentNodeClientId;
    this.identificator = `${fieldName}:${modelName}:${parentNodeClientId ?? null}`;
  };

  public identifyConnection = (variables: Variables) => {
    return identifyConnection(variables);
  }

  public getConnection = (variables: Variables) => {
    const id = String(variables);
    return this.connections.get(id) ? new Proxy(this.connections.get(id)!, {}) : undefined;
  };

  public createOrUpdateConnection = (variables: Variables, data: TAliasedConnectionData) => {
    const id = this.identifyConnection(variables);
    let connection = this.connections.get(id);
    if (!connection) {
      const connection = new Connection(this.store, {
        modelName: this.modelName,
        fieldName: this.fieldName,
        variables: variables,
        parentNodeClientId: this.parentNodeClientId
      });
      this.connections.set(id, connection);
    };
    const internalConnectionData: InternalConnectionData = {
      records: [],
      connectionData: {},
      edges: new Map()
    };
    const { edges, ...connectionFields } = data;
    Object.assign(internalConnectionData.connectionData, connectionFields);
    edges?.forEach(edge => {
      const IDF = this.store.getNodeIdentifier(this.modelName);
      const { node, ...edgeFields } = edge;
      if (node) {
        let record = this.store.getNode(this.modelName, node[IDF]);
        if (!record) {
          record = this.store.create(this.modelName);
        }
        internalConnectionData.records.push(record.CLIENT_ID);
      }
    });
    this.data.set(id, internalConnectionData);
    this.revert();
  };


  public get addedNodes() {
    return this.added.map(clientId => this.store.getNodeByClientId(clientId)).filter(node => node != undefined) as Node[];
  };

  public get removedNodes() {
    return this.removed.map(clientId => this.store.getNodeByClientId(clientId)).filter(node => node != undefined) as Node[];
  };

  public getNodes(connectionVariables: Variables) {
    const records = this.getConnectionData(connectionVariables)?.records ?? [];
    return records.map(clientId => this.store.getNodeByClientId(clientId))
      .filter(i => i != undefined) as Node[];
  }

  public getConnectionData = (variables: Variables) => {
    const id = String(variables);
    return this.data.get(id);
  }

  public add = (node: Node) => {
    if (shouldAddNode(node, this.added)) {
      this.added.push(node.CLIENT_ID);
    };
  };

  public removeNode = (node: Node) => {
    this.added.splice(this.added.indexOf(node.CLIENT_ID), 1);
    if (shouldAddNode(node, this.removed)) {
      this.removed.push(node.CLIENT_ID);
    };
  };

  public forgetNodes = (...nodeClientIds: Node["CLIENT_ID"][]) => {
    this.data.forEach(connectionData => {
      connectionData.records = connectionData.records
        .splice(0, connectionData.records.length, ...connectionData.records.filter(i => !nodeClientIds.includes(i)))
    });
  };

  public revert = () => {
    this.added.splice(0, this.added.length);
    this.removed.splice(0, this.removed.length);
  };


};


export { ConnectionRoot };