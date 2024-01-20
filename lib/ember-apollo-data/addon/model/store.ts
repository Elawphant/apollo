import { tracked } from 'tracked-built-ins';
import { Connection, Node } from '.';
import { identifyConnection } from 'ember-apollo-data/-private/util';
import type { RelationshipField } from './field-mappings';
import { assert } from '@ember/debug';


const RELATION_KEY_SPLITTER = "::";


export interface FieldStatus {
  loaded: boolean,
  initialValue: any,
  changed: boolean,
}

type PartialFieldStatusUpdate = {
  [K in keyof FieldStatus]?: FieldStatus[K];
};

export default class InternalStore {
  @tracked
  private localToNode: Map<string, Node> = new Map();

  @tracked
  private toOneRelations: Map<string, string | null> = new Map();

  @tracked
  private idToLocal: Map<string, string> = new Map();

  @tracked
  private connections: Map<string, Connection> = new Map();

  @tracked private fieldsState: Map<string, { [fieldName: string]: FieldStatus }> = new Map();

  public addNode = (node: Node): void => {
    this.localToNode.set(node.CLIENT_ID, node);
    const NodeType = node.constructor as typeof Node;
    const meta = NodeType.Meta
    Object.values(meta).forEach(field => {
      if (field.fieldType === "relationship" && field.relationshipType === "belongsTo") {
        this.toBelongsToRelation(node, field.propertyName, null);
      }
    })
  };

  public removeNode = (node: Node): void => {
    this.localToNode.delete(node.CLIENT_ID);
    this.toOneRelations.delete(node.CLIENT_ID);
    this.idToLocal.delete(node.id);
  };

  public identifyNode = (node: Node, id: string) => {
    node.identifyNode(id);
    this.idToLocal.set(id, node.CLIENT_ID);
  };

  public getNode = (id: string): Node | undefined => {
    const key = this.idToLocal.get(id);
    return key && this.localToNode.get(key)
      ? new Proxy(this.localToNode.get(key) as Node, {})
      : undefined;
  };

  public getNodeByClientId = (clientId: string): Node | undefined => {
    return this.localToNode.get(clientId);
  };

  public addConnection = (connection: Connection) => {
    this.connections.set(connection.CLIENT_ID, connection);
  };

  public removeConnection = (connecection: Connection) => {
    this.connections.delete(connecection.CLIENT_ID);
  };

  public getConection = (connectionParams: {
    modelName: string;
    queryParams: any;
    parentNodeId?: string;
    fieldNameOnParent?: string;
  }): Connection | undefined => {
    const key = identifyConnection(connectionParams);
    const connection = this.connections.get(key);
    return connection ? new Proxy(connection, {}) : undefined;
  };

  private keyForBelongsTo = (clientId: string, relationName: string) => {
    return relationName + RELATION_KEY_SPLITTER + clientId
  }

  public toBelongsToRelation = (parentNode: Node, fieldName: string, relatedNode: Node | null) => {
    const NodeType = parentNode.constructor as typeof Node;
    const meta = NodeType.Meta;
    assert(`${fieldName} is not declared as to-one relation on ${NodeType.name}`,
      meta[fieldName]?.fieldType === "relationship"
      && (meta[fieldName] as RelationshipField)!.relationshipType === "belongsTo");

    const field = meta[fieldName] as RelationshipField;
    const parentKey = this.keyForBelongsTo(parentNode.CLIENT_ID, fieldName);
    const newChildKey = relatedNode ? this.keyForBelongsTo(relatedNode.CLIENT_ID, field.inverse) : null;
    const currentChildKey = this.toOneRelations.get(parentKey);
    // first handle the inverse change
    if (currentChildKey !== newChildKey) {
      //remove existing relation
      if (currentChildKey) {
        this.toOneRelations.set(currentChildKey, null)
      }
      // add new relation
      if (newChildKey) {
        this.toOneRelations.set(newChildKey, parentKey);
      }
    }
    // handle relation change
    this.toOneRelations.set(parentKey, newChildKey);
  }

  public getRelatedNode = (parentNodeClientId: string, relationPropertyName: string) => {
    const belongsToRef = this.toOneRelations.get(this.keyForBelongsTo(parentNodeClientId, relationPropertyName));
    if (belongsToRef) {
      const clientId = belongsToRef.split(RELATION_KEY_SPLITTER)[1]!;
      const node = this.localToNode.get(clientId);
      if (node) {
        return new Proxy(node, {});
      }
    };
    return null;
  }

  public updatefieldState = (node: Node, fieldName: string, status: PartialFieldStatusUpdate) => {
    const newFieldStatus = Object.assign(this.stateForField(node.CLIENT_ID, fieldName), status) as FieldStatus;
    const oldStatus = this.fieldsState.get(node.CLIENT_ID) ?? {};
    const updatedStatus = Object.assign(oldStatus, { [fieldName]: newFieldStatus })
    this.fieldsState.set(node.CLIENT_ID, updatedStatus);
  }

  public stateForField = (clientId: string, fieldName: string): FieldStatus => {
    const node = this.fieldsState.get(clientId);
    const defaultStatus: FieldStatus = {
      loaded: false,
      initialValue: null,
      changed: false,
    };
    if (node && node[fieldName]) {
      return node[fieldName]!;
    }
    return defaultStatus;
  }

}
