import { NodeRegistry } from 'ember-apollo-data/model-registry';

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

export function identifyConnection(obj: any) {
  if (typeof obj !== 'object' || obj === null) {
    // Non-object values (primitives, null, etc.)
    return String(obj);
  }

  if (Array.isArray(obj)) {
    // Handle arrays
    const arrayRepresentation: string = obj
      .sort()
      .map((item) => identifyConnection(item))
      .join(',');
    return `[${arrayRepresentation}]`;
  }

  // Handle objects
  const sortedKeys = Object.keys(obj).sort();
  const objectRepresentation: string = sortedKeys
    .map((key) => `${key}:${identifyConnection(obj[key])}`)
    .join(',');

  return `{${objectRepresentation}}`;
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
