import { type FieldProcessorRegistryInterface } from 'ember-apollo-data/field-processor';
import BooleanTransform from './boolean';
import NumberFieldProcessor from './number';
import StringFieldProcessor from './string';
import DefaultNodeRelationFieldProcessor from './default-node-relation';
import DefaultConnectionRelationFieldProcessor from './default-connection-relation';

const DefaultFieldProcessors: FieldProcessorRegistryInterface = {
  string: StringFieldProcessor,
  number: NumberFieldProcessor,
  boolean: BooleanTransform,
  'default-node-relation': DefaultNodeRelationFieldProcessor,
  'default-connection-relation': DefaultConnectionRelationFieldProcessor,
};

export { DefaultFieldProcessors };
