import type { TirService } from "ember-apollo-data/";
import type { PodRegistry } from "../model/registry";
import type { AttrField, RelationshipField } from "../model/field-mappings";
import { Pod } from "../model";
import { getOwner } from "@ember/owner";
import { configure, configurePrototype } from "ember-apollo-data/utils";
import { assert } from "@ember/debug";
import { ERROR_MESSAGE_PREFIX, NAMING_CONVENTIONS } from "ember-apollo-data/-private/globals";
import type ApplicationInstance from "@ember/application/instance";
import { tracked } from "tracked-built-ins";
import type { ClientId, RootRef } from "ember-apollo-data/model/types";
// TODO: remove polyfil once issue with ember is resolved: 
// <https://github.com/ember-polyfills/ember-cached-decorator-polyfill?tab=readme-ov-file#typescript-usage>
import 'ember-cached-decorator-polyfill';
import { cached } from '@glimmer/tracking';






abstract class TirCache {
  declare readonly store: TirService;

  /** Runtime registrable pod types for rapid configuration */
  declare protected readonly KNOWN_POD_TYPES: Map<keyof PodRegistry, typeof Pod>;
  declare protected readonly FIELD_META: Map<
    keyof PodRegistry,
    Map<
      AttrField["dataKey"] | RelationshipField["dataKey"],
      AttrField | RelationshipField
    >
  >;

  /** For inverse relations retrival */
  declare protected readonly PROPERTY_NAME_TO_DATA_KEY: Map<
    keyof PodRegistry,
    Map<
      AttrField["propertyName"] | RelationshipField["propertyName"],
      AttrField["dataKey"] | RelationshipField["dataKey"]
    >
  >

  /** A global default key to use if no key is specified. defaults to "id" */
  declare protected readonly DEFAULT_IDENTIFIER_FIELD: AttrField["dataKey"];

  @tracked
  declare protected readonly CLIENT_ID_TO_POD: Map<ClientId, Pod>;


  constructor(store: TirService, defaultIdentifierField?: string) {
    configure(store, this);
    this.KNOWN_POD_TYPES = new Map();
    this.DEFAULT_IDENTIFIER_FIELD = defaultIdentifierField ?? "id";
    this.FIELD_META = new Map();
    this.CLIENT_ID_TO_POD = new Map();
    this.PROPERTY_NAME_TO_DATA_KEY = new Map();
  };

  @cached
  protected get namingConventions(){
    return this.store.config.namingConventions ?? NAMING_CONVENTIONS;
  };


  public modelFor = (modelName: string): typeof Pod => {
    if (!this.KNOWN_POD_TYPES.get(modelName)) {
      const RawModelConstructor = (
        getOwner(this) as ApplicationInstance
      ).resolveRegistration(`pod:${modelName}`) as typeof Pod | undefined;
      assert(
        `${ERROR_MESSAGE_PREFIX}No model extending Pod found for ${modelName}`,
        RawModelConstructor && typeof RawModelConstructor === typeof Pod,
      );
      RawModelConstructor.modelName = modelName;
      this.KNOWN_POD_TYPES.set(modelName, RawModelConstructor);
      this.FIELD_META.set(modelName, new Map(Object.entries(RawModelConstructor.META.fields)));
      this.PROPERTY_NAME_TO_DATA_KEY.set(modelName, new Map(Object.entries(RawModelConstructor.META.properties)));
    };
    return this.KNOWN_POD_TYPES.get(modelName)!;
  };

  // TODO: Maybe add possibility to define custom regex 
  protected parseAlias = (alias: string): {
    typeName: keyof PodRegistry | undefined,
    type: TirCache["namingConventions"]["item"] | TirCache["namingConventions"]["set"] | undefined,
    identifier: string | null
  } | null => {
    // This regex looks for a starting capital letter (indicating PascalCase)
    // followed by any combination of letters (the type name),
    // and then it tries to capture either "Pod" or "Stem" followed by any characters (additional suffixes or identifiers).
    // This regex ensures that both typeName and type are present in the alias
    const regex = /^([A-Z][a-zA-Z]*)(Pod|Stem)(.*)$/;
    const match = alias.match(regex);

    if (match) {
      return {
        typeName: match[1], // The type name extracted
        type: match[2] as TirCache["namingConventions"]["item"] | TirCache["namingConventions"]["set"] | undefined, // Whether it's a Pod or Stem
        identifier: match[3] || null // The additional identifier/suffix, if any
      };
    } else {
      // Return null if alias doesn't follow the expected format. This will result in skipping encapuslation
      return null;
    };
  };

  public getPropertiesForType = (modelName: keyof PodRegistry): Map<
    AttrField["propertyName"] | RelationshipField["propertyName"],
    AttrField["dataKey"] | RelationshipField["dataKey"]
  > => {
    // ensures meta registration
    this.modelFor(modelName); 
    return this.PROPERTY_NAME_TO_DATA_KEY.get(modelName)!;
  };

  public getFieldMetaForType = (modelName: keyof PodRegistry) => {
    // ensures meta registration
    this.modelFor(modelName);
    return this.FIELD_META.get(modelName)!;
  };
}

export { TirCache }; 