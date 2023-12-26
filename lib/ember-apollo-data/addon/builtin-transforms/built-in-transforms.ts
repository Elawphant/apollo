import Transform from 'ember-apollo-data/transform';
import BooleanTransform from './boolean';
import NumberTransform from './number';
import StringTransform from './string';

const builtInTransforms: { [key: string]: typeof Transform } = {
  string: StringTransform,
  number: NumberTransform,
  boolean: BooleanTransform,
};

export { builtInTransforms };
