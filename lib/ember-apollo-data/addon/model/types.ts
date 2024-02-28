import type { Variables } from "graphql-request";
import type { Node } from ".";
import type { NodeRegistry } from "./registry";
import type { RelationshipField } from "./field-mappings";



/**
 * An operation variable prefixed with $ sign.
 * 
 * E.g. in `query MyQueryOperation ($id: !ID) {
 *  ...
 * }` $id is an OperationVariable.
 */
type OperationVariable = `$${string}`;


/**
 * A key argument name of a query or mutation
 * 
 * E.g. in 
 * ```query UserQueryOperation ($id: !ID) {
 *  node (id: $id) { 
 *   ...
 *  }
 * }```
 * 
 * id without $ symbol in `node (id: $id)` is a KeyArg.
 */
type KeyArg = string;


type FragmentName = `...${string}`;

type FieldName = string & keyof Node;



type NestedQueryField<K extends FieldName> = {
  [key in K]: QueryField[];
} & { type?: string } & Record<any, never>;


/** FieldName | NestedQueryField */
type QueryField = FieldName | NestedQueryField<FieldName>;


type TAliasedNodeData = {
  __typename?: string;
  id?: string;
  [key: string]: any | TAliasedNodeData | TAliasedConnectionData;
}

type TAliasedConnectionData = {
  edges?: TRelayEdgeData[],
  pageInfo?: TRelayPageInfoData,
  [key: string]: any,
}

type TRelayEdgeData = {
  __typename?: string;
  cursor?: string;
  node?: TAliasedNodeData;
  [key: string]: any;
};

type TRelayPageInfoData = {
  hasPreviousPage?: boolean;
  hasNextPage?: boolean;
  startCursor?: string;
  endCursor?: string;
  [key: string]: any;
};


type InternalConnectionData = {
  records: Node["CLIENT_ID"][];
  connectionData: TAliasedConnectionData;

  // a map of edge to Node["CLIENT_ID"]
  edges: Map<Node["CLIENT_ID"], TRelayEdgeData>;
  // TODO: consider adding state management fields, e.g. upToDate: boolean
}


type ConnectionRootRef = {
  modelName: keyof NodeRegistry;
  fieldName: RelationshipField["propertyName"];
  clientId?: Node["CLIENT_ID"];
}

type ConnectionRef = {
  variables: Variables;  
} & ConnectionRootRef

type GraphQlErrorData = {
  message: string,
  locations?: { line: number, column: number }[],
  path?: (string | number)[],
  extensions?: Record<string, unknown>
}

export type {
  OperationVariable,
  KeyArg,
  FieldName,
  FragmentName,
  QueryField,
  Node,
  TAliasedNodeData,
  TRelayEdgeData,
  TAliasedConnectionData,
  TRelayPageInfoData,
  ConnectionRootRef,
  ConnectionRef,
  InternalConnectionData,
  GraphQlErrorData
}