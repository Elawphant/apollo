import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { Node } from '.';
import type { RelationshipField } from './field-mappings';
import { Queryable } from './queryable';
import type { PodRegistry } from './registry';
import type { TRelayNodeData } from './node-pod';
import { assert } from '@ember/debug';
import type TirService from 'ember-apollo-data/services/tir';
import { getOwner, setOwner } from '@ember/owner';

export class ToOne extends Queryable {
  private declare modelName: keyof PodRegistry;
  private declare parentNode: Node;
  private declare fieldNameOnParent: string;

  public node: Node | null = null;

  constructor(
    store: TirService,
    modelName: string,
    parentNode: Node,
    fieldNameOnParent: string,
  ) {
    super();
    const owner = getOwner(store)!;
    setOwner(this, owner);
    this.store = owner.lookup(`service:${store.NAME}`) as TirService;
    this.modelName = modelName;
    this.parentNode = parentNode;
    this.fieldNameOnParent = fieldNameOnParent;
  }

  get queryParams() {
    const output: { [key: string]: RootQueryDescription } = {
      [(this.parentNode.constructor as typeof Pod).modelName as string]: {
        type: 'node',
        fields: [this.fieldNameOnParent],
        variables: {
          id: this.parentNode.id,
        },
      },
    };
    return output;
  }

  encapsulate = (data: TRelayNodeData) => {
    const nodeData: TRelayNodeData | null | undefined =
      data[this.fieldNameOnParent];
    if (nodeData) {
      this.node = this.store.node(this.modelName as string, nodeData);
    }
  };
}
