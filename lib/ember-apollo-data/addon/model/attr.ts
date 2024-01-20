import { assert } from '@ember/debug';
import {
  type ElementDescriptor,
  type DecoratorPropertyDescriptor,
} from 'ember-apollo-data/-private/util';
import Node from 'ember-apollo-data/model/node';
import type { AttrField } from './field-mappings';

/**
 * A decorator for `Node` properties that configures `Meta` on `Node` prototype.
 *
 * This Meta will be used in store.modelFor and store.INITIALIZE_MODEL_INSTANCE
 * to configure `typeof Node.Meta`, `Node._meta` and set `_meta.getter` and `_meta.setter`
 * on the property on `Node` decorated with `attr`.
 *
 * Defining `fieldProcessorName` will set the existing respective `Transform` on the `tyepof Node.Meta`
 * and instance of it on `Node._meta`, effectively making Transforms statefull, which is
 * very useful for JSONField data and other complex data fields.
 *
 * @param { ?string } fieldProcessorName: the name of the ead-transform.
 *  if none provided, the data will not be transformed.
 *  transforms for `string`, `number` and `boolean` are implemented by default, but can be overwritten by custom transforms;
 * @param { {attrName?: string} } options: the options hash. the hash will be stored in Node's `Meta`;
 * Attr currently supports only one optional option - attrName, which is used in Node's encapsulate method to map the `data[attrName]` to the attr property when they differ
 * @returns a decorator that sets `Meta` keys and values, and does the transformation.
 */
function attr(
  fieldProcessorName?: string,
  options?: { attrName?: string; defaultValue?: any },
): PropertyDecorator;
function attr(
  fieldProcessorName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function attr(
  fieldProcessorName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function attr(
  fieldProcessorName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: [] | [ElementDescriptor[0], ElementDescriptor[1]] | ElementDescriptor
): PropertyDecorator | DecoratorPropertyDescriptor | void {
  assert(
    `Transformer name must be string if provided`,
    !fieldProcessorName ||
    (fieldProcessorName && typeof fieldProcessorName === 'string'),
  );

  return function (target: any, propertyName: string | symbol): any {
    if (!target['Meta']) {
      target['Meta'] = {};
    }
    if (!target.Meta[propertyName]) {
      target.Meta[propertyName] = {
        propertyName: propertyName,
        fieldProcessorName: fieldProcessorName ?? null,
        fieldType: 'attribute',
        dataKey: options?.attrName ?? propertyName,
        defaultValue: options?.defaultValue ?? null,
        getter: async function () {
          // @ts-ignore
          const modelInstance: Node = this;

          const fieldProcessor = (
            modelInstance._meta[propertyName as string] as AttrField
          ).fieldProcessor;
          const data = modelInstance.localState.get(propertyName as string);
          if (fieldProcessor) {
            return fieldProcessor.deserialize(data);
          }
          const fieldState = modelInstance.store.internalStore.stateForField(modelInstance.CLIENT_ID, propertyName as string);
          if (fieldState.loaded && modelInstance.loaded) {
            return data;
          };
          // query the store for the field as sideEffect
          if (modelInstance.id) {
            await modelInstance.store.query([{
              [(modelInstance.constructor as typeof Node).modelName]: {
                type: "node",
                fields: [options?.attrName ?? propertyName as string],
                variables: {
                  id: modelInstance.id,
                }
              }
            }]);
          };
          return data;
        },
        setter: function (value: any) {
          // @ts-ignore
          const modelInstance: Node = this;
          modelInstance.localState.set(propertyName as string, value);
          modelInstance.store.internalStore.updatefieldState(
            modelInstance, 
            propertyName as string, 
            { changed: true }
          );
        },
      };
    }
  };
}

export default attr;
