import { configure } from "ember-apollo-data/utils";
import type { TirService } from "ember-apollo-data/";
import type { AttrField, RelationshipField } from "./field-mappings";
import { assert } from "@ember/debug";
import { getOwner } from "@ember/owner";
import type { FieldProcessor } from "ember-apollo-data/field-processor";
import { DefaultFieldProcessors } from "ember-apollo-data/field-processors/default-field-processors";
import { tracked } from "tracked-built-ins";
import { clientIdFor } from "ember-apollo-data/-private/client-id";
import { ADDON_PREFIX } from "ember-apollo-data/-private/globals";
import { dasherize } from "@ember/string";
import type { NodeRegistry } from "./registry";
import type { Node } from ".";




class BaseType {
  declare readonly store: TirService;
  declare static modelName: string;
  declare public readonly CLIENT_ID: string;

  [key: string]: any;

  declare static Meta: {
    [key: string]: AttrField | RelationshipField
  }

  declare _meta: typeof BaseType.Meta;

  constructor(store: TirService) {
    configure(store, this);
    this.CLIENT_ID = clientIdFor((this.constructor as typeof BaseType).modelName);
    this.initializeFields();
  }

  private initializeFields = () => {
    const Meta = (this.constructor as typeof BaseType).Meta;
    Object.keys(Meta).forEach((fieldName) => {
      const propertyName: string = Meta[fieldName]!.propertyName;
      const fieldProcessorName = Meta[fieldName]!.fieldProcessorName;
      if (fieldProcessorName) {
        // Lookup for defined field processor in field processors
        let Processor = getOwner(this)!.lookup(
          `field-processor:${fieldProcessorName}`,
        ) as typeof FieldProcessor | undefined;
        // Try looking up in default field processors
        if (!Processor) {
          Processor =
            DefaultFieldProcessors[fieldProcessorName];
        }
        assert(
          `No field processor with name "${Meta[fieldName]!.fieldProcessorName}" was found.`,
          Processor,
        );
        if (Processor) {
          // initialize a field processor and set it on _meta
          (this._meta[fieldName] as AttrField).fieldProcessor = new Processor(
            this.store,
          )!;
        };
      };
      Object.defineProperty(this, propertyName, {
        get: Meta[propertyName]!.getter,
        set: Meta[propertyName]!.setter,
        enumerable: true,
        configurable: true,
      });
    });
  };

  public get isPartial(): boolean {
    return this.store.getStateForNodeFields(this.CLIENT_ID);
  };

  /**
   * TODO: implement graphql folder with types to 
   * send a mutation to the server.
   */
  public save = async (): Promise<void> => {
    // this.store.request();
  };

  public delete = async (): Promise<void> => {
    this.store.markNodeForRemoval(this.CLIENT_ID);
  };

  /** 
   * Rollbacks changes on the node. 
   * Method name is revert instead of rollBackAttributes
   * to be clear that not only attr fields are being rolled back
  */
  public revert = () => {
    this.store.revertNode(this as unknown as Node);
  };

  get attrFields() {
    const TYPE = this.constructor as typeof BaseType
    return Object.values(TYPE.Meta).map(meta => {
      if (meta.fieldType === "attribute") {
        return meta.dataKey;
      }
    }).filter(i => i).join("\n")
  }

  static get isModel(): boolean {
    return true;
  };

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
  };


  /**
  * TODO review: maybe convert to getter
  * If this property is `true` the record is in the `deleted` state
  * and has been marked for deletion. When `isDeleted` is true and
  * `hasDirtyAttributes` is true, the record is deleted locally but the deletion
  * was not yet persisted. When `isSaving` is true, the change is
  * in-flight. When both `hasDirtyAttributes` and `isSaving` are false, the
  * change has persisted.
  *   Example
  *   ```javascript
  * let record = store.createRecord('model');
  * record.isDeleted;    // false
  * record.deleteRecord();
  *   // Locally deleted
  * record.isDeleted;           // true
  * record.hasDirtyAttributes;  // true
  * record.isSaving;            // false
  *   // Persisting the deletion
  * let promise = record.save();
  * record.isDeleted;    // true
  * record.isSaving;     // true
  *   // Deletion Persisted
  * promise.then(function() {
  *   record.isDeleted;          // true
  *   record.isSaving;           // false
  *   record.hasDirtyAttributes; // false
  * });
  * ```
  * @property isDeleted
  * @public
  * @type {Boolean}
  * @readOnly
  */
  public get isDeleted(): boolean {
    return this.store.getRemovedNodes().has(this.CLIENT_ID);
  };


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
    const { propertyName } = this.store.getIDInfo((this.constructor as typeof BaseType).modelName);
    return this[propertyName] !== undefined;
  }

  /**
  * If the record is in the dirty state this property will report what
  * kind of change has caused it to move into the dirty
  * state. Possible values are:
  * 
  * - `created` The record has been created by the client and not yet saved to the adapter.
  * - `updated` The record has been updated by the client and not yet saved to the adapter.
  * - `deleted` The record has been deleted by the client and not yet saved to the adapter.
  * Example
  * ```javascript
  * let record = store.createRecord('model');
  * record.dirtyType; // 'created'
  * ```
  * 
  * @property dirtyType
  * @public
  * @type {String}
  * @readOnly
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

  // TODO: add docstring
  public toString() {
    return `<${dasherize(ADDON_PREFIX)}-model:${this.CLIENT_ID}>`;
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



};


export { BaseType };