import { capitalize } from '@ember/string';
import type { Node } from 'ember-apollo-data/model';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export function configureMutationDependences(node: Node) {
  const NodeType = node.constructor as typeof Node;
  const CFG = NodeType.TYPE_CONFIG;
  if (node.isNew) {
    return {
      mutationRootFieldName: CFG['createRootField'],
      inputTypeName: CFG['createInputTypeName'],
    };
  }
  if (node.isDeleted) {
    return {
      mutationRootFieldName: CFG['deleteRootField'],
      inputTypeName: CFG['deleteInputTypeName'],
    };
  }
  return {
    mutationRootFieldName: CFG['updateRootField'],
    inputTypeName: CFG['updateInputTypeName'],
  };
}

export function configureNodeMutation(
  store: EADStoreService,
  modelName: string,
  mutationRootFieldName: string,
  prefix: string,
  suffix: string,
  onlyFields?: string[],
): string {
  const NodeType = store.modelFor(modelName);
  // include all fields by default
  const fields: string[] =
    onlyFields ?? Object.values(NodeType.Meta).map((field) => field.dataKey);
  const query = `
      ${NodeType.name}${suffix}: ${NodeType.modelName} {
        ${fields.join('\n')}
      } 
    `;
  const ALIAS = capitalize(mutationRootFieldName) + suffix;
  const mutation = `
        ${ALIAS}: ${mutationRootFieldName} ( input: $${prefix}input${suffix} ) {
          ${query}
        }
    `;
  return mutation;
}
