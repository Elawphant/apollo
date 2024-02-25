import { PageInfoArgs } from "ember-apollo-data/queries/pagination";
import type { Variables } from "graphql-request";

export type DecoratorPropertyDescriptor =
  | (PropertyDescriptor & { initializer?: any })
  | undefined;
export type ElementDescriptor = [
  target: object,
  propertyName: string,
  descriptor?: DecoratorPropertyDescriptor,
];

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

type DataDecorator = (
  target: object,
  key: string,
  desc?: DecoratorPropertyDescriptor,
) => DecoratorPropertyDescriptor;
type DataDecoratorFactory = (...args: unknown[]) => DataDecorator;

export function computedMacroWithOptionalParams(
  fn: DataDecorator | DataDecoratorFactory,
) {
  return (...maybeDesc: unknown[]) =>
    isElementDescriptor(maybeDesc)
      ? (fn as DataDecoratorFactory)()(...(maybeDesc as ElementDescriptor))
      : fn(...(maybeDesc as [object, string, DecoratorPropertyDescriptor?]));
}




export function identifyConnection(variables: Variables) {
  const { first, last, before, after, offset, ...unsortableVariables } = variables;
  
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

/**
 * ```
 * {
 *  type: "node" | "connection";
 *  fields?: QueryFieldDeclaration[];
 *  variables?: Object;
 * }
 * ```
 */
export interface RootQueryDescription {
  type: 'node' | 'connection';
  fields?: QueryFieldDeclaration[];
  variables?: Record<string, any>;
}

export type QueryFieldDeclaration =
  | string
  | Record<string, QueryFieldDeclaration[]>;
