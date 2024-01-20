import { assert } from '@ember/debug';
import type {
  QueryFieldDeclaration,
  RootQueryDescription,
} from 'ember-apollo-data/-private/util';
import type { NodeRegistry } from 'ember-apollo-data/model-registry';
import type EADStoreService from 'ember-apollo-data/services/ead-store';
import type Owner from '@ember/owner';
import { setOwner } from '@ember/owner';
import { verifyQueries } from './assertions/query';
import { Node } from 'ember-apollo-data/model';
import { configureVariables, type VariableDeclaration } from './variables';
import { configureQuery } from './queries';
import { configureNodeFragment } from './fragment';

// TODO move to DOCS
const example = {
  user: {
    type: 'node',
    fields: [
      'name',
      'email',
      'parents',
      {
        friends: [
          'name',
          'email',
          {
            crush: ['name', 'gender', 'mutualFriends'],
          },
        ],
      },
    ],
    variables: {
      id: 'asdlkasjdkasjd',
      'friends.offset': 20,
      'friends.name__icontains': 'Jo',
      'friends.crush.mutualFriends.age__gte': 30,
      'friends.crush.mutualFriends.offset': 10,
    },
  },
};


export class AutoGraph {
  private declare store: EADStoreService;
  private declare operationName: string;

  private declare rootQueryDescriptionsPerModelName: Map<number, { [modelName: keyof typeof NodeRegistry]: RootQueryDescription }>;

  /**
   * Must adhere to `[pathToRelationFieldWithoutKeyArg]: modelName.field.subfield` or simply `modelName` if no relation fields;
   */
  private declare distributedQueryParams: Map<number, {
    [pathToRelationFieldWithoutKeyArg: string]: any[]
  }>
 
  public declare variables: Map<number, VariableDeclaration>;
  private declare queries: Map<number, string>;
  private declare through: Map<
    VariableDeclaration,
    Record<string, any> | undefined
  >;

  private declare fragments: Map<string, string>;

  constructor(
    owner: Owner,
    storeName: string,
    queries: { [modelName: keyof typeof NodeRegistry]: RootQueryDescription }[],
    operationName: string = 'GenericQueryOperation',
  ) {
    setOwner(this, owner);
    this.store = owner.lookup(`service:${storeName}`) as EADStoreService;
    verifyQueries(this.store.modelFor, queries);
    this.operationName = operationName;
    this.fragments = new Map();
    this.variables = new Map();
    this.queries = new Map();
    this.through = new Map();
    this.rootQueryDescriptionsPerModelName = new Map()
    queries.forEach((query, index) => {
      this.rootQueryDescriptionsPerModelName.set(index, query);
    })
    this.configureDependencies();
  }

  private configureDependencies = () => {
    this.rootQueryDescriptionsPerModelName.forEach((query, index) => {
      const modelName = Object.keys(query)[0]!;
      const rootQueryDescription = Object.values(query)[0]!;
      const variables = configureVariables(
        this.store.modelFor,
        modelName,
        rootQueryDescription,
        index,
      );
      this.variables.set(index, variables);
      this.queries.set(
        index,
        configureQuery(
          this.store.modelFor,
          modelName,
          rootQueryDescription,
          variables,
          index,
        ),
      );
      this.through.set(variables, Object.values(query)[0]!.variables);
      this.configureFragments();
    });
  };

  private keepFragment = (modelName: string, fragment: string) => {
    if (!this.fragments.get(modelName)) {
      this.fragments.set(modelName, fragment);
    }
  };

  private getRelationFragments = (
    parentNodeType: typeof Node,
    fields: QueryFieldDeclaration[],
  ): void => {
    fields.forEach((field) => {
      if (field) {
        const fieldMeta =
          typeof field === 'string'
            ? parentNodeType.Meta[field]
            : parentNodeType.Meta[Object.keys(field)[0]!];
        if (fieldMeta?.fieldType === 'relationship') {
          if (typeof field === 'string') {
            this.keepFragment(
              fieldMeta.modelName,
              configureNodeFragment(this.store.modelFor(fieldMeta.modelName)),
            );
          } else {
            const subFields = Object.values(field)[0];
            if (subFields) {
              this.getRelationFragments(
                this.store.modelFor(fieldMeta.modelName),
                subFields,
              );
            }
          }
        }
      }
    });
  };

  private configureFragments = (): void => {
    this.rootQueryDescriptionsPerModelName.forEach((query) => {
      const modelName = Object.keys(query)[0]!;
      const descr = Object.values(query)[0]!;
      if (!descr.fields) {
        this.keepFragment(
          modelName,
          configureNodeFragment(this.store.modelFor(modelName)),
        );
      }
      if (descr.fields) {
        const NodeType = this.store.modelFor(modelName);
        this.getRelationFragments(NodeType, descr.fields);
      }
    });
  };

  public configureOperaton = () => {
    const variables = Array.from(this.variables.values()).map(
      (varDecl) => {
        return `$${Object.keys(Object.values(varDecl)[0]!)[0]!}: ${Object.values(Object.values(varDecl)[0]!)[0]
          }`;
      },
    );
    const queries = Array.from(this.queries.values()).join('\n');
    const opVars = variables ? `(${variables.join(',')})` : '';
    const fragments = Array.from(this.fragments.values()).join('\n');
    return `
            query ${this.operationName} ${opVars} {
                ${queries}
            }

            ${fragments}
        `;
  };

  public configureOperationVariables = () => {
    const operationVariables = {};
    this.variables.forEach((varDecl) => {
      Object.entries(varDecl).forEach(([key, val]) => {
        const queryVarVal = this.through.get(varDecl);
        if (queryVarVal) {
          Object.assign(operationVariables, {
            [`${Object.keys(val)[0]!}`]: queryVarVal[key],
          });
        }
      });
    });
    return operationVariables;
  };

  public getVariables = (index: string) => {
    const varDecl = this.variables.get(Number(index))!;
    return this.through.get(varDecl);
  }


  public getQueryParamsFor = (index: number) => {
    const [modelName, queryDesc] = Object.entries(this.rootQueryDescriptionsPerModelName.get(index)!)!;
    return 
  }
}
