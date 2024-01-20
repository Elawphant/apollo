import { camelize, capitalize, classify, dasherize } from '@ember/string';
import type { Node } from 'ember-apollo-data/model';
import { PageInfoArgs } from 'ember-apollo-data/queries/pagination';
import { assert } from '@ember/debug';
import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import { analyze } from './analyser';

export interface VariableNameString extends String {}
export interface ScalarTypeString extends String {}

/**
 * The structure of a Variable set on AutoGraph.variables
 * `dot.separated.path.to.relation.ending.with.query.keyArg` is essentially composed of two parts
 * `[dot.separated.path.to.relation.ending].[keyArg]`.
 *
 * `[key: dot.separated.path.to.relation.ending.with.query.keyArg]: {
 *  [key: VariableNameString]: ScalarTypeString
 * }`
 * example: on Author with Books relations and Publishers on Book
 * ```
 * { 'id': {
 *      'author_id': "ID!",
 *   },
 *   'books.offset': {
 *      'author_books_offset': "Number",
 *   },
 *   'books.publishers.name' {
 *       'author_books_publishers_name': "String",
 *   }
 * }
 * ```
 */
export interface VariableDeclaration {
  [key: string]: Record<string, ScalarTypeString>;
}

export function configureVariables(
  modelFor: (modelName: string) => typeof Node,
  modelName: string,
  query: RootQueryDescription,
  index: number,
): VariableDeclaration {
  const suffix = index.toString();
  const variables = query.variables;
  const result: VariableDeclaration = {};
  const alias = camelize(modelName) + capitalize(query.type) + '_';
  if (variables) {
    Object.keys(variables).forEach((key) => {
      const path = key.split('.');
      const keyArg = path[-0]!;
      const relations = path.length > 1 ? path.slice(0, -1) : undefined;
      const NodeType = relations
        ? analyze(modelFor, modelName, relations)
        : modelFor(modelName);
      if (Object.keys(PageInfoArgs).includes(keyArg)) {
        Object.assign(result, {
          [key]: {
            [`${alias + path.join('_') + suffix}`]:
              PageInfoArgs[keyArg as keyof typeof PageInfoArgs]!,
          },
        });
      } else if (keyArg === 'id') {
        Object.assign(result, {
          [key]: {
            [`${alias + path.join('_') + suffix}`]: 'ID!',
          },
        });
      } else {
        assert(
          `No ${keyArg} is configured on ${NodeType.name} config`,
          NodeType.TYPE_CONFIG.keyArgs && NodeType.TYPE_CONFIG.keyArgs[keyArg],
        );
        Object.assign(result, {
          [key]: {
            [`${alias + path.join('_') + suffix}`]:
              NodeType.TYPE_CONFIG.keyArgs[
                keyArg as keyof typeof NodeType.TYPE_CONFIG.keyArgs
              ]!,
          },
        });
      }
    });
  }
  return result;
}
