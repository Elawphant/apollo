import type { TirService } from "ember-apollo-data/";
import type { NodeRegistry } from "../model/registry";
import type { AttrField, RelationshipField } from "../model/field-mappings";
import { Node } from "../model";
import { getOwner, setOwner } from "@ember/owner";
import { configure } from "ember-apollo-data/utils";
import { assert } from "@ember/debug";
import { ADDON_PREFIX } from "ember-apollo-data/-private/globals";
import type ApplicationInstance from "@ember/application/instance";
import { configureModelConstructor } from "ember-apollo-data/configurators/node-type";





/**
 * Public properties of Any Cache implemented for Tir
 */
interface TirCacheInterface {
    // STORE: TirService;
    // KNOWN_NODE_TYPES: Map<keyof NodeRegistry, typeof Node>;
    // DEFAULT_IDENTIFIER_FIELD: AttrField["propertyName"];
    // RECORD_TYPE_TO_IDF: Map<keyof NodeRegistry, AttrField["propertyName"]>;
    // CLIENT_ID_TO_NODE: Map<Node["CLIENT_ID"], Node>;
    // IDENTIFIER_TO_CLIENT_ID: Map<
    //     `${keyof NodeRegistry}:${AttrField["propertyName"]}:${(typeof Node.Meta)[string]["dataKey"]}`,
    //     Node["CLIENT_ID"]
    // >;
    // TO_ONE_RELATIONS: Map<
    //     `${Node["CLIENT_ID"]}:${RelationshipField["propertyName"]}`,
    //     `${Node["CLIENT_ID"]}:${RelationshipField["propertyName"]}` | null
    // >;
    // TO_MANY_RELATIONS: Map<
    //     `${keyof NodeRegistry}:${(typeof Node.Meta)[string]["propertyName"]}:${Node["CLIENT_ID"]}`,
    //     Set<Node["CLIENT_ID"]>
    // >;

}

class TirCache {
    declare readonly store: TirService;

    /** Runtime registrable node types for rapid configuration of node types */
    declare protected readonly KNOWN_NODE_TYPES: Map<keyof NodeRegistry, typeof Node>;
  
    /** A global default key to use if no key is specified. defaults to "id" */
    declare protected readonly DEFAULT_IDENTIFIER_FIELD: AttrField["propertyName"];
  

    constructor(store: TirService, defaultIdentifierField?: string) {
        configure(store, this);
        this.KNOWN_NODE_TYPES = new Map();
        this.DEFAULT_IDENTIFIER_FIELD = defaultIdentifierField ?? "id";
    }

    public modelFor = (modelName: string): typeof Node => {
        if (!this.KNOWN_NODE_TYPES.get(modelName)) {
          const RawModelConstructor = (
            getOwner(this) as ApplicationInstance
          ).resolveRegistration(`node:${modelName}`) as typeof Node | undefined;
          assert(
            `${ADDON_PREFIX}: No model extending Node found for ${modelName}`,
            RawModelConstructor && typeof RawModelConstructor === typeof Node,
          );
          const shimInstance = new RawModelConstructor(this.store);
          const constructor = configureModelConstructor(shimInstance, modelName);
          this.KNOWN_NODE_TYPES.set(modelName, constructor);
        };
        return this.KNOWN_NODE_TYPES.get(modelName)!;
      };
        
} 

export { TirCache }; 