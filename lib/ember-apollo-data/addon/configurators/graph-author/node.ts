import type { QueryFieldDeclaration } from 'ember-apollo-data/-private/util';
import { type ScalarTypeString, type VariableDeclaration } from './variables';
import { configureFields } from './fields';
import type { Node } from 'ember-apollo-data/model';
import {
  configureRelationAlias,
  configureRootAlias,
  makeAliasForNode,
  makeAliasForNodeOnParent,
} from './alias';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';
import { levelizeVars } from './fields-tree';

function wrappedInNodeSpecifier(
  query: string,
  nodeType: typeof Node,
  rootField?: RelationshipField,
) {
  if (!rootField) {
    return `
            ...on ${nodeType.name} {
                ${query}
            }
        `;
  }
  return query;
}

/**
 * Increases level
 */
export function wrappedInNode(
  modelFor: (modelName: string) => typeof Node,
  modelName: string,
  variables: Map<number, VariableDeclaration[]>,
  alias: string,
  relationField?: RelationshipField,
  fields?: QueryFieldDeclaration[],
  suffix: string = '',
  level: number = 1,
  isOnConnection: boolean = false
): string {
  const NodeType = modelFor(modelName);
  const relevantVariables = variables.get(level);

  const vars: string[] = [];
  if (relevantVariables) {
    relevantVariables.forEach((varDecl) => {
      const keyArg = Object.keys(varDecl)[0]!.split('.')[-0]!;
      const opVar = Object.keys(Object.values(varDecl)[0]!)[0]!;
      vars.push(`${keyArg}: $${opVar}`);
    });
  }
  const subAlias = relationField
    ? configureRelationAlias(relationField, alias, 'node')
    : alias;
  const fieldsQuery = `
        ${configureFields(
          modelFor,
          modelName,
          variables,
          subAlias,
          fields,
          suffix,
          relationField ? level : level + 1,
        )}
    `;
  const query = `
    ${subAlias}: ${isOnConnection ? "node" : relationField?.dataKey ?? 'node' } ${
      vars.length > 0 && !relationField ? `(${vars.join(', ')})` : ''
    } {
        ${wrappedInNodeSpecifier(fieldsQuery, NodeType, relationField)}
    }
    `;
  return query;
}
