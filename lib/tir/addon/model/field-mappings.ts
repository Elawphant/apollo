import { type FieldProcessorRegistry } from 'tir/field-processor';
import { type PodRegistry } from './registry';
import type { Pod } from '.';
import type { FieldProcessor } from 'tir/';

export interface AttrField {
  propertyName: string & keyof Pod;
  fieldProcessorName: keyof FieldProcessorRegistry | null;
  fieldType: 'attribute';
  dataKey: string;
  defaultValue: any;
  alias: boolean;
  processor?: FieldProcessor;
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
  alias: boolean;
}
