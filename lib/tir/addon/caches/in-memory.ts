import { tracked } from 'tracked-built-ins';
import { Connection, Pod } from '../model';
import { assert } from '@ember/debug';
import { getOwner } from '@ember/owner';
import type { PodRegistry } from '../model/registry';
import { capitalize, classify, dasherize } from '@ember/string';
import type { RequestDocument, Variables } from 'graphql-request';
import type {
  RootRef,
  GraphQlErrorData,
  TStemData,
  TPodData,
  ClientId,
} from '../model/types';
import TirService from 'tir/services/tir';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';
import {
  parse,
  type ParseOptions,
  visit,
  type OperationDefinitionNode,
  type FieldNode,
  Kind,
  type VariableNode,
} from 'graphql';
import { ConnectionRoot } from './connection-root';
import type { AttrField, RelationshipField } from '../model/field-mappings';
import { getObjectAtPath } from '../model/utils';
import { TirCache } from './cache';
import type { FieldProcessor } from 'tir/field-processor';
import { DefaultFieldProcessors } from 'tir/field-processors';
import { ScalarRoot } from './scalar-root';
import { NodeRoot } from './node-root';

// ATTENTION!!!
// For internal store must use the dataKey instead of propertyName, because
// non-relation LISTS and ROOTS do not have propertyName, also accessing via dataKey saves overhead

export class InMemoryCache extends TirCache {
  // TODO: review
  public parseGraphQlDocument = (
    source: RequestDocument,
    options?: ParseOptions | undefined,
  ) => {
    const AST = typeof source === 'object' ? source : parse(source);
    const aliasMap: Map<
      string,
      {
        dataKey: string;
        variables: Variables;
        deleteable?: ClientId;
      }
    > = new Map();

    const conventions = this.namingConventions;

    const parseAlias = this.parseAlias.bind(this);
    const getPod = this.getPod.bind(this);
    const getIDInfo = this.getIDInfo.bind(this);

    const DeleteMutationRegex = new RegExp(`(Delete)`);

    visit(AST, {
      // Only process operation definitions (queries, mutations, subscriptions)
      OperationDefinition: {
        enter(operationDefinitionNode: OperationDefinitionNode) {
          const shouldIncludeClientId = Boolean(
            operationDefinitionNode.name?.value &&
              operationDefinitionNode.name.value.includes('Delete'),
          );
          // Traverse through the selection set of the operation
          operationDefinitionNode.selectionSet.selections.forEach(
            (selection) => {
              if (selection.kind === Kind.FIELD) {
                const field = selection;

                // Check if the field has an alias and if it matches the naming convention

                if (field.alias) {
                  const alias = field.alias.value;
                  const { typeName, type } = parseAlias(alias) ?? {};
                  if (typeName && type) {
                    // get the dataKey for id field
                    const { dataKey } = getIDInfo(typeName);
                    const variables: Variables = {};

                    // Collect arguments (variables) of the connection field
                    field.arguments?.forEach((arg) => {
                      // assume variables to have value. if no, let the server handle with error
                      if (
                        arg.value &&
                        (arg.value as { value: any } & VariableNode).value
                      ) {
                        variables[arg.name.value] = (
                          arg.value as { value: any } & VariableNode
                        ).value;
                      }
                    });
                    // prevent same alias usage in multiple query operations in a single document
                    assert(
                      `${ERROR_MESSAGE_PREFIX}Duplicate field identifier "${alias}" at ${field.loc}`,
                      aliasMap.has(alias),
                    );
                    // Add the node and connection and its variables to the map
                    aliasMap.set(alias, {
                      dataKey: field.name.value,
                      variables: variables,
                      // collect the clientId is for the deletion operation
                      deleteable:
                        type === conventions.item && shouldIncludeClientId
                          ? getPod(typeName, variables[dataKey])?.CLIENT_ID
                          : undefined,
                    });
                  }
                }
              }
            },
          );
        },
      },
    });
    return aliasMap;
  };

  /** Primary gateway to serialize the incoming data */
  public serialize = (
    aliases: Map<
      string,
      { dataKey: string; variables: Variables; deleteable?: ClientId }
    >,
    data: Record<string, unknown>,
    errors?: GraphQlErrorData[],
  ): Record<string, unknown> => {
    this.serializeRoot(aliases, data, [], undefined, undefined, errors);
    aliases.forEach((collection) => {
      if (collection.deleteable) {
        this.removePod(collection.deleteable);
      }
    });
    return data;
  };

