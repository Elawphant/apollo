import { tracked } from "tracked-built-ins";
import { Connection, Node } from ".";
import { assert } from "@ember/debug";
import { identifyObject } from "ember-apollo-data/-private/util";





export default class InternalStore {

  @tracked
  private localToNode: Map<string, Node> = new Map();

  @tracked
  private idToLocal: Map<string, string> = new Map();

  @tracked 
  private connections: Map<string, Connection> = new Map();

  public addNode = (node: Node): void => {
    this.localToNode.set(node.CLIENT_ID, node);
  }

  public removeNode = (node: Node): void => {
    this.localToNode.delete(node.CLIENT_ID)
  }

  public identifyNode = (node: Node, id: string) => {
    node.identifyNode(id);
    this.idToLocal.set(id, node.CLIENT_ID);
  }

  public getNode = (id: string): Node | undefined => {
    const key = this.idToLocal.get(id);
    return (key && this.localToNode.get(key)) ? new Proxy(this.localToNode.get(key) as Node, {}) : undefined;
  }

  public getNodeByClientId = (clientId: string): Node | undefined => {
    return this.localToNode.get(clientId);
  }

  public addConnection = (connection: Connection) => {
    this.connections.set(connection.CLIENT_ID, connection);
  }

  public removeConnection = (connecection: Connection) => {
    this.connections.delete(connecection.CLIENT_ID);
  }

  public getConection = (connectionParams: {
    modelName: string,
    queryParams: any,
    parentNodeId?: string,
    fieldNameOnParent?: string,
  }): Connection | undefined => {
    const key = identifyObject(connectionParams);
    const connection = this.connections.get(key);
    return connection ? new Proxy(connection, {}) : undefined; 
  }

  

}