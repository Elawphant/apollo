import type { RootRef, Pod, ClientId } from "../model/types";
import type { TirService } from "ember-apollo-data/";
import { configure } from "ember-apollo-data/utils";
import type { Variables } from "graphql-request";
import type { PodRegistry } from "../model/registry";
import { identifyConnection } from "ember-apollo-data/-private/util";
import { Connection } from "../model/connection";
import { tracked } from "tracked-built-ins";
import type { RelationshipField } from "../model/field-mappings";
import { ScalarRoot } from "ember-apollo-data/caches/scalar-root";
import { ERROR_MESSAGE_PREFIX } from "ember-apollo-data/-private/globals";




class ConnectionRoot extends ScalarRoot<Set<ClientId>> implements Array<Pod> {
  declare public readonly store: TirService;
  declare public readonly modelName: keyof PodRegistry;

  /** Variables string key to Connection */
  declare private readonly connections: Map<string, Connection>;

  // TODO: probably not needed. remove
  declare public readonly key: `${keyof PodRegistry}:${RelationshipField["dataKey"]}:${ClientId}` | `${keyof PodRegistry}:${string}`;

  public get isRelation() {
    return Boolean(this.clientId);
  };


  constructor(store: TirService, ref: RootRef,) {
    const { modelName, root, clientId } = ref;
    super(tracked(new Set<ClientId>()), root, clientId);
    configure(store, this);
    this.connections = new Map();
    this.modelName = modelName;
    this.key = clientId ? `${modelName}:${root}:${clientId}` : `${modelName}:${root}`;
  };

  /** All known pods */
  public get pods() {
    return [...this.value]
      .map(clientId => this.store.getPodByClientId(clientId)) as Pod[];
  };

  public identifyConnection = (variables: Variables) => {
    return identifyConnection(variables);
  }

  public getConnection = (variables: Variables) => {
    const id = this.identifyConnection(variables);
    const connection = this.connections.get(id);
    if (!connection) {
      // TODO: CONTINUE FROM HERE
    }
    return this.connections.get(id) ? new Proxy(this.connections.get(id)!, {}) : undefined;
  };


  public get added() {
    // TODO: benchmark: maybe instead of [...this.initial] use Array.from(this.initial)
    return Array.from(this.value)
      .filter(clientId => ![...this.initial].includes(clientId))
      .map(clientId => this.store.getPodByClientId(clientId));
  };

  public get removed() {
    return Array.from(this.value)
      .filter(clientId => [...this.initial].includes(clientId))
      .map(clientId => this.store.getPodByClientId(clientId));
  };


  public add = (pod: Pod) => {
    this.value.add(pod.CLIENT_ID);
  };

  public remove = (pod: Pod) => {
    this.value.delete(pod.CLIENT_ID);
  };

  public revert = () => {
    this.value.clear();
    this.initial.forEach(clientId => this.value.add(clientId));
  };

  /** Overwrites `value` and initial `properties` with given set of clientIds */
  public set = (items: Set<ClientId>): void => {
    this.value.clear(); this.initial.clear();
    items.forEach(clientId => {
      this.initial.add(clientId); this.value.add(clientId);
    });
  };

  public has = (clientId: ClientId) => {
    return this.value.has(clientId);
  };

  concat = (...args: Parameters<Array<Pod>["concat"]>): Pod[] => {
    return this.pods.concat(...args);
  };

  entries = (): IterableIterator<[number, Pod]> => {
    return this.pods.entries();
  };

  every = (...args: Parameters<Array<Pod>["every"]>): boolean => {
    return this.pods.every(...args);
  };

  filter = (...args: Parameters<Array<Pod>["filter"]>): Pod[] => {
    return this.pods.filter(...args);
  };

  find = (...args: Parameters<Array<Pod>["find"]>): Pod | undefined => {
    return this.pods.find(...args);
  };

  findIndex = (...args: Parameters<Array<Pod>["findIndex"]>): number => {
    return this.pods.findIndex(...args);
  };

  flat = <A, D extends number = 1>(...args: Parameters<Array<Pod>["flat"]>): FlatArray<A, D>[] => {
    return this.pods.flat(...args) as FlatArray<A, D>[];
  };

  flatMap = <U, This = undefined>(...args: Parameters<Array<Pod>["flatMap"]>): U[] => {
    return this.pods.flatMap(...args) as U[];
  };

  forEach = (...args: Parameters<Array<Pod>["forEach"]>): void => {
    return this.pods.forEach(...args);
  };

  includes = (...args: Parameters<Array<Pod>["includes"]>): boolean => {
    return this.pods.includes(...args);
  };

  indexOf = (...args: Parameters<Array<Pod>["indexOf"]>): number => {
    return this.pods.indexOf(...args);
  }

  join = (...args: Parameters<Array<Pod>["join"]>): string => {
    return this.pods.join(...args);
  };

  keys = (): IterableIterator<number> => {
    return this.pods.keys();
  }

  lastIndexOf = (...args: Parameters<Array<Pod>["lastIndexOf"]>): number => {
    return this.pods.lastIndexOf(...args);
  };

  map = <U>(...args: Parameters<Array<Pod>["map"]>): U[] => {
    return this.pods.map(...args) as U[];
  };

  //@ts-ignore: weird typechecking issue
  reduce = <U>(...args: Parameters<Array<Pod>["reduce"]>): U => {
    return this.pods.reduce(...args) as U;
  };

  //@ts-ignore: weird typechecking issue
  reduceRight = <U>(...args: Parameters<Array<Pod>["reduceRight"]>): U => {
    return this.pods.reduceRight(...args) as U;
  };

  slice = (...args: Parameters<Array<Pod>["slice"]>): Pod[] => {
    return this.pods.slice(...args);
  };

  some = (...args: Parameters<Array<Pod>["some"]>): boolean => {
    return this.pods.some(...args);
  };

  values = (): IterableIterator<Pod> => {
    return this.pods.values();
  };

  get(index: number): Pod | undefined {
    return this.pods[index];
  };


  // METHODS TO WORK WITH CACHE
  /** Updates the state optionally updating the initial value and marking it as loaded */
  public update = (val: { add: Set<ClientId>, remove: Set<ClientId> }, updateInitial: boolean = false, markLoaded: boolean = false) => {
    const { add, remove } = val;
    add.forEach(item => {
      if (updateInitial) {
        this.initial.add(item);
      };
      this.value.add(item);
    });
    remove.forEach(item => {
      if (updateInitial) {
        this.initial.delete(item);
      };
      this.value.delete(item);
    });
    if (markLoaded) {
      this.markLoaded();
    };
  };

  get hasUnsavedChanges(): boolean {
    return this.added.length > 0 || this.removed.length > 0;
  };


};


export { ConnectionRoot };