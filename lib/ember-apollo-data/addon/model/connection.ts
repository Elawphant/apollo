import type { Node } from ".";
import { Queryable } from "./queryable";
import type { ConnectionRoot } from "./connection-root";
import type { Variables } from "graphql-request";
import type { TirService } from "ember-apollo-data/";
import type { ConnectionRef } from "./types";



export class Connection extends Queryable implements Array<Node> {
  private declare readonly aggregator: ConnectionRoot;
  private declare readonly fieldName: string;
  private declare readonly variables: Variables;
  private declare readonly parentNodeClientId?: Node["CLIENT_ID"];

  public get identifier() {
    return this.aggregator.identifyConnection(this.variables);
  };

  constructor(
    store: TirService,
    ref: ConnectionRef,
  ) {
    super(store);
    const { modelName, fieldName, variables, parentNodeClientId } = ref;
    const pageInfo = {};
    const variableKeys = Object.keys(variables);

    this.aggregator = this.store.getConnectionRoot({
      modelName: modelName,
      fieldName: fieldName,
      parentNodeClientId: parentNodeClientId
    });
    this.fieldName = ref.fieldName;
    this.variables = ref.variables;
    this.parentNodeClientId = ref.parentNodeClientId;
  }

  // TODO: test
  public get nodesFromAllConnections() {
    return this.aggregator.records;
  }

  private get currentState() {
    return this.aggregator.getNodes(this.variables);
  }

  public get length(): number {
    return this.currentState.length;
  }


  add(node: Node): void {
    this.aggregator.add(node);
  };

  remove(node: Node): void {
    this.aggregator.removeNode(node);
  };

  /** Reverts unsaved changes by clearing added and removed nodes on the aggregator */
  revert(): void {
    this.aggregator.revert();
  };

  get added() {
    return this.aggregator.addedNodes;
  }

  get removed() {
    return this.aggregator.removedNodes;
  }

  get meta() {
    const { connectionData, edges } = this.aggregator.getConnectionData(this.variables) ?? {};
    const edgesData = edges ?? [];
    return {
      ...connectionData,
      edges: Array.from(edgesData).map(([clienId, edge]) => {
        return {
          ...(edge ?? {}),
          node: this.store.getNodeByClientId(clienId),
        };
      }),
    };
  };

  concat = (...args: Parameters<Array<Node>["concat"]>): Node[] => {
    return this.currentState.concat(...args);
  };

  entries = (): IterableIterator<[number, Node]> => {
    return this.currentState.entries();
  };

  every = (...args: Parameters<Array<Node>["every"]>): boolean => {
    return this.currentState.every(...args);
  };

  filter = (...args: Parameters<Array<Node>["filter"]>): Node[] => {
    return this.currentState.filter(...args);
  };

  find = (...args: Parameters<Array<Node>["find"]>): Node | undefined => {
    return this.currentState.find(...args);
  };

  findIndex = (...args: Parameters<Array<Node>["findIndex"]>): number => {
    return this.currentState.findIndex(...args);
  };

  flat = <A, D extends number = 1>(...args: Parameters<Array<Node>["flat"]>): FlatArray<A, D>[] => {
    return this.currentState.flat(...args) as FlatArray<A, D>[];
  };

  flatMap = <U, This = undefined>(...args: Parameters<Array<Node>["flatMap"]>): U[] => {
    return this.currentState.flatMap(...args) as U[];
  };

  forEach = (...args: Parameters<Array<Node>["forEach"]>): void => {
    return this.currentState.forEach(...args);
  };

  includes = (...args: Parameters<Array<Node>["includes"]>): boolean => {
    return this.currentState.includes(...args);
  };

  indexOf = (...args: Parameters<Array<Node>["indexOf"]>): number => {
    return this.currentState.indexOf(...args);
  }

  join = (...args: Parameters<Array<Node>["join"]>): string => {
    return this.currentState.join(...args);
  };

  keys = (): IterableIterator<number> => {
    return this.currentState.keys();
  }

  lastIndexOf = (...args: Parameters<Array<Node>["lastIndexOf"]>): number => {
    return this.currentState.lastIndexOf(...args);
  };

  map = <U>(...args: Parameters<Array<Node>["map"]>): U[] => {
    return this.currentState.map(...args) as U[];
  };

  //@ts-ignore: weird typechecking issue
  reduce = <U>(...args: Parameters<Array<Node>["reduce"]>): U => {
    return this.currentState.reduce(...args) as U;
  };

  //@ts-ignore: weird typechecking issue
  reduceRight = <U>(...args: Parameters<Array<Node>["reduceRight"]>): U => {
    return this.currentState.reduceRight(...args) as U;
  };

  slice = (...args: Parameters<Array<Node>["slice"]>): Node[] => {
    return this.currentState.slice(...args);
  };

  some = (...args: Parameters<Array<Node>["some"]>): boolean => {
    return this.currentState.some(...args);
  };

  values = (): IterableIterator<Node> => {
    return this.currentState.values();
  };

  get(index: number): Node | undefined {
    return this.currentState[index];
  };

  get hasUnsavedChanges(): boolean {
    return this.aggregator.addedNodes.length > 0 || this.aggregator.addedNodes.length > 0;
  };


  *[Symbol.iterator](): IterableIterator<Node> {
    for (let node of this.currentState) {
      yield node;
    }
  }


}