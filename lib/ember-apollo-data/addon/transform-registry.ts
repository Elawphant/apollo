import EADTransform from './transform/transform';
import StringTransform from './builtin-transforms/string';
import NumberTransform from './builtin-transforms/number';
import BooleanTransform from './builtin-transforms/boolean';

export type EADTransformRegistry = {
  [transformName: string]: typeof EADTransform;
};

export const transformRegistry: EADTransformRegistry = {
  string: StringTransform,
  number: NumberTransform,
  boolean: BooleanTransform,
};
