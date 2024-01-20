import Node from './node';
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
    if (!target['Meta']) {
      target['Meta'] = {};
    }
    if (!target.Meta[propertyName]) {
      target.Meta[propertyName] = {
        propertyName: propertyName,
        modelName: modelName,
        fieldType: 'relationship',
        inverse: options.inverse,
        relationshipType: 'belongsTo',
        isClientField: true,
        dataKey: options?.attrName ?? propertyName,
        fieldProcessorName:
          options?.fieldProcessorName ?? 'default-node-relation',
        getter: async function () {
          // @ts-ignore
          const modelInstance: Node = this;
          const fieldState = modelInstance.store.internalStore.stateForField(modelInstance.CLIENT_ID, propertyName as string);
          let relation: Node | null = null;
          if (fieldState.loaded && modelInstance.loaded){
            relation = modelInstance.store.internalStore.getRelatedNode(modelInstance.CLIENT_ID, propertyName as string);
          } else {
            await modelInstance.store.query([{
              [(modelInstance.constructor as typeof Node).modelName]: {
                type: "node",
                fields: [options?.attrName ?? propertyName as string],
                variables: {
                  id: modelInstance.id
                }
              }
            }]);
          };
          return relation;
        },
        setter: function (value: Node | null) {
          // @ts-ignore
          const modelInstance: Node = this;
          modelInstance.store.internalStore.toBelongsToRelation(modelInstance, propertyName as string, value);
          modelInstance.store.internalStore.updatefieldState(
            modelInstance, 
            propertyName as string, 
            { changed: true }
          );

        },
      } as RelationshipField;
    }
  };
}

export default belongsTo;
