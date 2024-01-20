import {
  Node,
  attr,
  type TypeConfig,
  belongsTo,
  hasMany,
} from 'ember-apollo-data/model';
import type Entrepreneurship from './entrepreneurship';

export default class User extends Node {
  @attr('string')
  declare email: string;
  @hasMany('entrepreneurship', {inverse: "users"})
  declare entrepreneurships: Entrepreneurship;

  @attr('boolean')
  declare isActive: boolean;

  static TYPE_CONFIG: TypeConfig = {
    queryRootField: 'user',
    createRootField: 'createUser',
    updateRootField: 'updateUser',
    deleteRootField: 'deleteUser',
    createInputTypeName: 'UserCreateMutationInput',
    updateInputTypeName: 'UserUpdateMutationInput',
    deleteInputTypeName: 'UserDeleteMutationInput',
    keyArgs: {},
  };
}
