import { Pod, attr, hasMany, belongsTo } from 'tir/model';
import type Entrepreneurship from './entrepreneurship';
import type { NodeRoot } from 'tir/caches/node-root';

export default class Eshop extends Pod {
  @belongsTo('entrepreneurship', { inverse: 'eshops' })
  declare entrepreneurship: NodeRoot<Entrepreneurship>;
  @attr()
  declare domain: string;
  // Your model code here
}
