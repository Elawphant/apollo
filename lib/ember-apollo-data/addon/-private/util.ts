import type TirService from 'ember-apollo-data/services/tir';
import type { Pod } from 'ember-apollo-data/model';
import type { Variables } from 'graphql-request';

export type DecoratorPropertyDescriptor =
  | (PropertyDescriptor & { initializer?: any })
  | undefined;

export type ElementDescriptor = [
  target: object,
  propertyName: string,
  descriptor?: DecoratorPropertyDescriptor,
];

export type PodDescriptor = [
  target: { store: TirService } & (typeof Pod)['prototype'],
  propertyName: string,
  descriptor?: DecoratorPropertyDescriptor,
];

// TODO: This is not used, consider removing
// https://github.com/emberjs/ember.js/blob/70bcd9facdaf37ba19f60e6a10a511a34724f0f4/packages/%40ember/-internals/metal/lib/decorator.ts#L20-L41
export function isElementDescriptor(args: any) {
  const [maybeTarget, maybeKey, maybeDesc] = args;

  return (
    // Ensure we have the right number of args
    args.length === 3 &&
    // Make sure the target is a class or object (prototype)
    (typeof maybeTarget === 'function' ||
      (typeof maybeTarget === 'object' && maybeTarget !== null)) &&
    // Make sure the key is a string
    typeof maybeKey === 'string' &&
    // Make sure the descriptor is the right shape
    ((typeof maybeDesc === 'object' &&
      maybeDesc !== null &&
      'enumerable' in maybeDesc &&
      'configurable' in maybeDesc) ||
      // TS compatibility
      maybeDesc === undefined)
  );
}

export function identifyConnection(variables: Variables) {
  const { first, last, before, after, offset, ...unsortableVariables } =
    variables;

  // sort paginfo
  const obj = {
    after: after,
    before: before,
    first: first,
    last: last,
    offset: offset,
    ...unsortableVariables,
  };
  return String(obj);
}
