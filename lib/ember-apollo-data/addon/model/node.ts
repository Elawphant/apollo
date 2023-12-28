import { service } from '@ember/service';
import { computed, get, notifyPropertyChange, set } from '@ember/object';
import EADStoreService from 'ember-apollo-data/services/ead-store';
import { modelRegistry } from 'ember-apollo-data/model-registry';
import type { AttrField, RelationshipField } from './field-mappings';
import { guidFor } from '@ember/object/internals';
import { assert } from '@ember/debug';
import type { ApolloConfig } from './meta';
import { tracked } from 'tracked-built-ins';
import { ApolloError, NetworkStatus, gql } from '@apollo/client';
import {
  configureNodeFragment,
  configureNodeQuery,
  configureNodeVariables,
} from 'ember-apollo-data/-private/configurators';
import { capitalize, dasherize } from '@ember/string';
import type { GraphQLError } from 'graphql';
import { TrackedMap } from 'tracked-built-ins';
import { Connection } from '.';
import { type FieldProcessor } from 'ember-apollo-data/field-processor';
import { addObserver, removeObserver } from '@ember/object/observers';

/**
 * `Node` is a native class responsible for data encapsulation. N.B. `Node` does not extend `EmberObject`.
 * A NodeType extending `Node` must be instanteated via `store`.
 *
 * fields of `Node` are decorated via `@attr`, `@belongsTo` & `@hasMany` decorators.
 * Those decorators configure getters and setters that retrieve or modify data from apollo cache,
 * thus the `Node` is just an encapsulation layer on top of apollo cache.
 *
 * To configure a NodeType, `static APOLLO_CONFIG` property must be defined. See example below.
 *
 * Example:
 * ```
 * import { Node, attr, hasMany, type ApolloConfig, type Connection } from 'ember-apollo-data/model';
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
 *  static APOLLO_CONFIG: ApolloConfig = {
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
export default class Node {
  [key: string]: any;
  private declare _id: string;

  public get id() {
    return this._id || this.CLIENT_ID;
  }

  public set id(id: string) {
    this._id = id;
  }

  declare static modelName: string;
  // static eachAttribute<K extends keyof Node & string>(
  //   callback: (this: ModelSchema<this>, key: K, attribute: AttributeSchema) => void,
  //   binding?: T
  // ): void;
  // static eachRelationship<K extends keyof this & string>(
  //   callback: (this: ModelSchema<this>, key: K, relationship: RelationshipSchema) => void,
  //   binding?: T
  // ): void;
  // static eachTransformedAttribute<K extends keyof this & string>(
  //   callback: (this: ModelSchema<this>, key: K, type: string | null) => void,
  //   binding?: T
  // ): void;
  static isModel: true;

  public declare static APOLLO_CONFIG: ApolloConfig;

  private declare __LOCAL_ID: string;

  public get CLIENT_ID(): string {
    return this.__LOCAL_ID;
  }

  declare static Meta: Record<string, AttrField | RelationshipField>;

  _meta: Record<string, AttrField | RelationshipField> = {};

  public declare __typename: string;

  // TODO instead implement storeFor to get the store that extends this store
  @service('ead-store')
  declare store: EADStoreService;

  private declare __LOCAL_DATA: Object;

  public get CACHE_ID(): string | null | undefined {
    return this.store.client.cache.identify({
      __typename: this.constructor.name,
      __ref: this.id,
    });
  }

  public identifyNode = (id: string) => {
    assert(
      `Node can be assigned only string type id!`,
      id && typeof id === 'string',
    );
    if (id && !this._id) {
      this._id = id;
    }
    // also sync data with local state
    this.syncData();
  };

  constructor() {
    this.__LOCAL_ID = guidFor(this);
    this.localState = tracked(Map);
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

  public rollbackAttributes = () => {
    if (this._id) {
      this.syncData();
    } else {
      this.setDefaultData()
    }
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
      const fieldProcessor = (this._meta[field.propertyName] as AttrField | RelationshipField)
        .fieldProcessor as FieldProcessor;
      mutationData[field.dataKey] = fieldProcessor
        ? fieldProcessor.serialize(this[field.propertyName])
        : this[field.propertyName];
    });
    return mutationData;
  };

  public afterLoading = (executor: ((...args: any) => any)) => {
    const instance = this;
    function executorHandler(){
      removeObserver(instance, 'isLoading', instance, executorHandler);
      executor();
    }
    if (this.isLoading){
      addObserver(this, 'isLoading', this, executorHandler);
    } else {
      executor()
    }
  }

  private syncData = () => {
    assert(`Cannot SyncData with non persisted object.`, this._id);
    if (this.isLoading) {
      this.syncData();
    } else {
      if (this._id) {
        const NodeType = this.constructor as typeof Node
        const fragment = configureNodeFragment(
          this.store,
          NodeType,
        );
        const data = this.store.client.readFragment({
          id: this.store.client.cache.identify({
            __typename: this.constructor.name,
            id: this.id,
          })!,
          fragment: gql(fragment),
        });
        Object.values(NodeType.Meta).forEach((field) => {
          // reassign attrs and belongsTos
          if (field.fieldType === 'attribute') {
            this.localState.set(field.propertyName as string, data ? data[field.dataKey] : undefined);
          }
          // since relations are lazy
          // we must find the connections and nodes in the store and query on them to update them too.
          Object.values(this.store.CONNECTIONS).forEach((connection) => {
            if (connection.parentNode && connection.parentNode.id === this.id) {
              connection.query();
            }
          });
        });
      }
    }
  };

  declare public localState:Map<string, any>;

  @tracked
  isLoading: boolean = false;

  @tracked
  declare networkStatus?: NetworkStatus;

  @tracked
  declare errors?: GraphQLError[];

  @tracked
  declare error?: ApolloError;

  public resetState = () => {
    this.error = this.errors = undefined;
    this.isLoading = false;
    this.syncData()
  };

  query = async () => {
    if (this._id) {
      this.resetState();
      this.isLoading = true;
      const NodeType = this.constructor as typeof Node;
      const query = configureNodeQuery(this.store, NodeType.modelName);
      const fragment = configureNodeFragment(this.store, NodeType)
      const operation = `
          ${fragment}
          query ${NodeType.name}NodeQueryOperation ($id: ID!) {
            ${query}
          }
        `
      const { data, error, errors, loading, networkStatus, partial } = await this.store.client.query({
        query: gql(operation),
        variables: {
          id: this._id,
        }
      });
      this.networkStatus = networkStatus;
      this.isLoading = loading;

      // TODO maybe implement error encapsulation
      this.error = error;
      this.errors = errors as unknown as GraphQLError[];

      if (data) {
        this.resetState();
        // this.syncData();
      }

    }

  }

  queryAsRelation = async (parentNode: Node, fieldNameOnParent: string) => {
    this.resetState();
    const ParentType = parentNode.constructor as typeof Node;
    const RelationType = this.constructor as typeof Node;
    const query = configureNodeQuery(
      this.store,
      ParentType.modelName,
      '',
      '0',
      [fieldNameOnParent],
    );
    const fieldFragment = configureNodeFragment(this.store, RelationType);
    const parentVariables = Object.values(
      configureNodeVariables('', '0'),
    )
      .map(([keyArg, scalar]) => {
        return `$${keyArg}: ${scalar}`;
      })
      .join(', ');
    const operation = `
      ${fieldFragment}
      query ${capitalize(fieldNameOnParent)}On${ParentType.name
      }QueryOperation (${parentVariables}) {
        ${query}
      }
    `;
    const { data, errors, error, loading, networkStatus, partial } =
      await this.store.client.query({
        query: gql(operation),
        variables: {
          [`id0`]: parentNode.id,
        },
      });
    this.networkStatus = networkStatus;
    this.isLoading = loading;

    // TODO maybe implement error encapsulation
    this.error = error;
    this.errors = errors as unknown as GraphQLError[];

    if (data) {
      // remove previous errors
      this.resetState();
      const parentData = data[Object.keys(data)[0]!];
      const fieldData =
        parentData[`${RelationType.name}NodeOn${ParentType.name}0`];
      this.identifyNode(fieldData.id);
    }
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
    return !this._id;
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
    return `<ead-model:${this.__modelName__ as string}:${this.id}>`;
  }

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

  public static get transformedAttributes(): Map<
    keyof Node,
    string
  > {
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
      type: keyof typeof modelRegistry;
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
    keyof typeof modelRegistry,
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

  public static get relatedTypes(): (keyof typeof modelRegistry)[] {
    const list: (keyof typeof modelRegistry)[] = [];
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
}
