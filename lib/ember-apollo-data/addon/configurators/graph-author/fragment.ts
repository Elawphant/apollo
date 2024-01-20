import type { Node } from 'ember-apollo-data/model';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export function configureNodeFragment(nodeType: typeof Node): string {
  const fields = Object.values(nodeType.Meta)
    // remove 'id' and '__typename' because we use them with MinimalFragment
    .filter(
      (field) => !['id', '__typename'].includes(field.propertyName as string),
    )
    // make fragment fields for fields
    .map((field: any) => {
      if (field.fieldType === 'attribute') {
        return field.dataKey;
      }
    })
    .join('\n');
  const name = `${nodeType.name}Fragment`;
  return `
      fragment ${name} on ${nodeType.name} {
        __typename
        id
        ${fields}
      }
    `;
}
