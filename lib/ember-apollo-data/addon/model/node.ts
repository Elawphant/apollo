import { computed, set } from '@ember/object';
import TirService from 'ember-apollo-data/services/tir';
import type { AttrField, RelationshipField } from './field-mappings';
import type { TypeConfig } from './meta';
import { tracked } from 'tracked-built-ins';
import { type FieldProcessor } from 'ember-apollo-data/field-processor';
import { Queryable } from './queryable';
import { assert } from '@ember/debug';
import { type RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { NodeRegistry } from './registry';
import { attr } from '.';
import { defaultConnectionQuery, defaultNodeQuery } from './utils';
import type { GraphQlErrorData, TAliasedNodeData } from './types';
import { clientIdFor } from 'ember-apollo-data/-private/client-id';
import { BaseType } from './base-type';
import { configureErrorHandler, type ErrorHandlerType } from './error';




/**
 * `Node` is a native class responsible for data encapsulation. N.B. `Node` does not extend `EmberObject`.
 * A NodeType extending `Node` must be instanteated via `store`.
 *
 * fields of `Node` are decorated via `@attr`, `@belongsTo` & `@hasMany` decorators.
 * Those decorators configure getters and setters that retrieve or modify data from apollo cache,
 * thus the `Node` is just an encapsulation layer on top of apollo cache.
 *
 * To configure a NodeType, `static TYPE_CONFIG` property must be defined. See example below.
 *
 * Example:
 * ```
 * import { Node, attr, hasMany, type TypeConfig, type Connection } from 'ember-apollo-data/model';
 * import type Publisher from './publisher';
 *
 * export default class Book extends Node {
 *  @attr('string', { defaultValue: 'Unnamed Book' })
 *  declare name: string;
 *  @hasMany('author')
 *  declare authorConnection: Connection; // Author Connection
 *  @belongsTo('publisher')
 *  declare publisher: Publisher // Publisher node
 *
 *  static TYPE_CONFIG: TypeConfig = {
 *    queryRootField: 'book',
 *    createRootField: 'createBook',
 *    updateRootField: 'updateBook',
 *    deleteRootField: 'deleteBook',
 *    createInputTypeName: 'BookCreateMutationInput',
 *    updateInputTypeName: 'BookUpdateMutationInput',
 *    deleteInputTypeName: 'BookDeleteMutationInput',
 *  };
 * }
 * ```
 * Now to instantiate it, we call `store.node('book', {id: "RXNob3A6UmpWMmpraWVwRTJyb1BheVlmU3JvOQ=="})`;
 * If we are creating a new record node instance, the `store.create(modelName) must be used,
 * which will automatically set the defaultData on the new Node instance.
 */
export default class Node extends BaseType {
  @attr("id")
  declare id: string;

  [key: string]: any;

  public get isPartial(): boolean {
    return this.store.getStateForNodeFields(this.CLIENT_ID);
  };

  declare static modelName: string;

  public readonly errors: ErrorHandlerType & { errors: Record<string, string[]> };

  get attrFields() {
    const TYPE = this.constructor as typeof Node
    return Object.values(TYPE.Meta).map(meta => {
      if (meta.fieldType === "attribute") {
        return meta.dataKey;
      }
    }).filter(i => i).join("\n")
  }

  static nodeQuery: string = defaultNodeQuery(this);;

  static connectionQuery: string = defaultConnectionQuery(this);

  static get isModel(): boolean {
    return true;
  };

  // TODO rename TYPE_CONFIG to something else
  public declare static TYPE_CONFIG: TypeConfig;

  public static get GraphQL(): {
    queries: {
      node: string;
      connection: string;
      [key: string]: string | undefined;
    },
    mutations: {
      [key: string]: string | undefined;
    },
    subscriptions: {
      [key: string]: string | undefined;
    }
  } {
    return {
      queries: {
        node: defaultNodeQuery(this),
        connection: defaultConnectionQuery(this),
      },
      mutations: {},
      subscriptions: {},
    }
  }


  declare public readonly CLIENT_ID: string;

  declare static Meta: Record<string, AttrField | RelationshipField>;

  _meta: Record<string, AttrField | RelationshipField> = {};

  public declare __typename: string;

  declare store: TirService;

  // TODO, remove, since we it is in the internal store now
  private declare __LOCAL_DATA: Object;

  constructor(store: TirService) {
    super(store);
    this.localState = tracked(Map);
    this.CLIENT_ID = clientIdFor((this.constructor as typeof Node).modelName);
    this.errors = configureErrorHandler((this.constructor as typeof Node).Meta)
  }

  /**
   * Sends a mutation to the server.
   */
  public save = async (): Promise<void> => {
    this.store.save([this]);
  };

  public delete = async (): Promise<void> => {
    this.isDeleted = true;
  };

  // TODO implement
  public rollbackAttributes = () => {
    // if (this._id) {
    //   this.syncData();
    // } else {
    //   this.setDefaultData()
    // }
  };

  public CONFIGURE_DEFAULT_DATA = () => {
    const data: any = {};
    // Create the initial data object from the instance
    Object.values(this._meta).forEach((field) => {
      if (field.fieldType === 'attribute') {
        set(data, field.propertyName as keyof this, field.defaultValue ?? null);
      }
    });
    return data;
  };

  public serialize = () => {
    const mutationData: Record<string, any> = {};
    // Create the data object from the instance
    Object.values(this._meta).forEach((field) => {
      const fieldProcessor = (
        this._meta[field.propertyName] as AttrField | RelationshipField
      ).fieldProcessor as FieldProcessor;
      mutationData[field.dataKey] = fieldProcessor
        ? fieldProcessor.serialize(this[field.propertyName])
        : this[field.propertyName];
    });
    return mutationData;
  };


  public declare localState: Map<string, any>;

  public resetState = () => {
    this.errors.clear();
  };

  public setDefaultData = () => {
    Object.values(this._meta).forEach((field) => {
      if (field.fieldType === 'attribute') {
        this.localState.set(field.propertyName as string, field.defaultValue);
      }
    });
  };

  /**
    If this property is `true` the record is in the `dirty` state. The
    record has local changes that have not yet been saved by the
    adapter. This includes records that have been created (but not yet
    saved) or deleted.
 
    Example
 
    ```javascript
    let record = store.createRecord('model');
    record.hasDirtyAttributes; // true
 
    store.findRecord('model', 1).then(function(model) {
      model.hasDirtyAttributes; // false
      model.set('foo', 'some value');
      model.hasDirtyAttributes; // true
    });
    ```
 
    @since 1.13.0
    @property hasDirtyAttributes
    @public
    @type {Boolean}
    @readOnly
  */
  public get hasDirtyAttributes() {
    // for (const [name, attrField] of this.__attributes__) {
    //   if (this[attrField.name] !== this.__initialState__[attrField.name]) {
    //     return true;
    //   };
    // };
    return false;
  }

  /**
    If this property is `true` the record is in the `saving` state. A
    record enters the saving state when `save` is called, but the
    adapter has not yet acknowledged that the changes have been
    persisted to the backend.
 
    Example
 
    ```javascript
    let record = store.createRecord('model');
    record.isSaving; // false
    let promise = record.save();
    record.isSaving; // true
    promise.then(function() {
      record.isSaving; // false
    });
    ```
 
    @property isSaving
    @public
    @type {Boolean}
    @readOnly
  */
  @tracked
  public isSaving: boolean = false;

  /**
   * TODO review
    If this property is `true` the record is in the `deleted` state
    and has been marked for deletion. When `isDeleted` is true and
    `hasDirtyAttributes` is true, the record is deleted locally but the deletion
    was not yet persisted. When `isSaving` is true, the change is
    in-flight. When both `hasDirtyAttributes` and `isSaving` are false, the
    change has persisted.
 
    Example
 
    ```javascript
    let record = store.createRecord('model');
    record.isDeleted;    // false
    record.deleteRecord();
 
    // Locally deleted
    record.isDeleted;           // true
    record.hasDirtyAttributes;  // true
    record.isSaving;            // false
 
    // Persisting the deletion
    let promise = record.save();
    record.isDeleted;    // true
    record.isSaving;     // true
 
    // Deletion Persisted
    promise.then(function() {
      record.isDeleted;          // true
      record.isSaving;           // false
      record.hasDirtyAttributes; // false
    });
    ```
 
    @property isDeleted
    @public
    @type {Boolean}
    @readOnly
  */
  @tracked
  public isDeleted: boolean = false;

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
    return !this.id;
  }

  /**
    If this property is `true` the record is in the `valid` state.
 
    A record will be in the `valid` state when the adapter did not report any
    server-side validation failures.
 
    @property isValid
    @public
    @type {Boolean}
    @readOnly
  */
  @computed('currentState')
  public get isValid() {
    return true;
    // this.currentState.isValid;
  }

  /**
  If the record is in the dirty state this property will report what
  kind of change has caused it to move into the dirty
  state. Possible values are:

  - `created` The record has been created by the client and not yet saved to the adapter.
  - `updated` The record has been updated by the client and not yet saved to the adapter.
  - `deleted` The record has been deleted by the client and not yet saved to the adapter.

  Example

  ```javascript
  let record = store.createRecord('model');
  record.dirtyType; // 'created'
  ```

  @property dirtyType
  @public
  @type {String}
  @readOnly
*/
  public get dirtyType() {
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

  public toString() {
    // when used with store.modelFor, the constructor's modelName is set the keyof ModelRegistry for the target's prototype
    // this adheres to ember data's approach to require instantiation of model classes via store.modelFor
    return `<ead-model:${this.CLIENT_ID}>`;
  }

  // TODO consider removing
  public get __modelName__(): string {
    return (this.constructor as typeof Node).modelName;
  }

  public static get attributes(): Map<
    string,
    {
      type: string;
      isAttribute: boolean;
      options: Object;
      name: string;
    }
  > {
    const map = new Map();
    Object.values(this.Meta).forEach((fieldDecl) => {
      if (fieldDecl.fieldType === 'attribute') {
        map.set(fieldDecl.propertyName, {
          //@ts-ignore its ok not to have transformName, as we are filtering out non-attributes later via isAttribute
          type: fieldDecl?.transformName,
          isAttribute: true,
          options: fieldDecl.options,
          name: fieldDecl.propertyName,
        });
      }
    });

    return map;
  }

  public static get transformedAttributes(): Map<keyof Node, string> {
    const map = new Map();
    this.attributes.forEach((attribute, name) => {
      map.set(attribute.name, attribute.type);
    });
    return map;
  }

  public static get relationshipsByName(): Map<
    keyof Node,
    {
      key: keyof Node;
      kind: 'hasMany' | 'belongsTo';
      type: keyof NodeRegistry;
      options: Object;
      isRelationship: boolean;
    }
  > {
    const map = new Map();
    Object.values(this.Meta).forEach((fieldDecl) => {
      if (fieldDecl.fieldType === 'relationship') {
        map.set(fieldDecl.propertyName, {
          key: fieldDecl.propertyName,
          kind: fieldDecl.relationshipType,
          type: fieldDecl.modelName,
          isRelationship: true,
        });
      }
    });
    return map;
  }

  public static get relationships(): Map<
    keyof NodeRegistry,
    {
      name: keyof Node;
      kind: 'hasMany' | 'belongsTo';
    }[]
  > {
    const map = new Map();
    this.relationshipsByName.forEach((relationship, name) => {
      map.set(relationship.key, relationship.kind);
    });
    return map;
  }

  public static get relatedTypes(): (keyof NodeRegistry)[] {
    const list: (keyof NodeRegistry)[] = [];
    this.relationshipsByName.forEach((relationship) => {
      list.push(relationship.type);
    });
    return list;
  }

  public static get relationshipNames(): {
    hasMany: (keyof Node)[];
    belongsTo: (keyof Node)[];
  } {
    const map: { hasMany: (keyof Node)[]; belongsTo: (keyof Node)[] } = {
      hasMany: [],
      belongsTo: [],
    };
    this.relationshipsByName.forEach((relationship, name) => {
      map[relationship.kind].push(relationship.key);
    });
    return map;
  }

  public static get fields(): Map<string, { [key: string]: string }> {
    const map = new Map();
    this.attributes.forEach((attribute, name) => {
      map.set(name, 'attribute');
    });
    this.relationshipsByName.forEach((relationship, name) => {
      map.set(relationship.key, relationship.kind);
    });
    return map;
  }

  protected get queryConfig(): { [modelName: keyof NodeRegistry]: RootQueryDescription } {
    assert(`Cannot query a Node without id.`, (this as unknown as Node).id);
    return {
      [(this.constructor as unknown as typeof Node).modelName]: {
        type: "node",
        variables: {
          id: (this as unknown as Node).id
        }
      }
    }
  }

}
