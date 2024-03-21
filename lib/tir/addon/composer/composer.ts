import { assert } from '@ember/debug';
import type { TirService } from 'tir/';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';
import type { PodRegistry } from 'tir/model/registry';
import { configure } from 'tir/utils';
import {
  type Expectation,
  type NodeListField,
  type ObjectField,
  type QueryField,
} from './types';
import type { withScalar } from './with-scalar';
import { RootType } from 'tir/caches/types';
import type { AttrField, RelationshipField } from 'tir/model/field-mappings';

class Composer {
  public declare readonly store: TirService;

  private declare readonly expectations: Map<string, Expectation>;

  private declare lastOperationIndex: number;
  private declare lastVariableIndex: number;

  private declare readonly operationVariables: Map<
    string,
    Set<ReturnType<ReturnType<typeof withScalar>>>
  >;

  declare operations: Map<
    string,
    {
      queryDocument: string;
      variables: Record<string, unknown>;
    }
  >;

  constructor(store: TirService) {
    configure(store, this);
    this.operations = new Map();
    this.expectations = new Map();
    this.operationVariables = new Map();
    this.lastVariableIndex = 0;
    this.lastOperationIndex = 0;
  }

  public resolveFields = (
    key: string,
    field: QueryField,
    uniqueOperationName: string,
    path: string[],
    level: number,
    enforceModelName?: keyof PodRegistry,
  ): string => {
    assert(
      `${ERROR_MESSAGE_PREFIX}Fields must be declared via objects or using '__scalars'`,
      typeof field === 'object' && !Array.isArray(field),
    );

    const {
      __alias,
      __connection,
      __directives,
      __edges,
      __list,
      __node,
      __modelName,
      __queryParams,
      __scalars,
      ...fields
    } = field as QueryField & {
      __alias?: string;
      __connection?: boolean;
      __directives?: { include?: string; skip?: string };
      __edges: ObjectField | NodeListField;
      __list: boolean;
      __node: boolean;
      __modelName?: keyof PodRegistry;
      __queryParams?: Record<string, ReturnType<typeof withScalar>>;
      __scalars?: ((AttrField | RelationshipField)['propertyName'] | string)[];
    };

    const responseKey = __alias ? __alias : key;
    const __path =
      key === 'edges' || __edges || __list
        ? [...path, responseKey, '#']
        : [...path, responseKey];

    let expectationType: RootType;

    let identifierField: AttrField['propertyName'] | undefined = undefined;

    switch (true) {
      // connection
      case __modelName !== undefined &&
        (key.includes('Connection') ||
          key.includes('connection') ||
          __connection === true):
        expectationType = RootType.connection;
        break;
      // flat node list
      case (__modelName !== undefined || enforceModelName !== undefined) &&
        __list === true:
        expectationType = RootType.nodeList;
        break;
      // edges
      // in case server responds with spec non complient key, use __edges to correct the expected response
      case ((__modelName !== undefined || enforceModelName !== undefined) &&
        key === 'edges') ||
        __edges:
        expectationType = RootType.edges;
        break;
      // node
      case ((__modelName !== undefined || enforceModelName !== undefined) &&
        key === 'node') ||
        key.includes('Node') ||
        key.includes('node') ||
        __node === true:
        if (__modelName && enforceModelName) {
          assert(
            `${ERROR_MESSAGE_PREFIX}'__modelName' on node must be ommited or be the same as on containing list or connection`,
            __modelName === enforceModelName,
          );
        }
        expectationType = RootType.node;
        const { propertyName } = this.store.getIDInfo(__modelName!);
        identifierField = propertyName;
        break;
      // object without modelName
      case __modelName === undefined &&
        enforceModelName === undefined &&
        (fields || __queryParams || __scalars):
        expectationType = RootType.record;
        break;
      // scalar field of node
      case (__modelName !== undefined || enforceModelName !== undefined) &&
        ((fields === undefined && __queryParams === undefined) ||
          __scalars === undefined):
        expectationType = RootType.scalar;
        break;
      // scalar field of object without modelName
      default:
        expectationType = RootType.end;
        break;
    }

    this.registerExpectation({
      responseKey: responseKey,
      key: key,
      path: __path,
      level: level,
      type: expectationType,
      modelName: enforceModelName ?? (__modelName as string), // expected also undefined, but safe to cast
      alias: __alias,
      queryParams: __queryParams,
      identifierField: identifierField as string, // ok to cast, identifierField is not necessary on types other than node
    });

    // TODO: add directives
    // resolve queryParams
    if (
      Object.keys(RootType)
        .filter((k) => ![RootType.end, RootType.scalar].includes(k as RootType))
        .includes(expectationType)
    ) {
      const params = __queryParams
        ? `(${this.handleVariables(__queryParams, uniqueOperationName, level)})`
        : '';
      return `${this.resolveFieldNaming(key, __alias, __modelName)} ${params} {
        ${Object.entries(fields as Record<string, QueryField>).forEach(
          ([fieldName, declaration]) => {
            return this.resolveFields(
              fieldName,
              declaration,
              uniqueOperationName,
              __path,
              level + 1,
              [RootType.connection, RootType.edges, RootType.nodeList].includes(
                expectationType,
              )
                ? __modelName
                : undefined,
            );
          },
        )}
      }`;
    } else {
      return this.resolveFieldNaming(key, __alias, __modelName);
    }
  };

