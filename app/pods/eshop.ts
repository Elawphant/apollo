import { Pod, attr, hasMany, belongsTo } from 'ember-apollo-data/model';
import type Entrepreneurship from './entrepreneurship';
import type { NodeRoot } from 'ember-apollo-data/caches/node-root';

export default class Eshop extends Pod {
  @belongsTo('entrepreneurship', { inverse: 'eshops' })
  declare entrepreneurship: NodeRoot<Entrepreneurship>;
  @attr()
  declare domain: string;
  // Your model code here
}
