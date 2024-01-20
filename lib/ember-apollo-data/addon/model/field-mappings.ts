import Node from './node';
import { FieldProcessor } from 'ember-apollo-data/field-processor';

/**
 * @prop { keyof Node } propertyName: the property name on Node
 * @prop { (keyof TransformRegistry); } fieldProcessorName: the name of the transformer or null if data is not transformed/ encapsulated
 * @prop { "attribute" } fieldType: kind of field: always "attribute"
 * @prop { { attrName?: string } } options: the options passed to the attr decorator
 * @prop { string } dataKey: the property name on the data that was serialized to field same as propertyName if options.attrName is undefined
 *
 */
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

/**
 * @prop { string keyof Node } propertyName: the property name of the field on the Node
 * @prop { string keyof ModelRegistry } modelName: the modelName of the **related** Node
 * @prop { "relationship" } fieldType: always "relationship",
 * @prop { "hasMany" | "belongsTo" } relationshipType: the type of the relationship - "hasMany" or "belongsTo"
 * @prop { { inverse: keyof Node } } options: options hash passed to the field
 * @prop { string } dataKey: the property name on the data that was serialized to field same as options.attrName of prop if options.attrName is undefined
 */
export interface RelationshipField {
  propertyName: string;
  modelName: string;
  fieldType: 'relationship';
  relationshipType: 'hasMany' | 'belongsTo';

  inverse: string;
  fieldProcessorName: string | null;
  fieldProcessor?: FieldProcessor;

  dataKey: string;
  isClientField?: boolean;
  getter: () => any;
  setter: (value: any) => void;
}
