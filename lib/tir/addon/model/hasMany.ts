import { Pod } from './pod';
import { assert } from '@ember/debug';
import { type RelationshipField } from './field-mappings';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';

function hasMany(
  modelName: string,
  options: {
    dataKey?: string;
    inverse: string;
    polymorphic?: boolean;
  },
): PropertyDecorator {
  assert(
    `An explicit modelName must be provided as first argument to "${hasMany.prototype.name}".`,
    !modelName || (modelName && typeof modelName === 'string'),
  );

  return function (
    target: Pod['prototype'],
    propertyName: string | symbol,
  ): void {
    const prototype = target as Pod['prototype'];
    assert(
      `${ERROR_MESSAGE_PREFIX}Decorator ${hasMany.prototype.name} can only be applied to "string" properties`,
      typeof propertyName === 'string',
    );

    const { dataKey, inverse, polymorphic } = options ?? {};

    const meta: RelationshipField = {
      modelName: modelName,
      propertyName: propertyName,
      fieldType: 'relationship',
      relationshipType: 'hasMany',
      dataKey: dataKey ?? propertyName,
      polymorphic: polymorphic,
      inverse: inverse,
      defaultValue: undefined,
      fieldProcessorName: undefined,
    };

    Object.assign(prototype.META.fields, {
      [dataKey ?? propertyName]: meta,
    });

    Object.assign(prototype.META.properties, {
      [propertyName]: dataKey ?? propertyName,
    });

  };
}

export { hasMany };
