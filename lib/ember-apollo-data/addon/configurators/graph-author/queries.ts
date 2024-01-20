import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { Node } from 'ember-apollo-data/model';
import type { VariableDeclaration } from './variables';
import { wrappedInNode } from './node';
import { wrappedInConnection } from './connection';
import { configureRootAlias } from './alias';
import { levelizeVars } from './fields-tree';

export function configureQuery(
  modelFor: (modelName: string) => typeof Node,
  modelName: string,
  rootQueryDescription: RootQueryDescription,
  variables: VariableDeclaration,
  index: number,
) {
  const { type, fields } = rootQueryDescription;
  const suffix = index.toString();
  const mappedVars = levelizeVars(variables);
  if (type === 'node') {
    return wrappedInNode(
      modelFor,
      modelName,
      mappedVars,
      configureRootAlias(modelName, rootQueryDescription.type, suffix),
      undefined,
      fields,
      suffix,
    );
  } else {
    return wrappedInConnection(
      modelFor,
      modelName,
      mappedVars,
      configureRootAlias(modelName, rootQueryDescription.type, suffix),
      undefined,
      fields,
      suffix,
    );
  }
}
