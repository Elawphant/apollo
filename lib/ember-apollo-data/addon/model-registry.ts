import Node from './model/node';

type NodeRegistry = Record<string, typeof Node>;

export const NodeRegistry: NodeRegistry = {};
