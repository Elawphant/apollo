import Service from '@ember/service';
import { getOwner } from '@ember/application';
import Node from 'ember-apollo-data/model/node';
import ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { Connection } from 'ember-apollo-data/model';
import { TirStore } from 'ember-apollo-data/model/tir-store';
import { TirClient } from 'ember-apollo-data/client/tir-client';
import type { AggregatorRef, GraphQlErrorData, TAliasedNodeData } from 'ember-apollo-data/model/types';
import type { NodeRegistry } from 'ember-apollo-data/model/registry';
import type { RequestDocument, RequestOptions, Variables } from 'graphql-request';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { GraphQLClientRequestHeaders } from 'ember-apollo-data/client/types';
import { GraphQLError } from 'graphql';

export default class TirService extends Service {
  public declare client: TirClient;
  public declare internalStore: TirStore;

  public getNodeIdentifier(modelName: keyof NodeRegistry) {
    return this.internalStore.getIDF(modelName);
  }

  public getConnectionRoot = (ref: AggregatorRef) => {
    return this.internalStore.getOrCreateAggregator(ref)
  };

  public getNode = (modelName: keyof NodeRegistry, primaryKey: string) => {
    return this.internalStore.getNode(modelName, primaryKey);
  }

  public getNodeByClientId = (clientId: Node["CLIENT_ID"]) => {
    return this.internalStore.getNodeByClientId(clientId);
  };

  public init(): void {
    super.init();
    const ClientClass = (getOwner(this) as ApplicationInstance).resolveRegistration(`client:application`) as typeof TirClient | undefined;
    assert(`An ApplicationClient extending Client must be implemented.`, ClientClass);
    this.client = new ClientClass(getOwner(this));
    this.internalStore = new TirStore(this);
  }

  public save = async (saveables: Node[], onlyFields?: string[]) => {
    console.warn("Not Implemented");
  };


  /**
   * Removes all connections of same type relate to the inputted one from the internalStore, including the inutted connection.
   * 
   * If the inputted connection is a relation, this method will affect only relations on the parent node.
   * 
   * If `includeCurrent` is false, the inputted connection will not be removed.
   */
  public clearRelatedConnections = (connection: Connection, includeCurrent: boolean = true) => {
    // this.internalStore.invalidateAllInterrelatedConnections(connection, includeCurrent);
  }


  public request = async (document: RequestDocument | TypedDocumentNode<unknown, Variables>, variables?: Variables | undefined, requestHeaders?: GraphQLClientRequestHeaders | undefined) => {
    const map = this.internalStore.parseGraphQlDocument(document);
    try {
      const response = await this.client.request(document, variables, requestHeaders) as { data: Record<string, any>, errors: GraphQlErrorData };
      return this.internalStore.serialize(map, response);
    } catch (e) {
      throw e;
    };
  }


  public getStateForNodeFields = (clientId: Node["CLIENT_ID"]) => {
    return this.internalStore.getStateForNodeFields(clientId);
  }

  /**
   * Creates in-memory cache object with default values, encapsulates it and returns a proxy to it.
   * If you need initial values, instead pass them via @attr options.defaultValue or the transformer that does encapsulation.
   * @param modelName
   * @param rootField
   * @param options
   * @returns
   */
  create = (modelName: keyof NodeRegistry) => {
    return this.internalStore.createNode(modelName)!;
  };


  addNode = (modelName: string, data: TAliasedNodeData): Node => {
    return this.internalStore.addNode(modelName, data);
  };

  public modelFor = (modelName: string): typeof Node => {
    return this.internalStore.modelFor(modelName);
  };

}

// Don't remove this declaration: this is what enables TypeScript to resolve
// this service using `Owner.lookup('service:ead-store')`, as well
// as to check when you pass the service name as an argument to the decorator,
// like `@service('ead-store') declare altName: TirService;`.
declare module '@ember/service' {
  interface Registry {
    'ead-store': TirService;
  }
}
