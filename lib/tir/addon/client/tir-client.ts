import { assert } from '@ember/debug';
import {
  ADDON_PREFIX,
  ERROR_MESSAGE_PREFIX,
  type EnvConfig,
} from 'tir/-private/globals';
import { GraphQLClient } from 'graphql-request';

const abortController = new AbortController();

class TirClient extends GraphQLClient {
  private declare abortController: AbortController;

  public get headers(): Record<string, string> {
    return {};
  }

  constructor(config: EnvConfig) {
    assert(
      `You must configure "endpoint" in your application environment ${ADDON_PREFIX}`,
      config['endpoint'],
    );
    super(config['endpoint'], {
      errorPolicy: config['errorPolicy'] ?? 'none',
      headers: () => this.headers,
      signal: abortController.signal,
    });
    this.abortController = abortController;
  }

  abortRequests = (): void => {
    this.abortController.abort();
  };

  // TODO: implement subscribe
  subscribe = (...args: Parameters<GraphQLClient['request']>) => {
    throw new Error(
      `${ERROR_MESSAGE_PREFIX}Subscription is not currently supported.`,
    );
  };
}

export { TirClient };
