import {
  Node,
  attr,
  hasMany,
  belongsTo,
  type TypeConfig,
} from 'ember-apollo-data/model';
import type Entrepreneurship from './entrepreneurship';

export default class Eshop extends Node {
  @belongsTo('entrepreneurship', { inverse: "eshops"})
  declare entrepreneurship: Entrepreneurship;
  @attr('string')
  declare domain: string;
  // Your model code here

  static TYPE_CONFIG: TypeConfig = {
    queryRootField: 'eshop',
    createRootField: 'createEshop',
    updateRootField: 'updateEshop',
    deleteRootField: 'deleteEshop',
    createInputTypeName: 'EshopCreateMutationInput',
    updateInputTypeName: 'EshopUpdateMutationInput',
    deleteInputTypeName: 'EshopDeleteMutationInput',
  };
}
