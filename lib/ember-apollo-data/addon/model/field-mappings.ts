import { type FieldProcessorRegistry } from 'ember-apollo-data/field-processor';
import { type PodRegistry } from './registry';
import type { Pod } from '.';

export interface AttrField {
  propertyName: string & keyof Pod;
  fieldProcessorName: keyof FieldProcessorRegistry | null;
  fieldType: 'attribute';
  dataKey: string;
  defaultValue: any;
}

export interface RelationshipField {
  propertyName: string & keyof Pod;
  fieldProcessorName: undefined;
  fieldType: 'relationship';
  dataKey: string;
  defaultValue: undefined;

  modelName: keyof PodRegistry;
  relationshipType: 'hasMany' | 'belongsTo';
  inverse: RelationshipField['propertyName'] | null;
  polymorphic?: boolean;
}
