import type {
  TRelayEdge,
  TRelayPageInfo,
} from '@apollo/client/utilities/policies/pagination';
import {
  configureConnectionQuery,
  configureConnectionVariables,
  configureNodeFragment,
  configureNodeVariables,
} from 'ember-apollo-data/-private/configurators';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import type { GraphQLError, TypeNode } from 'graphql';
import { tracked } from '@glimmer/tracking';
import Node from 'ember-apollo-data/model/node';
import {
  ApolloError,
  gql,
  NetworkStatus,
  type OperationVariables,
} from '@apollo/client';
import { identifyObject } from 'ember-apollo-data/-private/util';
import { computed } from '@ember/object';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';
import { assert } from '@ember/debug';

export class RelayEdge {
  declare readonly store: EADStoreService;
  public readonly node_id: string;
  declare cursor: string;
  declare connection: RelayConnection;

  get node(): Node | undefined {
    return this.store.NODES.get(this.node_id);
  }

  get meta() {
    return {
      cursor: this.cursor,
    };
  }

  constructor(store: EADStoreService, node_id: string) {
    this.node_id = node_id;
    this.store = store;
  }
}

/**
 * A Class for managing a single connection query to a rootfield
 * When instantiated, it will be responsible for querying and updating data
 *
 */
export class RelayConnection {
  declare store: EADStoreService;
  declare modelConstructor: typeof Node;
  private declare parentNode: Node;

  get belongsTo() {
    return this.parentNode;
  }

  setbelongsTo = (parentNode: Node) => {
    assert(
      `
      Connection relations can be set only once.
    `,
      !this.parentNode,
    );
    this.parentNode = parentNode;
  };

  @tracked
  loading: boolean = false;

  @tracked
  isLoadingNext: boolean = false;

  @tracked
  isLoadingPrevious: boolean = false;

  @tracked
  hasNext: boolean = false;

  @tracked
  hasPrevious: boolean = false;

  @tracked
  declare errors?: GraphQLError[];

  @tracked
  declare error?: ApolloError;

  @tracked
  declare networkStatus: NetworkStatus;

  @tracked
  declare partial: boolean;

  get id() {
    return identifyObject({
      modelName: this.modelConstructor.modelName,
      variables: this.variables,
    })!;
  }

  // @computed('store.EDGES')
  // get edges() {
  //   return Array.from(this.store.EDGES.values())
  //     .map((edge) => {
  //       if (edge.connection.id === this.id) {
  //         return new Proxy(edge.node!, {
  //           // get: (target, prop, descripor) => {
  //           //   if (prop === "cursor"){
  //           //     return edge.cursor
  //           //   }
  //           // }
  //         });
  //       }
  //       return null;
  //     })
  //     .filter(Boolean);
  // }

  declare variables?: OperationVariables;

  @tracked
  declare pageInfo: TRelayPageInfo;

  constructor(
    store: EADStoreService,
    modelName: string,
    queryVariables?: OperationVariables,
    parentNode?: Node,
  ) {
    this.store = store;
    this.modelConstructor = this.store.modelFor(modelName);
    this.variables = queryVariables;
    if (parentNode && parentNode.id) {
      this.setbelongsTo(parentNode);
    }
  }

  prepareOperation = (index: number = 0): string => {
    const suffix = index.toString();
    const fragment = configureNodeFragment(
      this.store,
      this.modelConstructor,
      '',
      suffix,
    );
    const query = configureConnectionQuery(this.modelConstructor, '', suffix);
    const variables = configureConnectionVariables(
      this.modelConstructor,
      '',
      suffix,
    );
    const Meta = this.modelConstructor.Meta;
    const relationsVars = Object.assign(
      {},
      ...Object.keys(Meta).map((fieldName) => {
        if (Meta[fieldName]!.fieldType === 'relationship') {
          const rel = Meta[fieldName] as RelationshipField;
          const RelType = this.store.modelFor(rel.modelName);
          const subprefix =
            this.modelConstructor.modelName + '_' + rel.dataKey + '_';
          if (rel.relationshipType === 'hasMany') {
            return configureConnectionVariables(RelType, subprefix, suffix);
          }
          if (rel.relationshipType === 'belongsTo') {
            return configureNodeVariables(RelType, subprefix, suffix);
          }
        }
      }),
    );

    const vgql = Object.keys(variables)
      .map((keyArg) => `$${variables[keyArg]![0]}: ${variables[keyArg]![1]}`)
      .join(', ');
    const relvgql = Object.keys(relationsVars)
      .map(
        (keyArg) =>
          `$${relationsVars[keyArg]![0]}: ${relationsVars[keyArg]![1]}`,
      )
      .join(', ');
    const operation = `
      ${fragment}
      query ${this.modelConstructor.name}ConnectionQueryOperation (${vgql}, ${relvgql}) {
        ${query}
      }
    `;
    return operation;
  };

  private resetErrors = () => {
    this.error = undefined;
    this.errors = undefined;
  };

  get currentState() {
    if (this.error) {
      return this.error;
    }
    // return this.edges;
  }

  get meta() {
    return {
      pagination: this.pageInfo,
    };
  }

  query = async () => {
    this.loading = true;
    const operation = this.prepareOperation();

    const { data, errors, error, loading, networkStatus, partial } =
      await this.store.client.query({
        query: gql(operation),
        variables: this.variables,
      });
    this.networkStatus = networkStatus;
    this.loading = loading;
    this.error = error;
    this.errors = errors as unknown as GraphQLError[];
    if (data) {
      // remove previous errors
      this.resetErrors();
      // encapsulate all edges and nodes
      // use naming convention
      data[`${this.modelConstructor.name}Connection0`].edges.forEach(
        (edge: TRelayEdge<TypeNode>) => {
          // this.store.edge(this, edge);
        },
      );
    }
    console.log(data);
    return this.currentState;
  };
}
