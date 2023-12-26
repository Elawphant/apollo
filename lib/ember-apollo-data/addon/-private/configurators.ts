import type ApplicationInstance from '@ember/application/instance';
import { assert } from '@ember/debug';
import { getOwner } from '@ember/owner';
import { builtInTransforms } from 'ember-apollo-data/builtin-transforms/built-in-transforms';
import Node from 'ember-apollo-data/model/node';
import type {
  AttrField,
  RelationshipField,
} from 'ember-apollo-data/model/field-mappings';
import {
  PageInfoFields,
  PageInfoArgs,
} from 'ember-apollo-data/queries/pagination';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import type Transform from 'ember-apollo-data/transform';
import { capitalize } from '@ember/string';

export function configureModelConstructor(
  shimInstance: Node,
  modelName: string,
): typeof Node {
  const constructor = shimInstance.constructor as typeof Node;
  constructor.modelName = modelName;

  // set Meta and let model constructor handle the rest via getters
  // this line is important.
  constructor.Meta = shimInstance.constructor.prototype.Meta;

  return constructor;
}

export function configureConnectionQuery(
  store: EADStoreService,
  modelName: string,
  prefix: string = '',
  suffix = '',
  rootFieldName?: string,
) {
  const NodeType = store.modelFor(modelName);
  const variables = configureConnectionVariables(NodeType, prefix, suffix);
  const vgql = Object.keys(variables)
    .map((keyArg) => `${keyArg}: $${variables[keyArg]![0]}`)
    .join(', ');
  const ALIAS = NodeType.name + 'Connection' + suffix;
  return `
    ${ALIAS}: ${
      rootFieldName ?? NodeType.APOLLO_CONFIG.queryRootField
    } (${vgql}) {
      edges {
        node {
          __typename
          id
          ...${NodeType.name}Fragment
        }
        cursor
      }
      pageInfo {
        ${PageInfoFields} 
      }
    }
  `;
}

type VariableNameString = string;
type ScalarTypeString = string;

export function configureConnectionVariables(
  modelConstructor: typeof Node,
  prefix: string = '',
  suffix = '',
): { [dataKey: string]: [VariableNameString, ScalarTypeString] } {
  const PREFIX = prefix;
  const SUFFIX = suffix;
  const keyVars = Object.entries(
    modelConstructor.APOLLO_CONFIG?.keyArgs || {},
  ).map(([keyArg, scalar]) => {
    return { [keyArg]: [`$${PREFIX + keyArg + SUFFIX}`, scalar] };
  });
  const pageInfoVars = Object.entries(PageInfoArgs).map(([keyArg, scalar]) => {
    return { [keyArg]: [`${PREFIX + keyArg + SUFFIX}`, scalar] };
  });
  const variables = Object.assign({}, ...pageInfoVars, ...keyVars);
  return variables;
}

export function configureNodeVariables(
  modelConstructor: typeof Node,
  prefix: string = '',
  suffix = '',
): { [dataKey: string]: [VariableNameString, ScalarTypeString] } {
  return {
    id: [`${prefix}id${suffix}`, 'ID!'],
  };
}

export function configureNodeFragment(
  store: EADStoreService,
  modelConstructor: typeof Node,
  prefix: string = '',
  suffix: string = '',
): string {
  const fields = Object.values(modelConstructor.Meta)
    // remove 'id' and '__typename' because we use them with MinimalFragment
    .filter((field) => !['id', '__typename'].includes(field.propertyName))
    // make fragment fields for fields
    .map((field: any) => {
      if (field.fieldType === 'attribute') {
        return field.dataKey;
      }
    })
    .join('\n');
  const name = `${modelConstructor.name}Fragment`;
  return `
    fragment ${name} on ${modelConstructor.name} {
      __typename
      id
      ${fields}
    }
  `;
}

