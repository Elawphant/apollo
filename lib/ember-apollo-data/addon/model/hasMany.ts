import Node from './node';
import { assert } from '@ember/debug';
import { type RelationshipField } from './field-mappings';
import type {
  DecoratorPropertyDescriptor,
  ElementDescriptor,
} from 'ember-apollo-data/-private/util';
import type { VariableDeclaration } from 'ember-apollo-data/configurators/graph-author/variables';

/**
 * TODO
 * 1. DOCS
 * 2. State Manager Class for updating relations, maybe transformer
 * @param modelName
 * @param options
 */
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
): PropertyDecorator;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: [ElementDescriptor[0], ElementDescriptor[1]]
): void;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
  ...args: ElementDescriptor
): DecoratorPropertyDescriptor;
function hasMany(
  modelName: string,
  options: {
    inverse: string,
    attrName?: string;
    fieldProcessorName?: string;
  },
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
        inverse: options.inverse,
        isClientField: true,
        dataKey: options?.attrName ?? propertyName,
        fieldProcessorName:
          options?.fieldProcessorName ?? 'default-connection-relation',
        getter: function () {
          // @ts-ignore
          const node: Node = this;
          const fieldModelName = (
            (node.constructor as typeof Node).Meta[propertyName as string] as RelationshipField
          ).modelName;
          // TODO type for connectionQueryVaraiables arg
          function connection(connectionQueryVaraiables: VariableDeclaration) {
            assert(
              `Querying on connection accepts only keyArgs for current connection: 
              if you are trying to make queries for nested relations,
              insteead use store.query to preload data before accessing the relation with same root level queryparams`, 
              Object.keys(connectionQueryVaraiables).every((key) => key.split(".").length === 1));
            return node.store.connection(
              fieldModelName,
              connectionQueryVaraiables,
              node,
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
