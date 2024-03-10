import { Pod, attr, hasMany } from 'ember-apollo-data/model';
import type User from './user';

export default class Entrepreneurship extends Pod {
  @attr({ defaultValue: 'unnamed' })
  declare name: string;
  // @hasMany('user', { inverse: 'entreprenurships' })
  // declare users: User;
}
