import type TirService from 'tir/services/tir';
import type { PodRegistry } from './registry';
import type { TPodData, TStemData } from './types';
import { configure } from 'tir/utils';

export class Queryable {
  public declare store: TirService;
  _meta: any = {};

  public declare readonly isNode: boolean;

  public queryInProgress: Promise<any> | undefined = undefined;

  private __hasLoaded: boolean = false;

  get loaded() {
    return this.__hasLoaded;
  }

  setLoadedOnce = () => {
    if (!this.__hasLoaded) {
      this.__hasLoaded = true;
    }
  };

  private registerQueryInProgress = async (promise: Promise<any>) => {
    this.queryInProgress = promise;
    await promise;
    this.queryInProgress = undefined;
  };

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

  // TODO
  public readonly errors: any;

  get isSuccess() {
    return !this.isError;
  }

  get isError() {
    return this.errors.areErrors;
  }

  get isLoading() {
    return this.queryInProgress ? true : false;
  }

  constructor(store: TirService) {
    configure(store, this);
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

  public encapsulate(data: TPodData | TStemData): void {
    throw new Error(
      'Queryable does not implement encapsulate, but one is expected on Node or Connection',
    );
  }

  public query = async (options?: any): Promise<void> => {
    // ignore variables set on options, allowing QueryDesigner to configure
    if (options && options['variables']) {
      delete options['variables'];
    }
    // this.registerQueryInProgress(this.store.request());
    this.setLoadedOnce();
  };
}
