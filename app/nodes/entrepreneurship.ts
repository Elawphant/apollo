import {
  Node,
  attr,
  hasMany,
  type ApolloConfig,
} from 'ember-apollo-data/model';
import type User from './user';

export default class Entrepreneurship extends Node {
  @attr('string', { defaultValue: 'Anonymouse' })
  declare name: string;
  @hasMany('user')
  declare users: User;

  static APOLLO_CONFIG: ApolloConfig = {
    queryRootField: 'entrepreneurship',
    createRootField: 'createEntrepreneurship',
    updateRootField: 'updateEntrepreneurship',
    deleteRootField: 'deleteEntrepreneurship',
    createInputTypeName: 'EntrepreneurshipCreateMutationInput',
    updateInputTypeName: 'EntrepreneurshipUpdateMutationInput',
    deleteInputTypeName: 'EntrepreneurshipDeleteMutationInput',
  };
}
