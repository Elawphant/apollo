import Service from '@ember/service';
import { getOwner } from '@ember/application';
import Node from 'ember-apollo-data/model/node';
import ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { Connection } from 'ember-apollo-data/model';
import { InMemoryCache } from 'ember-apollo-data/caches/in-memory';
import { TirClient } from 'ember-apollo-data/client/tir-client';
import type { ConnectionRootRef, GraphQlErrorData, TAliasedNodeData } from 'ember-apollo-data/model/types';
import type { NodeRegistry } from 'ember-apollo-data/model/registry';
import type { RequestDocument, Variables } from 'graphql-request';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { GraphQLClientRequestHeaders } from 'ember-apollo-data/client/types';
import { AbortablePromise } from 'ember-apollo-data/promise/promise';
import type { AttrField, RelationshipField } from 'ember-apollo-data/model/field-mappings';

export default class TirService extends Service {
  private declare client: TirClient;
  private declare internalStore: InMemoryCache;

  /**
   * @Returns dasherized name of the service.
   * Used for Service injection in the addon dependencies.
   * Since Ember services do not have built-in property that returns the dasherized name of the service, 
   * we compute it once and use via `utils/configure`
   */
  declare private __SERVICE_NAME: string;

  public get SERVICE_NAME() {
    return this.__SERVICE_NAME;
  }

  /**
   * Sets the name of the SERVICE_NAME.
   * 
   * **N.B. the `getter` is *public*, but the `setter` is *private* 
   * becasue it is set only inside `this.init()`**;
   */
  private set SERVICE_NAME(name: string){
    if (!this.__SERVICE_NAME){
      this.__SERVICE_NAME = name
    }
  }

  public getIDInfo(modelName: keyof NodeRegistry) {
    return this.internalStore.getIDInfo(modelName);
  }

  public getConnectionRoot = (ref: ConnectionRootRef) => {
    return this.internalStore.getConnectionRoot(ref)
  };

  public getNode = (modelName: keyof NodeRegistry, primaryKey: string) => {
    return this.internalStore.getNode(modelName, primaryKey);
  }

  public getNodeByClientId = (clientId: Node["CLIENT_ID"]) => {
    return this.internalStore.getNodeByClientId(clientId);
  };

  public getStateForNodeAttr = (clientId: Node["CLIENT_ID"], fieldName: AttrField["propertyName"]) => {
    return this.internalStore.stateForField(clientId, fieldName)
  };

  public updateToManyRelation = (
    parentNode: Node,
    fieldName: RelationshipField["propertyName"],
    childNodes: Node[]
  ): void => {
    this.internalStore.updateList(parentNode, fieldName, childNodes);
  }

  public getToManyRelation = (
    modelName: keyof NodeRegistry,
    fieldName: RelationshipField["propertyName"],
    clientId: Node["CLIENT_ID"]
  ) => {
    return new Proxy(this.internalStore.getList(modelName, fieldName, clientId), {});
  }

  public init(): void {
    super.init();
    const ClientClass = (getOwner(this) as ApplicationInstance).resolveRegistration(`client:application`) as typeof TirClient | undefined;
    assert(`An ApplicationClient extending Client must be implemented.`, ClientClass);
    this.client = new ClientClass(getOwner(this));
    this.internalStore = new InMemoryCache(this);
    const [, serviceName] = this.toString().match(/service:(.*)::ember\d+/)!;
    assert(`Cannot initialize ${this.constructor.name ?? this.toString()} without proper naming.`, serviceName)
    this.SERVICE_NAME = serviceName as string;
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
  };


  public request = async (
    document: RequestDocument | TypedDocumentNode<unknown, Variables>,
    variables?: Variables | undefined,
    requestHeaders?: GraphQLClientRequestHeaders | undefined
  ) => {
    const map = this.internalStore.parseGraphQlDocument(document);

    // Create an AbortablePromise
    const abortablePromise = new AbortablePromise<{ data?: Record<string, any>, errors?: GraphQlErrorData }>((resolve, reject, signal) => {
      // Assuming this.client.request supports an abort signal as an argument
      this.client.request({
        document: document,
        variables: variables,
        requestHeaders: requestHeaders,
        signal: signal
      }) // next line
        .then(response => {
          let { data, errors } = response as Record<string, any>;
          if (data) {
            data = this.internalStore.serialize(map, data);
            if (errors) {
              this.internalStore.encapsulateFieldErrors(data, errors);
              errors.forEach((error: GraphQlErrorData) => console.error(error));
            };
          };
          resolve({ data, errors });
        }) // next line
        .catch(error => {
          if (error.name === 'AbortError') {
            // Log abortion as error
            console.error('Fetch aborted');
          } else {
            // handle as standard error
            reject(error);
          }
        });
    });
    return abortablePromise;
  };

  public getStateForNodeFields = (clientId: Node["CLIENT_ID"]) => {
    return this.internalStore.getStateForNodeFields(clientId);
  };

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

  public revertNode = (node: Node) => {
    this.internalStore.revert(node.CLIENT_ID);
  }

  public getRemovedNodes = (): Set<Node["CLIENT_ID"]> => {
    return this.internalStore.getRemovedNodes();
  }

  public markNodeForRemoval = (clientId: Node["CLIENT_ID"]): void => {
    this.internalStore.markNodeForRemoval(clientId);
  }

};

// Don't remove this declaration: this is what enables TypeScript to resolve
// this service using `Owner.lookup('service:ead-store')`, as well
// as to check when you pass the service name as an argument to the decorator,
// like `@service('ead-store') declare altName: TirService;`.
declare module '@ember/service' {
  interface Registry {
    'tir': TirService;
  }
};
