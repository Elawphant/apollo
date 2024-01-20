import type { TRelayNodeData } from "./node";

export type TRelayEdgeData = {
  __typename?: string;
  cursor?: string;
  node: TRelayNodeData;
  [key: string]: any;
};

export class Edge {
  constructor(fields: any){
    Object.assign(this, fields);
  };
}
