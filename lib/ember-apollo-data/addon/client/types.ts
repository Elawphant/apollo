import type { NodeRegistry } from 'ember-apollo-data/model/registry';
import type { GraphQLError } from 'graphql';
import type { Variables } from 'graphql-request';

export type RemoveIndex<T> = {
  [K in keyof T as string extends K
    ? never
    : number extends K
      ? never
      : K]: T[K];
};

export type GraphQLClientRequestHeaders =
  | Headers
  | string[][]
  | Record<string, string>;

export interface GraphQLClientResponse<Data> {
  status: number;
  headers: Headers;
  data: Data;
  extensions?: unknown;
  errors?: GraphQLError[];
}

export type DataEntry = {
  [key: string]: any;
}

export type ConnectionPK = string;