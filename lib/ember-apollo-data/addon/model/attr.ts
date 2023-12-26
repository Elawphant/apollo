import { computed, defineProperty, get, set } from '@ember/object';
import { assert } from '@ember/debug';
import {
  type ElementDescriptor,
  type DecoratorPropertyDescriptor,
} from 'ember-apollo-data/-private/util';
import Node from 'ember-apollo-data/model/node';
import type { AttrField } from './field-mappings';
import Transform from 'ember-apollo-data/transform';


/**
 * A decorator for `Node` properties that configures `Meta` on `Node` prototype.
 *
 * This Meta will be used in store.modelFor and store.INITIALIZE_MODEL_INSTANCE
 * to configure `typeof Node.Meta`, `Node._meta` and set `_meta.getter` and `_meta.setter`
 * on the property on `Node` decorated with `attr`.
 *
 * Defining `transformName` will set the existing respective `Transform` on the `tyepof Node.Meta`
 * and instance of it on `Node._meta`, effectively making Transforms statefull, which is
 * very useful for JSONField data and other complex data fields.
 *
 * @param { ?string } transformName: the name of the ead-transform.
 *  if none provided, the data will not be transformed.
 *  transforms for `string`, `number` and `boolean` are implemented by default, but can be overwritten by custom transforms;
 * @param { {attrName?: string} } options: the options hash. the hash will be stored in Node's `Meta`;
 * Attr currently supports only one optional option - attrName, which is used in Node's encapsulate method to map the `data[attrName]` to the attr property when they differ
 * @returns a decorator that sets `Meta` keys and values, and does the transformation.
 */
function attr(
  transformName?: string,
  options?: { attrName?: string; defaultValue?: any },
): PropertyDecorator;
function attr(
  transformName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function attr(
  transformName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function attr(
  transformName?: string,
  options?: { attrName?: string; defaultValue?: any },
  ...args: [] | [ElementDescriptor[0], ElementDescriptor[1]] | ElementDescriptor
): PropertyDecorator | DecoratorPropertyDescriptor | void {
  assert(
    `Transformer name must be string if provided`,
    !transformName || (transformName && typeof transformName === 'string'),
  );

  return function (target: any, propertyName: string | symbol): any {
    if (!target['Meta']) {
      target['Meta'] = {};
    }
    if (!target.Meta[propertyName]) {
      target.Meta[propertyName] = {
        propertyName: propertyName,
        transformName: transformName ?? null,
        fieldType: 'attribute',
        dataKey: options?.attrName ?? propertyName,
        defaultValue: options?.defaultValue ?? null,
        getter: function () {
          // @ts-ignore
          const modelInstance: Node = this;
          const transformInstance = (
            modelInstance._meta[propertyName as string] as AttrField
          ).transform;
          const data = modelInstance.localState.get(propertyName);
          if (transformInstance && transformInstance instanceof Transform) {
            return transformInstance.deserialize(data);
          }
          return data;
        },
        setter: function (value: any) {
          // @ts-ignore
          const modelInstance: Node = this;
          modelInstance.localState.set(propertyName, value);
        },
      };
    }
  };
}

export default attr;
