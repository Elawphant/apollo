import { capitalize, classify } from '@ember/string';
import type { Node } from 'ember-apollo-data/model';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';

export function makeAliasForNode(nodeType: typeof Node, suffix: string = '') {
  return nodeType.name + 'Node' + suffix;
}

export function makeAliasForConnection(
  nodeType: typeof Node,
  suffix: string = '',
) {
  return nodeType.name + 'Connection' + suffix;
}

export function makeAliasForNodeOnParent(
  fieldName: string,
  nodeType: typeof Node,
  suffix = '',
) {
  return classify(fieldName) + makeAliasForNode(nodeType, suffix);
}

export function makeAliasForConnectionOnParent(
  fieldName: string,
  nodeType: typeof Node,
  suffix = '',
) {
  return classify(fieldName) + makeAliasForConnection(nodeType, suffix);
}

export function configureRootAlias(
  modelName: string,
  queryType: 'node' | 'connection',
  suffix: string = '',
) {
  return capitalize(modelName) + capitalize(queryType) + '_' + suffix;
}

export function configureRelationAlias(
  field: RelationshipField,
  ParentAlias: string,
  queryType: 'node' | 'connection',
) {
  let [prefix, suffix] = ParentAlias.split('_');
  const name = field.propertyName as string;
  prefix = prefix!.replace(/Node|Connection/g, '');
  if (prefix.endsWith(capitalize(name))) {
    prefix = prefix.slice(0, -name.length);
  }
  return prefix + capitalize(name) + capitalize(queryType) + '_' + suffix;
}
