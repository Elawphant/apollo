import { Pod } from './pod';
import { assert } from '@ember/debug';
import { type RelationshipField } from './field-mappings';
import type {
  DecoratorPropertyDescriptor,
  ElementDescriptor,
} from 'ember-apollo-data/-private/util';

/**
 *
 */
function belongsTo(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
): PropertyDecorator;
function belongsTo(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function belongsTo(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function belongsTo(
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
    
  };
}

export default belongsTo;
