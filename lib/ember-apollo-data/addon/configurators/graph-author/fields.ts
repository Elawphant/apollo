import { assert } from '@ember/debug';
import { capitalize } from '@ember/string';
import type { QueryFieldDeclaration } from 'ember-apollo-data/-private/util';
import type { Node } from 'ember-apollo-data/model';
import type {
  AttrField,
  RelationshipField,
} from 'ember-apollo-data/model/field-mappings';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import { wrappedInConnection } from './connection';
import { wrappedInNode } from './node';
import type { VariableDeclaration } from './variables';

export function configureFields(
  modelFor: (modelName: string) => typeof Node,
  modelName: string,
  variables: Map<number, VariableDeclaration[]>,
  alias: string,
  fields?: QueryFieldDeclaration[],
  suffix: string = '',
  level: number = 0,
): string {
  const NodeType = modelFor(modelName);
  const result: string[] = ['__typename', 'id'];
  if (Array.isArray(fields)) {
    fields.forEach((field) => {
      // get Field Meta
      const fieldMeta: AttrField | RelationshipField =
        typeof field === 'object'
          ? NodeType.Meta[Object.keys(field)[0]!]!
          : NodeType.Meta[field]!;
      if (fieldMeta!.fieldType === 'relationship') {
        const subfields =
          typeof field === 'string' ? undefined : Object.values(field)[1];
        // if field is passed as string
        if (fieldMeta!.relationshipType === 'hasMany') {
          // Wrap it in connection string
          result.push(
            wrappedInConnection(
              modelFor,
              fieldMeta!.modelName,
              variables,
              alias,
              fieldMeta,
              subfields,
              suffix,
              level,
            ),
          );
        }
        if (fieldMeta!.relationshipType === 'belongsTo') {
          // Wrap it in node string
          result.push(
            wrappedInNode(
              modelFor,
              fieldMeta!.modelName,
              variables,
              alias,
              fieldMeta,
              subfields,
              suffix,
              level,
            ),
          );
        }
      }
      if (fieldMeta!.fieldType === 'attribute') {
        result.push(fieldMeta!.dataKey);
      }
    });
  } else {
    result.push(`...${NodeType.name}Fragment`);
  }
  return result.join('\n');
}
