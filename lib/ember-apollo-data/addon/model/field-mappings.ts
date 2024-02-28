import { FieldProcessor } from 'ember-apollo-data/field-processor';
import type { NodeRegistry } from './registry';

export interface AttrField {
  propertyName: string;
  fieldProcessorName: string | null;
  fieldType: 'attribute';
  options: {
    attrName?: string;
  };
  dataKey: string;
  defaultValue: any;
  isClientField?: boolean;
  fieldProcessor?: FieldProcessor;
  getter: () => any;
  setter: (value: any) => void;
}

export interface RelationshipField {
  propertyName: string;
  modelName: keyof NodeRegistry;
  fieldType: 'relationship';
  relationshipType: 'hasMany' | 'belongsTo';

  inverse: RelationshipField["propertyName"] | null;
  fieldProcessorName: string | null;
  fieldProcessor?: FieldProcessor;
  polymorphicTypes?: (keyof NodeRegistry)[];

  dataKey: string;
  isClientField?: boolean;
  getter: () => any;
  setter: (value: any) => void;
}
