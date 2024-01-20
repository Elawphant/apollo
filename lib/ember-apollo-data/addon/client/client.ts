import { assert } from '@ember/debug';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import {
  GraphQLClient,
  type RequestDocument,
  type Variables,
  type RequestOptions,
} from 'graphql-request';
// @ts-ignore because it is not publicly exported
import type { VariablesAndRequestHeadersArgs } from 'graphql-request/build/esm/types';

export default class Client {
  private declare client: GraphQLClient;

  private declare abordtController: AbortController;

  public get endpoint(): string {
    return ""
  };

  public declare errorPolicy: 'all' | 'ignore' | 'none';

  public get headers(): Record<string, string> {
    return {}
  };

  public overwriteHeaders = (headers: Record<string, string>) => {
    this.client.setHeaders(headers);
  };

  public addHeader = (headerKey: string, headerValue: string) => {
    this.client.setHeader(headerKey, headerValue);
  };

  constructor() {
    assert(`You must configure "endpoint" on Client`, this.endpoint);
    this.abordtController = new AbortController();
    if (!this.client) {
      this.client = new GraphQLClient(this.endpoint, {
        errorPolicy: this.errorPolicy ?? 'none',
        headers: () => this.headers,
        signal: this.abordtController.signal
      });
    }
  }

  request = async <T, V extends Variables = Variables>(
    documentOrOptions:
      | RequestDocument
      | TypedDocumentNode<T, V>
      | RequestOptions<V>,
    ...variablesAndRequestHeaders: VariablesAndRequestHeadersArgs<V>
  ): Promise<T> => {
    return this.client.request<T, V>(
      documentOrOptions as RequestDocument,
      ...variablesAndRequestHeaders,
    );
  };

  abortRequests = () => {
    return this.abordtController.abort();
  }
}
