import { tracked } from 'tracked-built-ins';
import { configureErrorHandler } from './error';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import type { AutoGraph } from 'ember-apollo-data/configurators/graph-author/author';
import type { TRelayConnectionData } from './connection';
import type { TRelayNodeData } from './node';

export class Queryable {
  declare public store: EADStoreService;
  declare public autoGraph: AutoGraph;
  _meta: any = {};

  @tracked public queryInProgress: Promise<any> | undefined = undefined;

  @tracked
  private hasLoaded: boolean = false;

  get loaded(){
    return this.hasLoaded;
  }

  setLoadedOnce = () => {
    if (!this.hasLoaded){
      this.hasLoaded = true;
    }
  }

  private registerQueryInProgress = async(promise: Promise<any>) => {
    this.queryInProgress = promise;
    await promise;
    this.queryInProgress = undefined;
  }

  public readonly afterQuery = (
    onFulfilled: (...any: any) => any,
    onRejected?: (...any: any) => any,
  ): Promise<void> => {
    if (this.queryInProgress) {
      this.queryInProgress
        .then(() => {
          onFulfilled;
        })
        .catch(() => {
          if (onRejected) {
            onRejected();
          }
        });
    } else {
      Promise.resolve().then(onFulfilled).catch(onRejected);
    }
    return Promise.resolve();
  };

  public readonly errors;

  get isSuccess() {
    return !this.isError;
  }

  get isError() {
    return this.errors.areErrors;
  }

  get isLoading() {
    return this.queryInProgress ? true : false;
  }

  constructor() {
    this.errors = configureErrorHandler(this._meta);
  }

  public readonly resetErrors = () => {
    this.errors.clear();
  };

  // TODO reimplement errors since we are not using ApolloError
  public readonly handleError = (error: Error) => {
    // const { graphQLErrors, networkError } = ApolloError;
    // if (networkError) {
    //   throw new Error(`Network Error: ${networkError.message}`);
    // }
    // if (graphQLErrors) {
    //   graphQLErrors.forEach((error) => {
    //     if (error.path) {
    //       this.errors.add(error.path?.join('.'), error.message);
    //     } else {
    //       this.errors.add('messages', error.message);
    //     }
    //   });
    // }
  };

  public encapsulate(data: TRelayNodeData | TRelayConnectionData): void {
    throw new Error("This method should be implemented on Connection and Node")
  };


  public query = async (options?: any): Promise<void> => {
    // ignore variables set on options, allowing autoGraph to configure
    if (options && options['variables']){
      delete options['variables'];
    }
    try {
      this.registerQueryInProgress(this.store.client.request(
        this.autoGraph.configureOperaton(),
        this.autoGraph.configureOperationVariables(), 
        options,
      ));
      const data = await this.queryInProgress;
      this.encapsulate(data);
      this.setLoadedOnce();
    } catch (e) {
      // TODO handle errors 
    }
  };

}