export function configureNodeQuery(
  store: EADStoreService,
  modelName: string,
  prefix: string = '',
  suffix: string = '',
  onlyFields?: string[],
  fieldsPrefix: string = '',
  fieldsSuffix: string = '',
) {

  const ModelConstructor = store.modelFor(modelName);
  let fields: string[] = [];
  if (onlyFields) {
    onlyFields.forEach((field) => {
      const meta = ModelConstructor.Meta[field];
      if (meta!.fieldType === 'relationship') {
        if (meta!.relationshipType === 'hasMany') {
          fields.push(
            configureConnectionQuery(
              store,
              meta!.modelName,
              fieldsPrefix,
              fieldsSuffix,
              meta!.dataKey,
            ),
          );
        }
        if (meta!.relationshipType === 'belongsTo') {
          const RelatedType = store.modelFor(meta!.modelName)
          const ALIAS = `${capitalize(meta!.modelName)}NodeOn${ModelConstructor.name}${suffix}`;
          const fieldQuery  = `
            ${ALIAS}: ${meta!.dataKey} {
              ...${RelatedType.name}Fragment
            }
          `
          fields.push(fieldQuery);
        }
      }
    });
  } else {
    fields = [`...${ModelConstructor.name}Fragment`];
  }
  const query = `
  ${ModelConstructor.name}Node${suffix}: node(id: $id${suffix}){
    ... on ${ModelConstructor.name} {
      __typename
      id
      ${fields.join('\n')}
    }
  }`;
  return query;
}

export function confgureOperationDependencies(
  store: EADStoreService,
  NodeType: typeof Node,
  prefix: string = '',
  suffix: string = '',
) {
  const fragment = configureNodeFragment(store, NodeType, '', suffix);
  const variables = configureConnectionVariables(NodeType, '', suffix);
  const vars = Object.keys(variables).map(
    (keyArg) => `$${variables[keyArg]![0]}: ${variables[keyArg]![1]}`,
  );
  return {
    suffix: suffix,
    fragment: fragment,
    variables: [...vars],
  };
}



export function configureMutationDependences(node: Node) {
  const NodeType = node.constructor as typeof Node;
  const CFG = NodeType.APOLLO_CONFIG;
  if (node.isNew){
    return {
      mutationRootFieldName: CFG['createRootField'],
      inputTypeName: CFG['createInputTypeName'],
    }
  }
  if (node.isDeleted){
    return {
      mutationRootFieldName: CFG['deleteRootField'],
      inputTypeName: CFG['deleteInputTypeName'],
    }
  }
  return {
    mutationRootFieldName: CFG['updateRootField'],
    inputTypeName: CFG['updateInputTypeName'],
  }
}


export function configureNodeMutation(
  store: EADStoreService, 
  modelName: string, 
  mutationRootFieldName: string, 
  prefix: string, 
  suffix: string, 
  onlyFields?: string[]
): string {
  const NodeType = store.modelFor(modelName);
  // include all fields by default
  const fields: string[] = onlyFields ?? Object.values(NodeType.Meta).map(field => field.dataKey);
  const query = `
    ${NodeType.name}${suffix}: ${NodeType.modelName} {
      ${fields.join('\n')}
    } 
  `
  const ALIAS = capitalize(mutationRootFieldName) + suffix
  const mutation = `
      ${ALIAS}: ${mutationRootFieldName} ( input: $${prefix}input${suffix} ) {
        ${query}
      }
  `;
  return mutation;
}




export function configureTransformers(
  store: EADStoreService,
  modelConstructor: typeof Node,
) {
  const Meta = modelConstructor.Meta;

  for (const fieldName in Meta) {
    if (Meta[fieldName]!.fieldType === 'attribute') {
      const transformName = (Meta[fieldName] as AttrField)?.transformName;
      if (transformName) {
        let transformType: typeof Transform | undefined;
        transformType = (getOwner(store) as ApplicationInstance).lookup(
          `ead-transform:${transformName}`,
        ) as typeof Transform;
        if (!transformType) {
          transformType = builtInTransforms[transformName];
        }
        assert(
          `Transform with name "${transformName}" does not exist in the transforms registry!`,
          transformType,
        );
        if (transformType) {
          Object.assign(modelConstructor.Meta[fieldName] as AttrField, {
            transform: transformType,
          });
        }
      }
    }
  }
}
