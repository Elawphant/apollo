import type { FieldProcessor } from 'tir/field-processor';
import type { PodRegistry } from '../model/registry';
import type { AttrField, RelationshipField } from '../model/field-mappings';
import { Pod } from '../model';
import { getOwner } from '@ember/owner';
import { configure } from 'tir/utils';
import { assert } from '@ember/debug';
import {
  ERROR_MESSAGE_PREFIX,
  NAMING_CONVENTIONS,
} from 'tir/-private/globals';
import type ApplicationInstance from '@ember/application/instance';
import { tracked } from 'tracked-built-ins';
import type {
  ClientId,
  RootRef,
  TPodData,
} from 'tir/model/types';
// TODO: remove polyfil once issue with ember is resolved:
// <https://github.com/ember-polyfills/ember-cached-decorator-polyfill?tab=readme-ov-file#typescript-usage>
import 'ember-cached-decorator-polyfill';
import { cached } from '@glimmer/tracking';
import { ConnectionRoot } from './connection-root';
import { NodeRoot } from './node-root';
import { ScalarRoot } from './scalar-root';
import { DefaultFieldProcessors } from 'tir/field-processors';
import type TirService from 'tir/services/tir';
import type Owner from '@ember/owner';

abstract class TirCache {
  declare readonly store: TirService;

  /** Runtime registrable pod types for rapid configuration */
  protected declare readonly KNOWN_POD_TYPES: Map<
    keyof PodRegistry,
    typeof Pod
  >;
  protected declare readonly FIELD_META: Map<
    keyof PodRegistry,
    Map<
      AttrField['dataKey'] | RelationshipField['dataKey'],
      AttrField | RelationshipField
    >
  >;

  /** For inverse relations retrival */
  protected declare readonly PROPERTY_NAME_TO_DATA_KEY: Map<
    keyof PodRegistry,
    Map<
      AttrField['propertyName'] | RelationshipField['propertyName'],
      AttrField['dataKey'] | RelationshipField['dataKey']
    >
  >;

  /** A global default key to use if no key is specified. defaults to "id" */
  protected declare readonly DEFAULT_IDENTIFIER_FIELD: AttrField['dataKey'];

  @tracked
  protected declare readonly CLIENT_ID_TO_POD: Map<ClientId, Pod>;

  @tracked
  protected declare readonly BONDS: Map<
    ClientId,
    Set<
      | `${keyof PodRegistry}:${RelationshipField['dataKey']}:${ClientId}`
      | `${keyof PodRegistry}:${string}`
    >
  >;

  @tracked // string in map key is the root field name of the GraphQL query
  protected declare readonly ROOTS: Map<
    | `${keyof PodRegistry}:${RelationshipField['dataKey']}:${ClientId}`
    | `${keyof PodRegistry}:${string}`,
    ScalarRoot<any> | NodeRoot<Pod> | ConnectionRoot<Pod>
  >;

  /** Map of modelName to server side identifier field, e.g. user: username */
  protected declare readonly RECORD_TYPE_TO_IDF: Map<
    keyof PodRegistry,
    AttrField['dataKey']
  >;

  @tracked
  protected declare readonly IDENTIFIER_TO_CLIENT_ID: Map<
    `${keyof PodRegistry}:${AttrField['dataKey']}`,
    ClientId
  >;

  @tracked
  protected declare readonly REMOVED_PODS: Set<ClientId>;

  constructor(store: TirService, defaultIdentifierField?: string) {
    configure(store, this);
    this.KNOWN_POD_TYPES = new Map();
    this.DEFAULT_IDENTIFIER_FIELD = defaultIdentifierField ?? 'id';
    this.FIELD_META = new Map();
    this.CLIENT_ID_TO_POD = new Map();
    this.PROPERTY_NAME_TO_DATA_KEY = new Map();
    this.ROOTS = new Map();
    this.BONDS = new Map();
    this.RECORD_TYPE_TO_IDF = new Map();
    this.IDENTIFIER_TO_CLIENT_ID = new Map();
    this.REMOVED_PODS = new Set();
  }

