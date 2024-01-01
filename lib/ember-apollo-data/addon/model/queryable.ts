import type { ApolloClient, ApolloQueryResult } from "@apollo/client";
import { assert } from "@ember/debug";
import { tracked } from "tracked-built-ins";




export class Queryable {

  @tracked private queryInProgress: Promise<any> | undefined = undefined;

  public afterQuery = (onFulfilled: (...any: any) => any, onRejected?: (...any: any) => any): Promise<void> => {
    if (this.queryInProgress) {
      this.queryInProgress.then(onFulfilled).catch(onRejected);
    } else {
      Promise.resolve().then(onFulfilled).catch(onRejected);
    }
    return Promise.resolve()
  }

  public resetQueryInProgress = () => {
    this.queryInProgress = undefined;
  }

  public registerQuery = (queryPromise: Promise<ApolloQueryResult<any>>) => {
    if (!this.queryInProgress){
        this.queryInProgress = queryPromise;
    }
    return this.queryInProgress;
  }
}