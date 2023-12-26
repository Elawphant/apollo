export type TRelayEdgeData = {
  __typename?: string;
  cursor?: string;
  node: Record<string, any>;
  [key: string]: any;
};

export class Edge {
  configure = (fields: any) => {
    Object.assign(this, fields);
  };
}
