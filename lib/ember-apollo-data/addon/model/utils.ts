import type { Node } from ".";
import { camelize } from "@ember/string";
import { PageInfoArgs } from "ember-apollo-data/queries/pagination";
import type { Variables } from "graphql-request";
import type { ConnectionRef, TAliasedConnectionData, TAliasedNodeData, TRelayEdgeData } from "./types";

type UID = string;


const getDefaultFields = (NodeType: typeof Node) => {
  const meta = NodeType.Meta;
  return Object.values(meta).map(field => {
    if (field.fieldType === "attribute") {
      return field.dataKey;
    };
  }).filter(i => i !== undefined).join("\n");
}

const defaultNodeQuery = (NodeType: typeof Node): string => {
  const root = "node";
  const alias = `${NodeType.name}Node`;
  const fields = getDefaultFields(NodeType)
  return `
      query ${NodeType.name}NodeQuery (id: !ID){
        ${alias}: ${root} {
          ${fields}
        }
      }
    `;
}

const defaultConnectionQuery = (NodeType: typeof Node) => {
  // per suggested convention https://relay.dev/graphql/connections.htm#sec-Connection-Types by default
  const root = camelize(NodeType.name) + "Connection";
  const connectionAlias = `${NodeType.name}Connection`;
  const fields = getDefaultFields(NodeType)
  const vars = { ...PageInfoArgs, ...(NodeType.TYPE_CONFIG.operationVariables ?? {}) };
  const opVars = Object.entries(vars).map(([key, scalar]) => {
    return `$${key}: ${scalar}`;
  }).join(", ");

  const queryVars = Object.keys(vars).map((param) => {
    return `${param}: $${param}`;
  }).join(", ");
  const nodeAlias = `${NodeType.name}Node`;
  return `
      query ${NodeType.name}ConnectionQuery (${opVars}){
        ${connectionAlias}: ${root} (${queryVars}) {
          edges {
            ${nodeAlias}: node {
              ${fields}
            }
          }
          cursor
        }
        pageInfo {
          __typename
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    `;
}

/** 
 * Given graphql response data and error path, 
 * finds the respective data record and returns an object 
 * with fieldName, object and errorField name  
 * */
function getObjectAtPath(
  data: Record<string, any>, 
  path: (string | number)[]
  ): { 
    key: string | null, 
    record: Record<string, any> | null, 
    fieldErrorField: string 
  } {
  let result: { 
    key: string | null, 
    record: Record<string, any> | null, 
    fieldErrorField: string 
  } = {
    key: null,
    record: null,
    fieldErrorField: path[path.length -1] as string,
  };
  path.slice(0, -1).reduce((acc, key) => {
    if (typeof acc === "object") {
      const record = acc[key]
      if (typeof key === "string"){
        result.key = key;
        result.record = record;
      }
      return record;
    }
    return;
  }, data);
  return result;
}


export { getDefaultFields, defaultNodeQuery, defaultConnectionQuery, getObjectAtPath };