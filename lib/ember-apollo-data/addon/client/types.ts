import type { GraphQLError } from 'graphql';

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
};