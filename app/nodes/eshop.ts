import {
  Node,
  attr,
  hasMany,
  belongsTo,
  type ApolloConfig,
} from 'ember-apollo-data/model';
import type Entrepreneurship from './entrepreneurship';

export default class Eshop extends Node {
  @belongsTo('entrepreneurship')
  declare entrepreneurship: Entrepreneurship;
  @attr('string')
  declare domain: string;
  // Your model code here

  static APOLLO_CONFIG: ApolloConfig = {
    queryRootField: 'eshop',
    createRootField: 'createEshop',
    updateRootField: 'updateEshop',
    deleteRootField: 'deleteEshop',
    createInputTypeName: 'EshopCreateMutationInput',
    updateInputTypeName: 'EshopUpdateMutationInput',
    deleteInputTypeName: 'EshopDeleteMutationInput',
  };
}
