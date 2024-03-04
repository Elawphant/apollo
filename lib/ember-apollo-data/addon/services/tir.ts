import Service from '@ember/service';
import { getOwner } from '@ember/application';
import ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { InMemoryCache } from 'ember-apollo-data/caches/in-memory';
import { TirClient } from 'ember-apollo-data/client/tir-client';
import type { RootRef, GraphQlErrorData, ClientId, Pod } from 'ember-apollo-data/model/types';
import type { PodRegistry } from 'ember-apollo-data/model/registry';
import type { RequestDocument, Variables } from 'graphql-request';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import type { GraphQLClientRequestHeaders } from 'ember-apollo-data/client/types';
import { AbortablePromise } from 'ember-apollo-data/promise/promise';
import { ADDON_PREFIX, type EnvConfig } from 'ember-apollo-data/-private/globals';

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
  };

  /**
   * Configuration defined on ENV for this addon
   */
  declare private CONFIG: EnvConfig;

  public get config() {
    return this.CONFIG;
  };
  public set config(config: EnvConfig) {
    // set once
    if (!this.CONFIG){
      this.CONFIG = config;
    };
  };

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

  public getIDInfo(modelName: keyof PodRegistry) {
    return this.internalStore.getIDInfo(modelName);
  }

  public getRoot = (ref: RootRef) => {
    return this.internalStore.getRoot(ref);
  };

  public getPod = (modelName: keyof PodRegistry, primaryKey: string) => {
    return this.internalStore.getPod(modelName, primaryKey);
  }

  public getPodByClientId = (clientId: ClientId) => {
    return this.internalStore.getPodByClientId(clientId);
  };

  public init(): void {
    super.init();
    const ClientClass = (getOwner(this) as ApplicationInstance).resolveRegistration(`client:application`) as typeof TirClient | undefined;
    assert(`An ApplicationClient extending Client must be implemented.`, ClientClass);
    const env = (getOwner(this) as ApplicationInstance).resolveRegistration('config:environment') as { [ADDON_PREFIX]?: EnvConfig };
    assert(`You must configure "${ADDON_PREFIX}" in your application environment`, env && env[ADDON_PREFIX]);
    this.config = env[ADDON_PREFIX];
    this.client = new ClientClass(this.config);
    this.internalStore = new InMemoryCache(this);
    const [, serviceName] = this.toString().match(/service:(.*)::ember\d+/)!;
    assert(`Cannot initialize ${this.constructor.name ?? this.toString()} without proper naming.`, serviceName)
    this.SERVICE_NAME = serviceName as string;
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

  /**
   * Creates in-memory cache object with default values, encapsulates it and returns a proxy to it.
   * If you need initial values, instead pass them via @attr options.defaultValue or the transformer that does encapsulation.
   * @param modelName
   * @param rootField
   * @param options
   * @returns
   */
  create = (modelName: keyof PodRegistry) => {
    return this.internalStore.createPod(modelName)!;
  };

  public modelFor = (modelName: string): typeof Pod => {
    return this.internalStore.modelFor(modelName);
  };
  
  /** Retrievs the all field meta information for modelName */
  public getFieldMeta = (modelName: keyof PodRegistry) => {
    return this.internalStore.getFieldMetaForType(modelName);
  };

  // TODO: consider removing from here, if not needed
  public getRemovedPods = (): Set<ClientId> => {
    return this.internalStore.getRemovedPods();
  }

  // TODO: consider removing from here
  public markPodForRemoval = (clientId: ClientId): void => {
    this.internalStore.markPodForRemoval(clientId);
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
