import type { RootQueryDescription } from "ember-apollo-data/-private/util";
import type { Node } from ".";
import type { RelationshipField } from "./field-mappings";
import { Queryable } from "./queryable";
import type { NodeRegistry } from "./registry";
import type { TRelayNodeData } from "./node";
import { assert } from "@ember/debug";
import type EADStoreService from "ember-apollo-data/services/ead-store";
import { getOwner, setOwner } from "@ember/owner";




export class ToOne extends Queryable {
  declare private modelName: keyof typeof NodeRegistry;
  declare private parentNode: Node;
  declare private fieldNameOnParent: string

  public node: Node | null = null;

  constructor(
    store: EADStoreService,
    modelName: string,
    parentNode: Node,
    fieldNameOnParent: string,
  ){
    super();
    const owner = getOwner(store)!
    setOwner(this, owner);
    this.store = owner.lookup(`service:${store.NAME}`) as EADStoreService;
    this.modelName = modelName;
    this.parentNode = parentNode;
    this.fieldNameOnParent = fieldNameOnParent;
    }

  get queryParams() {
    const output: { [key: string]: RootQueryDescription } = {
      [(this.parentNode.constructor as typeof Node).modelName as string]: {
        type: "node",
        fields: [this.fieldNameOnParent],
        variables: {
          "id": this.parentNode.id
        }
      }
    }
    return output;
  }

  encapsulate = (data: TRelayNodeData) => {
    const nodeData: TRelayNodeData | null | undefined = data[this.fieldNameOnParent];
    if (nodeData){
      this.node = this.store.node(this.modelName as string, nodeData);
    }
  }
}