import TirService from 'ember-apollo-data/services/tir';
import { attr } from '.';
import { BaseType } from './base-type';




/**
 * `Node` is a native class responsible for data encapsulation. N.B. `Node` does not extend `EmberObject`.
 * A NodeType extending `Node` must be instanteated via `tir service`.
 *
 * fields of `Node` are decorated via `@attr`, `@belongsTo` & `@hasMany` decorators.
 * Those decorators configure getters and setters that retrieve or modify data from tir-store,
 * thus the `Node` is just an encapsulation layer on top of tir-store.
 *
 * Example:
 * ```
 * import { Node, attr, hasMany, type ConnectionRoot } from 'ember-apollo-data/model';
 * import type Publisher from './publisher';
 *
 * export default class Book extends Node {
 *  @attr('string', { defaultValue: 'Unnamed Book' })
 *  declare name: string;
 *  @hasMany('author')
 *  declare authorConnection: ConnectionRoot; // Author Connection
 *  @belongsTo('publisher')
 *  declare publisher: Publisher // Publisher node -> TODO: introduce AsyncType
 *
 * ```
 * Now to instantiate it, we call `store.node('book', {id: "RXNob3A6UmpWMmpraWVwRTJyb1BheVlmU3JvOQ=="})`;
 * If we are creating a new record node instance, the `store.create(modelName) must be used,
 * which will automatically set the defaultData on the new Node instance.
 */
export default class Node extends BaseType {
  @attr("id")
  declare id: string;

  constructor(store: TirService) {
    super(store);
  }

}
