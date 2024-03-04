import type { Pod } from ".";
import { Queryable } from "./queryable";
import type { ConnectionRoot } from "../caches/connection-root";
import type { Variables } from "graphql-request";
import type { TirService } from "ember-apollo-data/";
import type { ConnectionRef, ClientId, TStemData, TRelayEdgeData } from "./types";



export class Connection extends Queryable implements Array<Pod> {
  private declare readonly root: ConnectionRoot;
  private declare readonly variables: Variables;
  private declare readonly parentClientId?: ClientId;

  private declare connection: TStemData;

  private declare __pods: Set<ClientId>;

  public get identifier() {
    return this.root.identifyConnection(this.variables);
  };

  constructor(
    store: TirService,
    root: ConnectionRoot,
    variables: Variables,
    data: TStemData
  ) {
    super(store);
    this.root = root;
    this.variables = variables;
    this.connection = data;
  };

  public get pods() {
    return [...this.__pods].map(clientId => this.store.getPodByClientId(clientId)).filter(Pod => Pod !== undefined) as Pod[];
  };

  public get length(): number {
    return this.pods.length;
  };

  public get meta() {
    return {
      ...this.connection,
      edges: this.connection.edges?.map(edge => {
        return {
          ...edge,
          node: edge.node
            ? this.store.getPod(this.root.modelName, edge.node[this.store.getIDInfo(this.root.modelName).dataKey])
            : undefined
        };
      })
    }
  }


  add(pod: Pod): void {
    this.root.add(pod);
  };

  remove(pod: Pod): void {
    this.root.remove(pod);
  };

  /** Reverts unsaved changes by clearing added and removed pods on the root */
  revert(): void {
    this.root.revert();
  };

  get added() {
    return this.root.added;
  }

  get removed() {
    return this.root.removed;
  }

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

  get hasUnsavedChanges(): boolean {
    return this.root.added.length > 0 || this.root.removed.length > 0;
  };


  *[Symbol.iterator](): IterableIterator<Pod> {
    for (let Pod of this.pods) {
      yield Pod;
    }
  }


}