  /** Serializes data by calling the encapsulator on aliased fields or passing it further down the nested objects */
  private serializeRoot = (
    aliases: Map<string, { dataKey: string; variables: Variables }>,
    data: unknown,
    path: (string | number)[],
    clientId?: ClientId,
    items?: Set<ClientId>,
    errors?: GraphQlErrorData[],
  ) => {
    const pathAsString = JSON.stringify(path);
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      Object.entries(data).forEach(([possiblyAliasedDataKey, keyData]) => {
        const { dataKey, typeName, type } =
          this.parseAlias(possiblyAliasedDataKey) ?? {};
        if (dataKey && typeName && type && keyData) {
          const rootKey = this.getRootId(typeName, dataKey, clientId);
          // first handle errors for the field and than encapsulate to avoid setting null on error
          if (errors) {
            if (clientId && type === this.namingConventions.item) {
              let possibleFieldError: GraphQlErrorData | undefined;
              possibleFieldError = errors.find(
                (error) => JSON.stringify(error.path) === pathAsString,
              );
              if (possibleFieldError) {
                this.getRoot({
                  modelName: typeName,
                  root: dataKey,
                  clientId,
                }).addError(possibleFieldError.message);
              }
            }
          } else {
            this.encapsulate(
              aliases,
              typeName,
              type,
              rootKey,
              keyData as TPodData | TStemData,
              [...path, possiblyAliasedDataKey],
              clientId,
              items,
            );
          }
        } else {
          // proceed finding nested stems and pods
          this.serializeRoot(aliases, keyData, [
            ...path,
            possiblyAliasedDataKey,
          ]);
        }
      });
    } // else is wrong data. we should probably not consider that options
  };

  private encapsulate = (
    aliases: Map<string, { dataKey: string; variables: Variables }>,
    typeName: keyof PodRegistry,
    type:
      | TirCache['namingConventions']['item']
      | TirCache['namingConventions']['set'],
    rootDataKey: RelationshipField['dataKey'],
    data: TPodData | TStemData,
    path: (string | number)[],
    clientId?: ClientId,
    items?: Set<ClientId>,
  ): void => {
    const modelName = dasherize(typeName);

    const possiblyAliasedDataKey = path[-1]! as string;

    if (type === this.namingConventions.set) {
      const stemData = data as TStemData;

      // root reference
      const ref = {
        modelName: modelName,
        root: rootDataKey,
        clientId: clientId,
      };

      const rootInstance = this.getRoot(ref);
      const rootId = this.getRootId(modelName, rootDataKey, clientId);
      assert(
        `${ERROR_MESSAGE_PREFIX}Improperly configured, expected ${classify(
          modelName,
        )}Stem, however received ${rootInstance.constructor.name}`,
        rootInstance instanceof ConnectionRoot,
      );
      const connection = rootInstance.getConnection(
        aliases.get(possiblyAliasedDataKey)!,
      )!;

      // TODO. maybe implement passing of non relay complient list

      const { edges } = stemData;
      const clientIdsInList: Set<ClientId> = new Set();
      edges?.forEach((edge, index) => {
        // no aliasing should be used to aliase a node inside Stem edge
        const nodeData = edge['node'] as TPodData;
        if (nodeData) {
          // continue serialization of a node
          this.serializeRoot(
            aliases,
            nodeData as TPodData,
            [...path, 'edges', index, 'node'],
            undefined,
            clientIdsInList,
          );
        }
      });
      // set the root or relation data
      this.updateRoot(ref, null, clientIdsInList, null, true, true); // do not replace value, instead add them
      // update the connection data by overriding its values
      connection.update(stemData, clientIdsInList);

      // register connection in gloabl registery for easy retrival
      clientIdsInList.forEach((clientId) => {
        this.registerBond(clientId, rootId, true);
      });
    } else if (type === this.namingConventions.item) {
      const podData = data as TPodData;
      // assumes that that the dataKey declared as identifier field is not aliased differently on grapqhl document node
      const { dataKey } = this.getIDInfo(modelName);
      // create/update pod
      // N.B. we are not creating NodeRoots for top level roots and node roots inside edges
      // because that makes no sense: nodes should be accessed as pod instances via id
      // however, belongsTo relations are NodeRoot instances and we access/write relations via those roots
      const podInstance = this.getOrCreatePod(modelName, podData[dataKey]);
      // add this node to passed parent clientIdList to be included in the enclosing ConnectionRoot
      if (items) {
        items.add(podInstance.CLIENT_ID);
      }
      const meta = this.getFieldMetaForType(modelName);
      Object.entries(podData).forEach(([key, value]) => {
        // extract real key, can be prefixed again
        const possiblyAliasedRootKeyInfo = this.parseAlias(key);
        const internalDataKey = possiblyAliasedRootKeyInfo
          ? possiblyAliasedRootKeyInfo.dataKey
          : key;
        const field = meta.get(internalDataKey);
        // skip relation fields and unregistered attrs, letting serializeRoot handle them
        if (field && field.fieldType === 'attribute') {
          // update attribute root
          this.updateRoot(
            {
              modelName: modelName,
              root: field.dataKey,
              clientId: podInstance.CLIENT_ID,
            },
            value,
            null,
            null,
            true,
            true,
          );
        }
        // handle next level
        this.serializeRoot(
          aliases,
          value,
          [...path, key],
          podInstance.CLIENT_ID,
        );
      });
    }
  };
}