  @cached
  protected get namingConventions() {
    return this.store.config.namingConventions ?? NAMING_CONVENTIONS;
  }

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
      this.FIELD_META.set(
        modelName,
        new Map(Object.entries(RawModelConstructor.META.fields)),
      );
      this.PROPERTY_NAME_TO_DATA_KEY.set(
        modelName,
        new Map(Object.entries(RawModelConstructor.META.properties)),
      );
    }
    return this.KNOWN_POD_TYPES.get(modelName)!;
  };

  // TODO: Maybe add possibility to define custom regex
  protected parseAlias = (
    alias: string,
  ): {
    dataKey: string;
    typeName: keyof PodRegistry | undefined;
    type:
    | TirCache['namingConventions']['item']
    | TirCache['namingConventions']['set']
    | undefined;
    suffix: string | null;
  } | null => {
    // ^(?<dataKey>[A-Z][a-zA-Z]*)__: Matches the start of the string (^), then captures a PascalCase word as dataKey.
    // This word must start with an lowercase letter ([a-z]) followed by zero or more letters ([a-zA-Z]*).
    // The double underscore (__) acts as a separator.
    // (?<typeName>[A-Z][a-zA-Z]*)(?<type>${this.namingConventions.item}|${this.namingConventions.set}):
    // Captures another PascalCase word as typeName, followed by a specific keyword captured as type,
    // which must match either the item or set naming convention.
    // (?<suffix>.*)$: Captures the remaining part of the string as suffix, which can be any character sequence,
    // ending the match at the end of the string ($).
    const regex = new RegExp(
      `^(?<dataKey>[a-z][a-zA-Z]*)__(?<typeName>[A-Z][a-zA-Z]*)(?<type>${this.namingConventions.item}|${this.namingConventions.set})(?<suffix>.*)$`,
    );
    const match = alias.match(regex);

    if (match && match.groups) {
      return match.groups as {
        dataKey: string;
        typeName: keyof PodRegistry | undefined;
        type:
        | TirCache['namingConventions']['item']
        | TirCache['namingConventions']['set']
        | undefined;
        suffix: string | null;
      };
    } else {
      // Return null if alias doesn't follow the expected format. This will result in skipping encapuslation
      return null;
    }
  };

  public getPropertiesForType = (
    modelName: keyof PodRegistry,
  ): Map<AttrField['propertyName'] | RelationshipField['propertyName'], AttrField['dataKey'] | RelationshipField['dataKey']> => {
    // ensures meta registration
    this.modelFor(modelName);
    return this.PROPERTY_NAME_TO_DATA_KEY.get(modelName)!;
  };

  public getFieldMetaForType = (modelName: keyof PodRegistry) => {
    // ensures meta registration
    this.modelFor(modelName);
    return this.FIELD_META.get(modelName)!;
  };

  /**
   * Returns the key for LISTS and ROOTS maps
   */
  public getRootId = (
    modelName: keyof PodRegistry,
    root: string | (AttrField | RelationshipField)['dataKey'],
    clientId?: ClientId,
  ): `${keyof PodRegistry}:${string}` | `${keyof PodRegistry}:${(
    | AttrField
    | RelationshipField
  )['dataKey']}:${ClientId}` => {
    return clientId
      ? `${modelName}:${root}:${clientId}`
      : `${modelName}:${root}`;
  };

  /**
   * Retrives the inverse root dataKey
   */
  protected getInverseDataKey = (
    inverseFieldModelName: keyof PodRegistry,
    inverseFieldPropertyName: (AttrField | RelationshipField)['propertyName'],
  ) => {
    // ensure schema registration
    this.modelFor(inverseFieldModelName);
    return this.getPropertiesForType(inverseFieldModelName).get(
      inverseFieldPropertyName,
    );
  };

  public getIDInfo = (
    modelName: keyof PodRegistry,
  ): {
    dataKey: AttrField['dataKey'];
    propertyName: AttrField['propertyName'];
    dbKeyPrefix: `${keyof PodRegistry}:${AttrField['dataKey']}`;
  } => {
    const pkField =
      this.RECORD_TYPE_TO_IDF.get(modelName) ?? this.DEFAULT_IDENTIFIER_FIELD;
    const metaField = this.getFieldMetaForType(modelName).get(pkField);
    assert(
      `No such dataKey ${pkField} is configured on ${modelName}`,
      metaField,
    );
    return {
      dataKey: pkField,
      propertyName: metaField!.propertyName,
      dbKeyPrefix: `${modelName}:${pkField}`,
    };
  };

  public createPod = (modelName: keyof PodRegistry) => {
    const PodType = this.modelFor(modelName);
    const pod = new PodType(this.store);
    // TODO: implement direct assignment or proxy if gettters on pod do not work
    this.getFieldMetaForType(modelName).forEach((field) => {
      const root = this.getRoot({
        modelName: modelName,
        root: field.propertyName,
        clientId: pod.CLIENT_ID
      });
      if (field.fieldType === "attribute") {
        Object.defineProperty(pod, field.propertyName, {
          get: (root as ScalarRoot<unknown>).get.bind(root),
          set: (root as ScalarRoot<unknown>).set.bind(root)
        });
      } else {
        Object.defineProperty(pod, field.propertyName, {
          get() {
            return new Proxy(root, {});
          },
        });
      }
    });
    this.CLIENT_ID_TO_POD.set(pod.CLIENT_ID, pod);
    return this.getPodByClientId(pod.CLIENT_ID)!;
  };

  public removePod = (clientId: ClientId): void => {
    const pod = this.getPodByClientId(clientId);
    if (pod) {
      const { propertyName, dataKey, dbKeyPrefix } = this.getIDInfo(
        (pod.constructor as typeof Pod).modelName,
      );
      // Use bonds to efficiently remove all bonds to clientId
      this.unregisterBonds(clientId, true);
      // remove the clientId and real id from cache
      this.CLIENT_ID_TO_POD.delete(clientId);
      this.IDENTIFIER_TO_CLIENT_ID.delete(
        `${dbKeyPrefix}:${pod[propertyName]}`,
      );
    }
  };

  /** Associates the Pod instance with server side identifier field */
  public identifyPod = (pod: Pod) => {
    // get and use propertyName instead of dataKey on pod instance
    const { propertyName, dbKeyPrefix } = this.getIDInfo(
      (pod.constructor as typeof Pod).modelName,
    );
    // cannot be identified via null or undefined or false, but only with real value;
    // so check that pod[propertyName] is not a falty value
    if (pod[propertyName]) {
      this.IDENTIFIER_TO_CLIENT_ID.set(
        `${dbKeyPrefix}:${pod[propertyName]}`,
        pod.CLIENT_ID,
      );
    }
  };

  public getPodByClientId = (clientId: ClientId): Pod | undefined => {
    return this.CLIENT_ID_TO_POD.get(clientId);
  };

  public getPod = (
    modelName: keyof PodRegistry,
    identifier: Pod[AttrField['dataKey']] | TPodData[AttrField['dataKey']],
  ): Pod | undefined => {
    const { dbKeyPrefix } = this.getIDInfo(modelName);

    const clientId = this.IDENTIFIER_TO_CLIENT_ID.get(
      `${dbKeyPrefix}:${identifier}`,
    );
    return clientId ? this.getPodByClientId(clientId) : undefined;
  };

  protected getOrCreatePod = (
    modelName: keyof PodRegistry,
    identifier: Pod[string & AttrField['dataKey']],
  ) => {
    let pod = this.getPod(modelName, identifier);
    if (!pod) {
      pod = this.createPod(modelName);
      this.IDENTIFIER_TO_CLIENT_ID.set(
        `${modelName}:${identifier}`,
        pod.CLIENT_ID,
      );
    }
    return this.getPodByClientId(pod.CLIENT_ID)!;
  };

  /**
   * Always returns a Root instance
   * ATENTION!
   * In relations, "modelName" is the parent type's "modelName",
   * while in top level roots, its the modelName of the top level root type
   */
  public getRoot = (ref: RootRef) => {
    const { modelName, root, clientId } = ref;
    const key = this.getRootId(modelName, root, clientId);
    const rootInstance = this.ROOTS.get(key);
    if (!rootInstance) {
      const meta = this.getFieldMetaForType(modelName);
      // if this is a realtion
      if (clientId) {
        const field = meta.get(root);
        assert(`No such field with dataKey ${root} on ${modelName}`, field);
        if (field.fieldType === 'attribute') {
          let Processor: typeof FieldProcessor | undefined;
          if (field.fieldProcessorName) {
            Processor = getOwner(this)?.lookup(
              `field-processor:${field.fieldProcessorName}`,
            ) as typeof FieldProcessor | undefined;
            // Try looking up in default field processors
            if (!Processor) {
              Processor = DefaultFieldProcessors[field.fieldProcessorName];
            }
            assert(
              `No field processor with name "${field.fieldProcessorName}" was found.`,
              Processor,
            );
          }
          const processor = Processor ? new Processor(this.store) : undefined;
          const value = field.defaultValue
            ? processor?.process(field.defaultValue) ?? field.defaultValue
            : null;
          this.ROOTS.set(
            key,
            new ScalarRoot<any>(
              this.store,
              value,
              modelName,
              root,
              clientId,
              processor,
            ),
          );
        } else {
          if (field.relationshipType === 'belongsTo') {
            this.ROOTS.set(
              key,
              new NodeRoot(this.store, null, modelName, root, clientId),
            );
          };
          if (field.relationshipType === 'hasMany') {
            this.ROOTS.set(
              key, 
              new ConnectionRoot(this.store, ref)
            );
          };
        };
      } else {
        // support only root level connection roots
        this.ROOTS.set(
          key, 
          new ConnectionRoot(this.store, ref)
        );
      };
    };
    return this.ROOTS.get(key)!;
  };

  /**
   * Creates/updates roots inlcuding backwards
   * ATENTION!
   * In relations, "modelName" is the parent type's "modelName",
   * while in top level roots, its the modelName of the top level root type
   */
  public updateRoot = (
    ref: RootRef,
    replace: Set<ClientId> | (ClientId | null),
    add: Set<ClientId> | null,
    remove: Set<ClientId> | null,
    // whether the initial state on the ScalarRoot should also be updated
    updateInitial: boolean = false,
    markLoaded: boolean = false,
  ): void => {
    const { modelName, root, clientId } = ref;
    const rootField = this.getRoot(ref);
    if (!clientId) {
      assert(
        `${ERROR_MESSAGE_PREFIX}Cannot update a root, because only connection roots are supported on top level roots`,
        rootField instanceof ConnectionRoot,
      );
    }
    if (rootField instanceof ConnectionRoot) {
      // for both, top and relation level, update the root field in cache
      rootField.update(
        {
          add: add ?? new Set(),
          remove: remove ?? new Set(),
        },
        updateInitial,
        markLoaded,
      );
    } else {
      rootField.update(replace as any, updateInitial, markLoaded);
    }
  };

  public registerBond = (
    clientId: ClientId,
    rootId:
      | `${keyof PodRegistry}:${RelationshipField['dataKey']}:${ClientId}`
      | `${keyof PodRegistry}:${string}`,
    updateInitial: boolean = false,
  ) => {
    const registry = this.getBonds(clientId);
    registry.add(rootId);
    registry.forEach((id) => {
      const root = this.ROOTS.get(id);
      if (
        root instanceof ConnectionRoot &&
        !root.clientIds.includes(clientId)
      ) {
        root.update(
          {
            add: new Set([clientId]),
            remove: new Set(),
          },
          updateInitial,
          false,
        ); // do not mark loaded, becuase it might not necessarily be loaded
      } else if (root instanceof NodeRoot && root.value !== clientId) {
        root.update(clientId);
      }
    });
  };

  public unregisterBond = (
    clientId: ClientId,
    rootId:
      | `${keyof PodRegistry}:${RelationshipField['dataKey']}:${ClientId}`
      | `${keyof PodRegistry}:${string}`,
    updateInitial: boolean = false,
  ) => {
    const registry = this.getBonds(clientId);
    registry.forEach((id) => {
      const root = this.ROOTS.get(id);
      if (root instanceof ConnectionRoot && root.clientIds.includes(clientId)) {
        root.update(
          {
            add: new Set(),
            remove: new Set([clientId]),
          },
          updateInitial,
          false,
        ); // do not mark loaded, becuase it might not necessarily be loaded
      } else if (root instanceof NodeRoot && root.value === clientId) {
        root.update(null, true);
      }
    });
    registry.delete(rootId);
  };

  protected unregisterBonds = (
    clientId: ClientId,
    updateInitial: boolean = false,
  ) => {
    const registry = this.getBonds(clientId);
    registry.forEach((id) => {
      this.unregisterBond(clientId, id, updateInitial);
    });
    this.BONDS.delete(clientId);
  };

  /**
   * Always returns a proper clientId to roots registry
   */
  protected getBonds = (clientId: ClientId) => {
    if (!this.BONDS.get(clientId)) {
      this.BONDS.set(clientId, new Set());
    }
    return this.BONDS.get(clientId)!;
  };

  public getRemovedPods = (): Set<ClientId> => {
    return this.REMOVED_PODS;
  };

  public markPodForRemoval = (clientId: ClientId): void => {
    this.REMOVED_PODS.add(clientId);
  };

  public unmarkPodForRemoval = (clientId: ClientId): void => {
    this.REMOVED_PODS.delete(clientId);
  };

  /** returns the first part of the ":" separated string, which in Cache conventions is the modelName */
  public modelNameFrom = (clientId: ClientId): keyof PodRegistry => {
    return clientId.split(':')[0]!;
  };
}

export { TirCache };
