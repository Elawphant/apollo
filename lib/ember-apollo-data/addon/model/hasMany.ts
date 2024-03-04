import { Pod } from './pod';
import { assert } from '@ember/debug';
import { type RelationshipField } from './field-mappings';
import type {
  DecoratorPropertyDescriptor,
  ElementDescriptor,
} from 'ember-apollo-data/-private/util';

/**
 * TODO
 * 1. DOCS
 * 2. State Manager Class for updating relations, maybe transformer
 * @param modelName
 * @param options
 */
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
): PropertyDecorator;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: [] | [ElementDescriptor[0], ElementDescriptor[1]] | ElementDescriptor
): PropertyDecorator | DecoratorPropertyDescriptor | void {
  assert(
    `An explicit modelName must be provided as first argument to belongsTo.`,
    !modelName || (modelName && typeof modelName === 'string'),
  );

  return function (target: any, propertyName: string | symbol): any {
    // TODO
  };
}

export default hasMany;
