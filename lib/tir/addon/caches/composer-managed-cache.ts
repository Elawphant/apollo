import type { ClientId, FlatNodeArrayData, GraphQlErrorData, Pod, RelayConnectionData, RelayEdgeData, RelayNodeData, RootRef } from "../model/types";
import { TirCache } from "./cache";
import { Composer } from "../composer/composer";
import { type Expectation } from "../composer/types";
import type { PodRegistry } from "../model/registry";
import type { ConnectionRoot } from "./connection-root";
import { RootType } from "./types";
import { assert } from "@ember/debug";
import { ERROR_MESSAGE_PREFIX } from "tir/-private/globals";
import type { ScalarRoot } from "./scalar-root";
import { comparePaths } from "./utils";



const UNEXPECTED_STRUCTURE_DATA_ERROR = `${ERROR_MESSAGE_PREFIX}Received data of unexpected structure. Skipped!`;

class ComposerManagedCache extends TirCache {

  handleResponse = (composer: Composer, response: {
    data: Record<string, unknown>,
    errors?: GraphQlErrorData[],
  }) => {
    const { data, errors } = response;
    Object.entries(data).forEach(([key, value], index) => {
      const path: (string | number)[] = [];
      this.serialize(composer, key, value, errors ?? [], 0, [], undefined, null)
    })
  };

  private serialize = (
    composer: Composer,
    key: string,
    value: unknown,
    errors: GraphQlErrorData[],
    level: number = 0,
    currentPath: (string | number)[],
    parentClientId: ClientId | undefined,
    addables: Set<ClientId> | null,
  ) => {
    const expectation = composer.getExpectation(key, level);
    const __errors = this.findResponseErrors(errors, currentPath);

    // handle incorrect response
    if (expectation &&
      (([RootType.connection, RootType.node].includes(expectation.type))
        && (typeof value !== 'object' || typeof value !== null || Array.isArray(value)))
      || (expectation?.type === RootType.nodeList
        && (typeof value !== 'object' || typeof value !== null || !Array.isArray(value)))
    ) {
      console.error(UNEXPECTED_STRUCTURE_DATA_ERROR);
    } else {

      // expectation.responseKey === key should never fail when working with spec complient servers
      if (expectation && expectation.responseKey === key) {
        const { type, modelName, queryParams, responseKey, identifierField } = expectation as Expectation
          & { modelName?: keyof PodRegistry, identifierField: string, queryParams?: Record<string, unknown> };

        // handle each type
        switch (true) {
          // NODE
          case type === RootType.node:
            if (__errors) {
              if (parentClientId) {
                const ref: RootRef = {
                  clientId: parentClientId,
                  root: expectation.key
                }
                const root = this.getRoot(ref);
                __errors.forEach(err => root.addError(err.message));
              };
            } else {
              const record = value as RelayNodeData;
              const pod = this.getOrCreatePod(modelName, record[identifierField]);
              if (addables) {
                addables.add(pod.CLIENT_ID);
              };
              Object.entries(value!).forEach(([fieldName, fieldValue]) => {
                this.serialize(
                  composer,
                  fieldName,
                  fieldValue,
                  errors,
                  level + 1,
                  [...currentPath, responseKey],
                  pod.CLIENT_ID,
                  null
                );
              });
            };
            break;
          // CONNECTION
          case type === RootType.connection:
            const connectionRef: RootRef = parentClientId ? {
              clientId: parentClientId,
              root: expectation.key,
            } : {
              modelName: modelName,
              root: expectation.key,
              rootType: type
            };
            const connectionRoot = this.getRoot(connectionRef) as ConnectionRoot<Pod>;
            if (__errors) {
              __errors.forEach(err => connectionRoot.addError(err.message));
            } else {
              const __addables = new Set<ClientId>();
              Object.entries(value as RelayConnectionData).forEach(([fieldName, fieldValue]) => {
                this.serialize(
                  composer,
                  fieldName,
                  fieldValue,
                  errors,
                  level + 1,
                  [...currentPath, responseKey],
                  undefined,
                  __addables
                );
              });
              const connection = connectionRoot.getConnection(queryParams ?? {});
              connection.update(value as RelayConnectionData, __addables);
            };
            break;

          // EDGES
          case type === RootType.edges:
            if (!__errors) {
              (value as RelayEdgeData[]).forEach((edge, index) => {
                Object.entries(edge).forEach(([fieldName, fieldValue]) => {
                  this.serialize(
                    composer,
                    fieldName,
                    fieldValue,
                    errors,
                    level + 1,
                    [...currentPath, responseKey, index, fieldName],
                    undefined,
                    addables // connection addables
                  );
                })
              })
            };
            break;

          // FLAT NODE LIST
          case type === RootType.nodeList:
            const ref: RootRef = parentClientId ? {
              clientId: parentClientId,
              root: expectation.key,
            } : {
              modelName: modelName,
              root: expectation.key,
              rootType: type
            };
            const listRoot = this.getRoot(ref) as ConnectionRoot<Pod>;
            if (__errors) {
              __errors.forEach(err => listRoot.addError(err.message));
            } else {
              const __addables = new Set<ClientId>();
              (value as FlatNodeArrayData[]).forEach((record, index) => {
                this.serialize(
                  composer,
                  responseKey,
                  record,
                  errors,
                  level + 1,
                  [...currentPath, responseKey, index],
                  undefined,
                  __addables // connection addables
                );
              });
              listRoot.update({
                add: __addables,
                remove: new Set(),
              }, true, true);
            };
          case type === RootType.scalar:
            const scalarRef = parentClientId ? {
              clientId: parentClientId,
              root: expectation.key
            } : {
              modelName: modelName,
              rootType: type,
              root: expectation.key
            };
            const scalarRoot = this.getRoot(scalarRef) as ScalarRoot<unknown>;
            if (__errors) {
              __errors.forEach(err => scalarRoot.addError(err.message));
            } else {
              scalarRoot.update(value, true, true);
            };
            break;
          default: break;
        };
      };
    };
    return value;
  };



  private findResponseErrors = (errors: GraphQlErrorData[], path: (string | number)[]) => {
    return errors.filter(error => error.path! && comparePaths(error.path, path)) ?? null;
  };
}