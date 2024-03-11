import type { RootRef, Pod, ClientId } from '../model/types';
import type TirService from 'tir/services/tir';
import type { Variables } from 'graphql-request';
import type { PodRegistry } from '../model/registry';
import { identifyConnection } from 'tir/-private/util';
import { Connection } from '../model/connection';
import { tracked } from 'tracked-built-ins';
import { ScalarRoot } from 'tir/caches/scalar-root';

class ConnectionRoot<T extends Pod>
  extends ScalarRoot<Set<ClientId>>
  implements Array<Pod>
{
  public declare readonly store: TirService;
  public declare readonly modelName: keyof PodRegistry;

  /** Variables string key to Connection */
  private declare readonly connections: Map<string, Connection>;

  public get isRelation() {
    return this.clientId !== undefined;
  }

  constructor(store: TirService, ref: RootRef) {
    const { modelName, root, clientId } = ref;
    super(store, tracked(new Set<ClientId>()), modelName, root, clientId);
    this.connections = new Map();
  }

  public get clientIds() {
    return Array.from(this.value);
  }

  /** All known pods */
  public get pods() {
    return [...this.value].map((clientId) =>
      this.store.getPodByClientId(clientId),
    ) as Pod[];
  }

  public identifyConnection = (variables: Variables) => {
    return identifyConnection(variables);
  };

  /**
   * Always returns a connetion instance.
   * */
  public getConnection = (variables: Variables) => {
    const id = this.identifyConnection(variables);
    if (this.connections.get(id)) {
      this.connections.set(id, new Connection(this.store, this, variables));
    }
    return this.connections.get(id)!;
  };

  public get added() {
    // TODO: benchmark: maybe instead of [...this.initial] use Array.from(this.initial)
    return Array.from(this.value)
      .filter((clientId) => ![...this.initial].includes(clientId))
      .map((clientId) => this.store.getPodByClientId(clientId));
  }

  public get removed() {
    return Array.from(this.value)
      .filter((clientId) => [...this.initial].includes(clientId))
      .map((clientId) => this.store.getPodByClientId(clientId));
  }

  public removeByClientId = (clientId: ClientId) => {
    this.value.delete(clientId);
  };

  public add = (pod: Pod) => {
    this.value.add(pod.CLIENT_ID);
  };

  public remove = (pod: Pod) => {
    this.removeByClientId(pod.CLIENT_ID);
  };

  public revert = () => {
    this.value.clear();
    this.initial.forEach((clientId) => this.value.add(clientId));
  };

  /** Overwrites `value` and initial `properties` with given set of clientIds */
  //@ts-ignore
  public set = (items: Set<ClientId>): void => {
    this.value.clear();
    this.initial.clear();
    items.forEach((clientId) => {
      this.initial.add(clientId);
      this.value.add(clientId);
    });
  };

  public has = (clientId: ClientId) => {
    return this.value.has(clientId);
  };

  public concat = (...args: Parameters<Array<Pod>['concat']>): Pod[] => {
    return this.pods.concat(...args);
  };

  public entries = (): IterableIterator<[number, Pod]> => {
    return this.pods.entries();
  };

  public every = (...args: Parameters<Array<Pod>['every']>): boolean => {
    return this.pods.every(...args);
  };

  public filter = (...args: Parameters<Array<Pod>['filter']>): Pod[] => {
    return this.pods.filter(...args);
  };

  public find = (...args: Parameters<Array<Pod>['find']>): Pod | undefined => {
    return this.pods.find(...args);
  };

  public findIndex = (...args: Parameters<Array<Pod>['findIndex']>): number => {
    return this.pods.findIndex(...args);
  };

  public flat = <A, D extends number = 1>(
    ...args: Parameters<Array<Pod>['flat']>
  ): FlatArray<A, D>[] => {
    return this.pods.flat(...args) as FlatArray<A, D>[];
  };

  public flatMap = <U, This = undefined>(
    ...args: Parameters<Array<Pod>['flatMap']>
  ): U[] => {
    return this.pods.flatMap(...args) as U[];
  };

  public forEach = (...args: Parameters<Array<Pod>['forEach']>): void => {
    return this.pods.forEach(...args);
  };

  public includes = (...args: Parameters<Array<Pod>['includes']>): boolean => {
    return this.pods.includes(...args);
  };

  public indexOf = (...args: Parameters<Array<Pod>['indexOf']>): number => {
    return this.pods.indexOf(...args);
  };

  public join = (...args: Parameters<Array<Pod>['join']>): string => {
    return this.pods.join(...args);
  };

  public keys = (): IterableIterator<number> => {
    return this.pods.keys();
  };

  public lastIndexOf = (
    ...args: Parameters<Array<Pod>['lastIndexOf']>
  ): number => {
    return this.pods.lastIndexOf(...args);
  };

  public map = <U>(...args: Parameters<Array<Pod>['map']>): U[] => {
    return this.pods.map(...args) as U[];
  };

  //@ts-ignore: weird typechecking issue
  public reduce = <U>(...args: Parameters<Array<Pod>['reduce']>): U => {
    return this.pods.reduce(...args) as U;
  };

  //@ts-ignore: weird typechecking issue
  public reduceRight = <U>(
    ...args: Parameters<Array<Pod>['reduceRight']>
  ): U => {
    return this.pods.reduceRight(...args) as U;
  };

  public slice = (...args: Parameters<Array<Pod>['slice']>): Pod[] => {
    return this.pods.slice(...args);
  };

  public some = (...args: Parameters<Array<Pod>['some']>): boolean => {
    return this.pods.some(...args);
  };

  public values = (): IterableIterator<Pod> => {
    return this.pods.values();
  };

  //@ts-ignore
  public get(index: number): Pod | undefined {
    return this.pods[index];
  }

  // METHODS TO WORK WITH CACHE
  /** Updates the state optionally updating the initial value and marking it as loaded */
  public update = (
    val: { add: Set<ClientId>; remove: Set<ClientId> },
    updateInitial: boolean = false,
    markLoaded: boolean = false,
  ) => {
    const { add, remove } = val;
    add.forEach((clientId) => {
      if (updateInitial) {
        this.initial.add(clientId);
        this.store.registerBond(clientId, this.rootKey, updateInitial);
      }
      this.value.add(clientId);
    });
    remove.forEach((clientId) => {
      if (updateInitial) {
        this.initial.delete(clientId);
        this.store.unregisterBond(clientId, this.rootKey, updateInitial);
      }
      this.value.delete(clientId);
    });
    if (markLoaded) {
      this.markLoaded();
    }
  };

  get hasUnsavedChanges(): boolean {
    return this.added.length > 0 || this.removed.length > 0;
  }

  /**
   * When an inverse update occurs, this the inverse connection items are no more trusted.
   * isSettled property let's check whether an update would be approprate
   */
  get isSettled() {
    return (
      this.initial.size === this.value.size &&
      [...this.initial].every((clientId) => this.value.has(clientId))
    );
  }
}

export { ConnectionRoot };
