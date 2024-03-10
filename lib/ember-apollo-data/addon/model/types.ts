import type { Variables } from 'graphql-request';
import type { Pod } from '.';
import type { PodRegistry } from './registry';
import type { RelationshipField } from './field-mappings';

type TPodData = {
  __typename?: string;
  id?: string;
  [key: string]: any | TPodData | TStemData;
};

type TStemData = {
  edges?: TRelayEdgeData[];
  pageInfo?: TRelayPageInfoData;
  [key: string]: any;
};

type TRelayEdgeData = {
  __typename?: string;
  cursor?: string;
  node?: TPodData;
  [key: string]: any;
};

type TRelayPageInfoData = {
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  startCursor?: string;
  endCursor?: string;
  [key: string]: any;
};

type RootRef = {
  modelName: keyof PodRegistry;
  root: RelationshipField['dataKey'] | string;
  clientId?: ClientId;
};

type ConnectionRef = {
  variables: Variables;
} & RootRef;

type GraphQlErrorData = {
  message: string;
  locations?: { line: number; column: number }[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
};

type ClientId = `${keyof PodRegistry}:${number}`;

export type {
  Pod,
  TPodData,
  TRelayEdgeData,
  TStemData,
  TRelayPageInfoData,
  RootRef,
  ConnectionRef,
  GraphQlErrorData,
  ClientId,
};
