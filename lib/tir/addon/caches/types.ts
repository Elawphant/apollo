import type { PodRegistry } from "tir/model/registry";

type RootFieldName = string;

type ParentModelName = keyof PodRegistry;


enum RootType {
    node = 'node',
    connection = 'conection',
    edges = 'edges',
    record = 'record',
    nodeList = 'nodeList',
    scalar = 'scalar',
    end = 'end'
};

export type { RootFieldName, ParentModelName, };
export { RootType }