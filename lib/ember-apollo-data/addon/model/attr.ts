import { assert } from '@ember/debug';
import type { AttrField } from './field-mappings';
import type { Pod } from '.';
import { ERROR_MESSAGE_PREFIX } from 'ember-apollo-data/-private/globals';


function attr(
  options?: { dataKey?: string; defaultValue?: any, fieldProcessorName?: string },
): PropertyDecorator {

  return function (target: Pod["prototype"], propertyName: string | symbol): void {
    const prototype = target as Pod["prototype"];
    assert(`${ERROR_MESSAGE_PREFIX}Decorator ${attr.prototype.name} can only be applied to "string" properties`, typeof propertyName === "string");

    const { dataKey, defaultValue, fieldProcessorName } = options ?? {};

    const meta: AttrField = {
      propertyName: propertyName,
      fieldProcessorName: fieldProcessorName ?? null,
      fieldType: 'attribute',
      dataKey: dataKey ?? propertyName,
      defaultValue: defaultValue ?? null,
    };

    Object.assign(prototype.META.fields, {
      [dataKey ?? propertyName]: meta
    });

    Object.assign(prototype.META.properties, {
      [propertyName]: dataKey ?? propertyName
    });

    Object.defineProperty<Pod>(target, propertyName, {
      get() {
        const modelName = target.constructor.modelName;
        return this.store.getRoot({
          modelName: modelName,
          root: dataKey ?? propertyName,
          client: target.CLIENT_ID
        }).currentValue;
      },
      set(value: any) {
        const modelName = target.constructor.modelName;
        this.store.updateRoot({
          modelName: modelName,
          root: dataKey ?? propertyName,
          client: target.CLIENT_ID
        }, value, null, null);
      },
    });
  };
};

export default attr;
