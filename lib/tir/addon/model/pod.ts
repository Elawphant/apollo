import { configure } from 'tir/utils';
import type TirService from 'tir/services/tir';
import { clientIdFor } from 'tir/-private/client-id';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';
import { dasherize } from '@ember/string';
import type { PodRegistry } from './registry';
import type { AttrField, RelationshipField } from './field-mappings';
import type { ScalarRoot } from 'tir/caches/scalar-root';
import type { ConnectionRoot } from 'tir/caches/connection-root';
import type { NodeRoot } from 'tir/caches/node-root';
import type { Meta } from './utils';

// TODO: review example in the end
/**
 * `Pod` is a native class responsible for data encapsulation. N.B. `Pod` does not extend `EmberObject`.
 * A Pod Subclass must be instanteated via `tir` service.
 *
 * fields of `Pod` are decorated via `@attr`, `@belongsTo` & `@hasMany` native decorators.
 * Those decorators configure getters and setters that retrieve or modify data from tir-store,
 *
 * Example:
 * ```
 * import { Pod, attr, hasMany, type ConnectionRoot } from 'tir/model';
 * import type Publisher from './publisher';
 *
 * export default class Book extends Pod {
 *  @attr({ defaultValue: 'Unnamed Book' })
 *  declare name: string;
 *  @hasMany('author')
 *  declare authors: Stem<Author>
 *  @belongsTo('publisher')
 *  declare publisher: NodeRoot<Publisher> // Publisher pod
 *
 * ```
 * Now to instantiate it, we call `store.node('book', {id: "RXNob3A6UmpWMmpraWVwRTJyb1BheVlmU3JvOQ=="})`;
 * If we are creating a new record node instance, the `store.create(modelName) must be used,
 * which will automatically set the defaultData on the new Node instance.
 */
class Pod {
  declare readonly store: TirService;
  private declare readonly dataState: Map<
    (AttrField | RelationshipField)['dataKey'],
    ScalarRoot<any> | NodeRoot<Pod> | ConnectionRoot<Pod>
  >;
  declare static modelName: string;
  public declare readonly CLIENT_ID: `${keyof PodRegistry}:${number}`;

  [key: string]: any;

  constructor(store: TirService) {
    configure(store, this);
    this.CLIENT_ID = clientIdFor((this.constructor as typeof Pod).modelName);
  };

  public get isPartial(): boolean {
    return Object.values(this.dataState).every((field) => field.loaded);
  };

  /**
   * TODO: implement graphql folder with types to
   * Sends a respective mutation to the server if corresponding mutations are present in the grpahql folder.
   */
  public save = async (): Promise<void> => {
    // this.store.request();
  };

  public delete = async (): Promise<void> => {
    this.store.markPodForRemoval(this.CLIENT_ID);
  };

  /**
   * Rollbacks changes on the node.
   * Method name is revert instead of rollBackAttributes
   * to be clear that not only attr fields are being rolled back
   */
  public revert = () => {
    // TODO
  };

  static get isModel(): boolean {
    return true;
  }

  /**
   * If this property is `true` the record is in the `dirty` state. The
   * record has local changes that have not yet been saved by the
   * adapter. This includes records that have been created (but not yet
   * saved) or deleted.
   * Example
   * ```javascript
   * let record = store.createRecord('model');
   * record.hasDirtyAttributes; // true
   *  * store.findRecord('model', 1).then(function(model) {
   *   model.hasDirtyAttributes; // false
   *   model.set('foo', 'some value');
   *   model.hasDirtyAttributes; // true
   * });
   * ```
   * @property hasDirtyAttributes
   * @public
   * @type {Boolean}
   * @readOnly
   */
  public get hasDirtyAttributes() {
    // TODO: implement
    // for (const [name, attrField] of this.__attributes__) {
    //   if (this[attrField.name] !== this.__initialState__[attrField.name]) {
    //     return true;
    //   };
    // };
    return false;
  }

  /**
   * If this property is `true` the record is in the `saving` state. A
   * record enters the saving state when `save` is called, but the
   * adapter has not yet acknowledged that the changes have been
   * persisted to the backend.
   *  Example
   * ```javascript
   * let record = store.createRecord('model');
   * record.isSaving; // false
   * let promise = record.save();
   * record.isSaving; // true
   * promise.then(function() {
   *   record.isSaving; // false
   * });
   * ```
   *
   * @property isSaving
   * @public
   * @type {Boolean}
   * @readOnly
   */
  public get isSaving(): boolean {
    // TODO: implement
    return false;
  }

  // TODO: check reactivity
  public get isDeleted(): boolean {
    return this.store.getRemovedPods().has(this.CLIENT_ID);
  }

  /**
  If this property is `true` the record is in the `new` state. A
  record will be in the `new` state when it has been created on the
  client and the adapter has not yet report that it was successfully
  saved.
 
  Example
 
  ```javascript
  let record = store.createRecord('model');
  record.isNew; // true
 
  record.save().then(function(model) {
    model.isNew; // false
  });
  ```
 
  @property isNew
  @public
  @type {Boolean}
  @readOnly
  */
  public get isNew() {
    const { propertyName } = this.store.getIDInfo(
      (this.constructor as typeof Pod).modelName,
    );
    return this[propertyName] !== undefined;
  }

  /**
   *
   * If the record is in the dirty state this property will report what
   * kind of change has caused it to move into the dirty
   * state. Possible values are:
   *
   * - `created` The record has been created by the client and not yet saved to the adapter.
   * - `updated` The record has been updated by the client and not yet saved to the adapter.
   * - `deleted` The record has been deleted by the client and not yet saved to the adapter.
   */
  public get dirtyType() {
    // TODO: not implemented
    // if (!get(this.)) {
    //   return "created";
    // }
    // if (this.hasDirtyAttributes) {
    //   return "updated";
    // }
    // if (this.isDeleted) {
    //   return "deleted"
    // }
    return null;
  }

  /**
   *
   * @returns
   */
  public toString() {
    return `<${dasherize(ERROR_MESSAGE_PREFIX)}-model:${this.CLIENT_ID}>`;
  }

  // public get Meta() {
  //   const Meta = this.store.getFieldMeta(
  //     (this.constructor as typeof Pod).modelName,
  //   );
  //   return new Map(Meta);
  // }

  declare static META: Meta

  // public static META: {
  //   fields: Record<
  //     (AttrField | RelationshipField)['dataKey'],
  //     AttrField | RelationshipField
  //   >;
  //   properties: Record<
  //     (AttrField | RelationshipField)['propertyName'],
  //     (AttrField | RelationshipField)['dataKey']
  //   >;
  // } = {
  //   fields: {},
  //   properties: {},
  // };
}

export { Pod };
