import { assert } from '@ember/debug';
import type { QueryFieldDeclaration } from 'ember-apollo-data/-private/util';
import type { Node } from 'ember-apollo-data/model';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';

function verifyObjectFields(
  modelForOnce: (modelName: string) => typeof Node,
  parentModelName: string,
  field: QueryFieldDeclaration,
) {
  const parentNodeType = modelForOnce(parentModelName);
  assert(
    `No such field "${field}" on ${parentNodeType.name}`,
    parentNodeType.Meta[Object.keys(field)[0]!],
  );
  assert(
    `QueryFieldDeclaration must have single string key relation name and array of sub-fields as values.`,
    Object.keys(field).length === 1 &&
      typeof Object.keys(field)[0] === 'string' &&
      Array.isArray(Object.values(field)[0]),
  );
  const fieldName = Object.keys(field)[0]!;
  const subfields = Object.values(field)[0]!;
  assert(
    `Fields declared as objects must be relations while ${field} on ${parentNodeType.name} is an "attr".`,
    parentNodeType.Meta[fieldName]?.fieldType === 'relationship',
  );
  assert(
    `Relation sub-fields must be provided in form of Record<string, QueryFieldDeclaration[]>`,
    Array.isArray(subfields),
  );
  assert(
    `Relation sub-fields must not be empty. 
        If all attributes and no relations must included on this field, instead use a string relation field name for it.`,
    Object.values(field).length > 0,
  );
  subfields.forEach((subfield) => {
    if (typeof subfield === 'object') {
      verifyObjectFields(
        modelForOnce,
        (parentNodeType.Meta[fieldName] as RelationshipField).modelName,
        subfield,
      );
    } else {
      verifyStringFields(parentNodeType, subfield);
    }
  });
}

function verifyStringFields(parentNodeType: typeof Node, field: string) {
  assert(
    `No such attr "${field}" on ${parentNodeType.name}`,
    parentNodeType.Meta[field],
  );
}

export function verifyFieldAssertions(
  modelForOnce: (modelName: string) => typeof Node,
  parentModelName: string,
  field: QueryFieldDeclaration,
) {
  if (typeof field === 'object') {
    verifyObjectFields(modelForOnce, parentModelName, field);
  } else {
    const parentNode = modelForOnce(parentModelName)!;
    verifyStringFields(parentNode, field);
  }
}