  registerExpectation = (expectation: Expectation) => {
    const key = `${expectation.responseKey}:${expectation.level}`;
    this.expectations.set(key, expectation);
  };

  public getExpectation = (key: string, level: number) => {
    return this.expectations.get(`${key}:${level}`);
  };

  private getNextVariableIndex = (level: number) => {
    const index = (this.lastVariableIndex += 1);
    return `${level}_${index}`;
  };

  public getNextOperationIndex = () => {
    return `0_${(this.lastOperationIndex += 1)}`;
  };

  private resolveFieldNaming = (
    key: string,
    alias?: string,
    modelName?: keyof PodRegistry,
  ) => {
    // return aliased root if alias is provided
    if (alias) {
      return `${alias}: ${key}`;
    }
    // otherwise check if there is dataKey defined on modelName
    if (modelName) {
      const TYPE = this.store.modelFor(modelName);
      const maybeProperty = TYPE.META.properties[key];
      const maybeField = maybeProperty
        ? TYPE.META.fields[maybeProperty]
        : undefined;
      if (
        maybeProperty &&
        maybeProperty !== key &&
        maybeField &&
        maybeField.alias
      ) {
        // return aliased
        return `${maybeProperty}: ${maybeField.dataKey}`;
      }
    }
    // otherwise return the key
    return key;
  };

  public handleVariables = (
    params: Record<string, ReturnType<typeof withScalar>>,
    uniqueOperationName: string,
    level: number,
  ) => {
    if (!this.operationVariables.get(uniqueOperationName)) {
      this.operationVariables.set(uniqueOperationName, new Set());
    }
    const rootParams: string[] = [];
    Object.entries(params).forEach(([key, configurator]) => {
      const variableName = `${key}${this.getNextVariableIndex(level)}`;
      const config = configurator(key, variableName);
      this.operationVariables.get(uniqueOperationName)!.add(config);
      rootParams.push(`${config.queryParamName}: ${config.variableName}`);
    });
    return rootParams.join(', ');
  };

  public registerOperationName = (customName?: string) => {
    const index = this.getNextOperationIndex();
    assert(
      `${ERROR_MESSAGE_PREFIX}Duplicate operation name '${customName}': No duplicate operation names are allowed in GrpahQL request document`,
      customName && !this.operationVariables.get(customName),
    );
    const operationName = customName ?? `UnnamedOperation` + index;
    this.operationVariables.set(operationName, new Set());
    return operationName;
  };

  public composeOperationVariables = (operationName: string) => {
    const variables = this.operationVariables.get(operationName);
    return variables && variables.size !== 0
      ? `(${Array.from(variables)
          .map((item) => `$${item.variableName}:${item.scalarType}`)
          .join(', ')})`
      : '';
  };
}

export { Composer };
