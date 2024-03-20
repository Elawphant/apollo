import type { Variables } from 'graphql-request';
import type { Pod } from '.';
import type { PodRegistry } from './registry';
import type { AttrField, RelationshipField } from './field-mappings';
import type { RootFieldName, RootType } from 'tir/caches/types';

type RootRef = {
  modelName: keyof PodRegistry,
  root: RootFieldName,
  rootType: RootType,
} | {
  clientId: ClientId,
  root: (AttrField | RelationshipField)['propertyName'],
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

type RelayNodeData = {
  [key: string]: unknown;
};

type RelayEdgeData = {
  cursor?: string;
  node?: RelayNodeData;
  [key: string]: unknown;
};

type RelayPageInfoData = {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string;
  endCursor?: string;
  [key: string]: unknown;
};

type RelayConnectionData = {
  edges?: RelayEdgeData[];
  pageInfo?: RelayPageInfoData;
  [key: string]: unknown;
};

type FlatNodeArrayData = RelayNodeData[]

type ClientId = `${keyof PodRegistry}:${number}`;

export type {
  Pod,
  RootRef,
  ConnectionRef,
  GraphQlErrorData,
  ClientId,
  RelayNodeData,
  RelayEdgeData,
  RelayPageInfoData,
  RelayConnectionData,
  FlatNodeArrayData,
};
