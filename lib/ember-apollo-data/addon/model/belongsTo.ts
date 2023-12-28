import Node from './node';
import { set } from '@ember/object';
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
  options?: {
    attrName?: string;
    fieldProcessorName?: string;
  },
): PropertyDecorator;
function belongsTo(
  modelName: string,
  options?: {
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function belongsTo(
  modelName: string,
  options?: {
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function belongsTo(
  modelName: string,
  options?: {
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
    if (!target['Meta']) {
      target['Meta'] = {};
    }
    if (!target.Meta[propertyName]) {
      target.Meta[propertyName] = {
        propertyName: propertyName,
        modelName: modelName,
        fieldType: 'relationship',
        relationshipType: 'belongsTo',
        isClientField: true,
        dataKey: options?.attrName ?? propertyName,
        fieldProcessorName:
          options?.fieldProcessorName ?? 'default-node-relation',
        getter: function () {
          // @ts-ignore
          const modelInstance: Node = this;
          // return the local state if parent is created or the relation is modified
          const prop = propertyName as string;
          if (
            modelInstance.localState.get(prop) !== undefined ||
            modelInstance.isNew
          ) {
            return modelInstance.localState.get(prop);
          }
          const relation = modelInstance.store.node(modelName, {});
          relation.queryAsRelation(
            modelInstance,
            options?.attrName ?? (propertyName as string),
          );
          return relation;
        },
        setter: function (value: Node | null) {
          // @ts-ignore
          const modelInstance: Node = this;
          modelInstance.localState.set(propertyName as string, value);
        },
      } as RelationshipField;
    }
  };
}

export default belongsTo;
