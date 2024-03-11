import { NodePod, attr, belongsTo, hasMany } from 'tir/model';
import type Entrepreneurship from './entrepreneurship';

export default class User extends NodePod {
  @attr({ defaultValue: "email@email.com"})
  declare email: string;
  // @hasMany('entrepreneurship', { inverse: 'users' })
  // declare entrepreneurships: ConnectionRoot<Entrepreneurship>;

  @attr()
  declare isActive: boolean;
}
