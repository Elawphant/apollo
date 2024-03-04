import { FieldProcessor } from 'ember-apollo-data/field-processor';
import type { PodRegistry } from './registry';

export interface AttrField {
  propertyName: string;
  fieldProcessorName: string | null;
  fieldType: 'attribute';
  dataKey: string;
  defaultValue: any;
  // getter: () => any;
  // setter: (value: any) => void;
}

export interface RelationshipField {
  propertyName: string;
  fieldProcessorName: undefined;
  fieldType: 'relationship';
  dataKey: string;
  defaultValue: undefined;

  modelName: keyof PodRegistry;
  relationshipType: 'hasMany' | 'belongsTo';
  inverse: RelationshipField["propertyName"] | null;
  realInverse: RelationshipField["dataKey"] | null;
  polymorphic?: boolean;

  // getter: () => any;
  // setter: (value: any) => void;
}
