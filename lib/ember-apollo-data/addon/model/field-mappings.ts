import { transformRegistry } from 'ember-apollo-data/transform-registry';
import EADModel from './node';
import { modelRegistry } from 'ember-apollo-data/model-registry';
import type Transform from 'ember-apollo-data/transform';

/**
 * @prop { keyof EADModel } propertyName: the property name on EADModel
 * @prop { (keyof TransformRegistry); } transformName: the name of the transformer or null if data is not transformed/ encapsulated
 * @prop { "attribute" } fieldType: kind of field: always "attribute"
 * @prop { { attrName?: string } } options: the options passed to the attr decorator
 * @prop { string } dataKey: the property name on the data that was serialized to field same as propertyName if options.attrName is undefined
 *
 */
export interface AttrField {
  propertyName: keyof EADModel;
  transformName: keyof typeof transformRegistry | null;
  fieldType: 'attribute';
  options: {
    attrName?: string;
  };
  dataKey: string;
  defaultValue: any;
  isClientField?: boolean;
  transform?: typeof Transform | Transform;
  getter: () => any;
  setter: (value: any) => void;
}

/**
 * @prop { keyof EADModel } propertyName: the property name of the field on the EADModel
 * @prop { keyof ModelRegistry } modelName: the modelName of the **related** EADModel
 * @prop { "relationship" } fieldType: always "relationship",
 * @prop { "hasMany" | "belongsTo" } relationshipType: the type of the relationship - "hasMany" or "belongsTo"
 * @prop { { inverse: keyof EADModel } } options: options hash passed to the field
 * @prop { string } dataKey: the property name on the data that was serialized to field same as options.attrName of prop if options.attrName is undefined
 */
export interface RelationshipField {
  propertyName: keyof EADModel;
  modelName: string;
  fieldType: 'relationship';
  relationshipType: 'hasMany' | 'belongsTo';

  // CONSIDER removing inverse, as we opt for implicit inverses as apollodata comes in, not to overwhelm the ember app
  dataKey: string;
  isClientField?: boolean;
  getter: () => any;
  setter: (value: any) => void;
}
