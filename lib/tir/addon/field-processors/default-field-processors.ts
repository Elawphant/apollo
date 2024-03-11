import type { FieldProcessorRegistry } from 'tir/field-processor';
import BooleanTransform from './boolean';
import NumberFieldProcessor from './number';
import StringFieldProcessor from './string';

const DefaultFieldProcessors: FieldProcessorRegistry = {
  string: StringFieldProcessor,
  number: NumberFieldProcessor,
  boolean: BooleanTransform,
};

export { DefaultFieldProcessors };
