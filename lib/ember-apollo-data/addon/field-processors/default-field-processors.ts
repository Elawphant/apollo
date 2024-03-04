import type { FieldProcessorRegistry } from 'ember-apollo-data/field-processor';
import BooleanTransform from './boolean';
import NumberFieldProcessor from './number';
import StringFieldProcessor from './string';

const DefaultFieldProcessors: FieldProcessorRegistry = {
  string: StringFieldProcessor,
  number: NumberFieldProcessor,
  boolean: BooleanTransform,
};

export { DefaultFieldProcessors };
