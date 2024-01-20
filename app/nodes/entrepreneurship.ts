import { Node, attr, hasMany, type TypeConfig } from 'ember-apollo-data/model';
import type User from './user';

export default class Entrepreneurship extends Node {
  @attr('string', { defaultValue: 'Anonymouse' })
  declare name: string;
  @hasMany('user', {inverse: 'entreprenurships'})
  declare users: User;

  static TYPE_CONFIG: TypeConfig = {
    queryRootField: 'entrepreneurship',
    createRootField: 'createEntrepreneurship',
    updateRootField: 'updateEntrepreneurship',
    deleteRootField: 'deleteEntrepreneurship',
    createInputTypeName: 'EntrepreneurshipCreateMutationInput',
    updateInputTypeName: 'EntrepreneurshipUpdateMutationInput',
    deleteInputTypeName: 'EntrepreneurshipDeleteMutationInput',
  };
}
