import type Node from "./node";


interface NodeRegistryInterface {
  [modelName: string]: typeof Node;
}

export const NodeRegistry: NodeRegistryInterface = {};
