import type { QueryFieldDeclaration } from 'ember-apollo-data/-private/util';
import { PageInfoFields } from 'ember-apollo-data/queries/pagination';
import { wrappedInNode } from './node';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';
import { configureRelationAlias } from './alias';
import type { Node } from 'ember-apollo-data/model';
import type { VariableDeclaration } from './variables';

/**
 * Increases level
 */
export function wrappedInConnection(
  modelFor: (modelName: string) => typeof Node,
  modelName: string,
  variables: Map<number, VariableDeclaration[]>,
  alias: string,
  relationField?: RelationshipField,
  fields?: QueryFieldDeclaration[],
  suffix: string = '',
  level: number = 1,
): string {
  const NodeType = modelFor(modelName);
  const relevantVariableKeys = variables.get(level);
  const vars: string[] = [];
  if (relevantVariableKeys) {
    Object.entries(relevantVariableKeys).forEach(([key, val]) => {
      if (key) {
        const keyArg = key.split('.')[-1]!;
        vars.push(`${keyArg}: $${Object.keys(val)[0]!}`);
      }
    });
  }
  const subAlias = relationField
    ? configureRelationAlias(relationField, alias, 'connection')
    : alias;
  const query = `
        ${subAlias}: ${
          relationField?.dataKey ?? NodeType.TYPE_CONFIG.queryRootField
        } ${vars.length > 0 ? `(${vars.join(', ')})` : ''} {
            __typename
            edges {
                __typename
                ${wrappedInNode(
                  modelFor,
                  modelName,
                  variables,
                  subAlias,
                  relationField,
                  fields,
                  suffix,
                  level + 1,
                  true
                )}
                cursor
            }
            pageInfo {
                __typename
                ${PageInfoFields}
            }
        }
    `;
  return query;
}
