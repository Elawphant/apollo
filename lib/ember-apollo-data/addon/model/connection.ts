import type { Pod } from '.';
import { Queryable } from './queryable';
import type { ConnectionRoot } from '../caches/connection-root';
import type { Variables } from 'graphql-request';
import type TirService from 'ember-apollo-data/services/tir';
import type { ClientId, TStemData } from './types';
import { tracked } from 'tracked-built-ins';

export class Connection extends Queryable implements Array<Pod> {
  private declare readonly root: ConnectionRoot<Pod>;
  private declare readonly variables: Variables;
  private declare readonly parentClientId?: ClientId;

  @tracked
  private declare connection: TStemData;

  @tracked
  private declare __pods: Set<ClientId>;

  public get identifier() {
    return this.root.identifyConnection(this.variables);
  }

  constructor(
    store: TirService,
    root: ConnectionRoot<Pod>,
    variables: Variables,
  ) {
    super(store);
    this.root = root;
    this.variables = variables;
  }

  public get pods() {
    return [...this.__pods]
      .map((clientId) => this.store.getPodByClientId(clientId))
      .filter((Pod) => Pod !== undefined) as Pod[];
  }

  public get length(): number {
    return this.pods.length;
  }

  public get meta() {
    return {
      ...this.connection,
      edges: this.connection.edges?.map((edge) => {
        return {
          ...edge,
          node: edge.node
            ? this.store.getPod(
                this.root.modelName,
                edge.node[this.store.getIDInfo(this.root.modelName).dataKey],
              )
            : undefined,
        };
      }),
    };
  }

  /**
   * Updates the connection.
   * This method is meant for internal usage for the cache.
   * For computational efficiency, a set of clientIds is directly passed as arg,
   * not to recompute via real identifier fields
   * */
  public update = (data: TStemData, pods: Set<ClientId>) => {
    this.connection = data;
    this.__pods = pods;
  };

  public add(pod: Pod): void {
    this.root.add(pod);
  }

  public remove(pod: Pod): void {
    this.root.remove(pod);
  }

  /** Reverts unsaved changes by clearing added and removed pods on the root */
  public revert(): void {
    this.root.revert();
  }

  public get added() {
    return this.root.added;
  }

  public get removed() {
    return this.root.removed;
  }

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

  public get hasUnsavedChanges(): boolean {
    return this.root.added.length > 0 || this.root.removed.length > 0;
  }

  public *[Symbol.iterator](): IterableIterator<Pod> {
    for (const Pod of this.pods) {
      yield Pod;
    }
  }
}
