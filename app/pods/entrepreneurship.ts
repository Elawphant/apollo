import { NodePod, attr, hasMany } from 'tir/model';
import type User from './user';

export default class Entrepreneurship extends NodePod {
  @attr({ defaultValue: 'unnamed' })
  declare name: string;
  // @hasMany('user', { inverse: 'entreprenurships' })
  // declare users: User;
}
