import { assert } from '@ember/debug';
import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { NodeRegistry } from 'ember-apollo-data/model/registry';
import { verifyFieldAssertions } from './fields';
import type { Node } from 'ember-apollo-data/model';

export function verifyQueries(
  modelFor: (modelName: string) => typeof Node,
  queries: { [modelName: keyof typeof NodeRegistry]: RootQueryDescription }[],
) {
  assert(
    `The queries must be an Array of { [modelName: string]: RootQueryDescription } objects`,
    Array.isArray(queries),
  );
  assert(
    `Each RootQueryDescription object must contain SINGLE modelName key with RootQueryDescription value`,
    queries.every((query) => {
      return (
        Object.keys(query).length === 1 &&
        Object.values(query).every((decl) => typeof decl === 'object')
      );
    }),
  );
  queries.forEach((query) => {
    const modelName = Object.keys(query)[0]!;
    const rootQueryDescription = Object.values(query)[0]!;
    assert(
      `RootQueryDescription must have 'type' key with "node" or "connection" value.`,
      rootQueryDescription['type'] &&
        ['node', 'connection'].includes(rootQueryDescription['type']),
    );
    if (rootQueryDescription['type'] === 'node') {
      assert(
        `Query of type "node" must specify "id" in variables.`,
        rootQueryDescription['variables'] &&
          (rootQueryDescription['variables'] as any)['id'] &&
          typeof (rootQueryDescription['variables'] as any)['id'] === 'string',
      );
      // let server raise errors for missing variables on connections
    }
    if (rootQueryDescription['fields']) {
      assert(
        `Fields on RootQueryDescription must be an array of QueryFieldDeclarations.`,
        Array.isArray(rootQueryDescription['fields']),
      );
      rootQueryDescription['fields'].forEach((field) => {
        verifyFieldAssertions(modelFor, modelName, field);
      });
    }
  });
}
