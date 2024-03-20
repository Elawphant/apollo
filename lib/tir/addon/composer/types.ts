import type { TirService } from "tir/";
import type { AttrField, RelationshipField } from "tir/model/field-mappings";
import type { PodRegistry } from "tir/model/registry";
import type { withScalar } from "./with-scalar";
import type { RootType } from "tir/caches/types";


const DASHERIZED_KEYS = [
  '__alias',
  '__directives',
  '__scalars',
  '__queryParams',
  '__modelName',
  '__node',
  '__list',
  '__connection'
] as const;

type ScalarField = {
  __alias?: string | undefined;
  __directives?: {
    include?: string;
    skip?: string;
  };
} | {};

interface ComplexFieldProps {
  __scalars?: ((AttrField | RelationshipField)['propertyName'] | string)[];
  __queryParams?: Record<string, ReturnType<typeof withScalar>>;
};

interface ModelNameProps {
  __modelName: keyof PodRegistry;
};

type ObjectField = {
  [key in string]: ScalarField | ObjectField | NodeField | ConnectionField | NodeListField | undefined;
} & ScalarField & ComplexFieldProps;

type NodeField = ObjectField & ModelNameProps & {
  __node: boolean;
};

type ConnectionField = {
  [key in string]: ObjectField | undefined;
} & ScalarField & ComplexFieldProps & ModelNameProps & {
  __connection: boolean,
  edges?: ObjectField | NodeListField
};


type NodeListField = ObjectField & ModelNameProps & {
  __list: boolean;
};

type QueryField = ScalarField | ObjectField | NodeField | ConnectionField | NodeListField;


type Expectation = {
  responseKey: string; // the key on response: i.e. dataKey or alias
  key: string | (AttrField | RelationshipField)['propertyName']
  path: (string | '#')[] // for easy error retrival on response
  level: number,
  alias?: string;
} & ({
  type: RootType.node;
  identifierField: string;
  modelName: keyof PodRegistry;
  queryParams?: Record<string, ReturnType<typeof withScalar>>;
} | {
  type: RootType.connection;
  modelName: keyof PodRegistry;
  queryParams?: Record<string, ReturnType<typeof withScalar>>;
} | {
  type: RootType.edges;
  modelName: keyof PodRegistry;
  queryParams?: Record<string, ReturnType<typeof withScalar>>;
} | {
  type: RootType.nodeList;
  modelName: keyof PodRegistry;
  queryParams?: Record<string, ReturnType<typeof withScalar>>;
} | {
  type: RootType.record;
  queryParams?: Record<string, ReturnType<typeof withScalar>>;
} | {
  type: RootType.scalar;
  modelName: keyof PodRegistry;
} | {
  type: RootType.end;
});


const query: Record<string, QueryField> = {
  users: {
    __modelName: 'user',
    __connection: true,
    // __alias: 'st'
  },
};




export {
  type QueryField,
  type ScalarField,
  type ObjectField,
  type NodeField,
  type NodeListField,
  type ConnectionField,
  type Expectation,
};
