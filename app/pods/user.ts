import { NodePod, attr, belongsTo, hasMany } from 'ember-apollo-data/model';
import type Entrepreneurship from './entrepreneurship';
import type { ConnectionRoot } from 'ember-apollo-data/caches/connection-root';

export default class User extends NodePod {
  @attr({ defaultValue: "email@email.com"})
  declare email: string;
  // @hasMany('entrepreneurship', { inverse: 'users' })
  // declare entrepreneurships: ConnectionRoot<Entrepreneurship>;

  @attr()
  declare isActive: boolean;
}
