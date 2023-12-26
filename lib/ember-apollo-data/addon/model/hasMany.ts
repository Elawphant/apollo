import Node from './node';
import { set } from '@ember/object';
import { assert } from '@ember/debug';
import { type RelationshipField } from './field-mappings';
import type {
  DecoratorPropertyDescriptor,
  ElementDescriptor,
} from 'ember-apollo-data/-private/util';
import type { OperationVariables } from '@apollo/client';

/**
 * TODO
 * 1. DOCS
 * 2. State Manager Class for updating relations, maybe transformer
 * @param modelName
 * @param options
 */
function hasMany(
  modelName: string,
  options?: { attrName?: string },
): PropertyDecorator;
function hasMany(
  modelName: string,
  options?: { attrName?: string },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function hasMany(
  modelName: string,
  options?: { attrName?: string },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function hasMany(
  modelName: string,
  options?: { attrName?: string },
  ...args: [] | [ElementDescriptor[0], ElementDescriptor[1]] | ElementDescriptor
): PropertyDecorator | DecoratorPropertyDescriptor | void {
  assert(
    `An explicit modelName must be provided as first argument to belongsTo.`,
    !modelName || (modelName && typeof modelName === 'string'),
  );

  return function (target: any, propertyName: string | symbol): any {
    if (!target['Meta']) {
      target['Meta'] = {};
    }
    if (!target.Meta[propertyName]) {
      target.Meta[propertyName] = {
        propertyName: propertyName,
        modelName: modelName,
        fieldType: 'relationship',
        relationshipType: 'hasMany',
        isClientField: true,
        dataKey: options?.attrName ?? propertyName,
        getter: function () {
          // @ts-ignore
          const node: Node = this;

          const fieldModelName = (
            node._meta[propertyName as string] as RelationshipField
          ).modelName;
          function connection(connectionQueryVaraiables: OperationVariables) {
            return node.store.connection(
              fieldModelName,
              connectionQueryVaraiables,
              node.store.node((node.constructor as typeof Node).modelName, {
                id: node.id,
              }),
              options?.attrName ?? (propertyName as string),
            );
          }
          return connection;
        },
        setter: function (value: any) {
          throw new Error(`
          Cannot set a value on a connection: nodes should be added or removed on relations via 'connection.addNodes' and 'connection.removeNodes'.`);
        },
      } as RelationshipField;
    }
  };
}

export default hasMany;
