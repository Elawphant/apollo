import { assert } from '@ember/debug';
import type { AttrField } from './field-mappings';
import type { Pod } from '.';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';
import { ensurePodMeta } from './utils';

function attr(options?: {
  dataKey?: string;
  defaultValue?: any;
  fieldProcessorName?: string;
}): PropertyDecorator {
  return function (
    target: Pod['prototype'],
    propertyName: string | symbol,
  ): void {
    assert(
      `${ERROR_MESSAGE_PREFIX}Decorator ${attr.prototype.name} can only be applied to "string" properties`,
      typeof propertyName === 'string',
    );

    ensurePodMeta(target);

    const { dataKey, defaultValue, fieldProcessorName } = options ?? {};
    

    const meta: AttrField = {
      propertyName: propertyName,
      fieldProcessorName: fieldProcessorName ?? null,
      fieldType: 'attribute',
      dataKey: dataKey ?? propertyName,
      defaultValue: defaultValue ?? null,
      alias: dataKey !== undefined ?  true : false,
    };

    Object.assign(target.constructor.META.fields, {
      [dataKey ?? propertyName]: meta,
    });

    Object.assign(target.constructor.META.properties, {
      [propertyName]: dataKey ?? propertyName,
    });
  };
}

export { attr };
