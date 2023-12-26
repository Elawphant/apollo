import {
  Node,
  attr,
  type ApolloConfig,
  belongsTo,
} from 'ember-apollo-data/model';

export default class User extends Node {
  @attr('string')
  declare email: string;

  static APOLLO_CONFIG: ApolloConfig = {
    queryRootField: 'user',
    createRootField: 'createUser',
    updateRootField: 'updateUser',
    deleteRootField: 'deleteUser',
    createInputTypeName: 'UserCreateMutationInput',
    updateInputTypeName: 'UserUpdateMutationInput',
    deleteInputTypeName: 'USerDeleteMutationInput',
  };
}
