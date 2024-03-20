import type { Pod } from '.';
import type { AttrField, RelationshipField } from './field-mappings';

/**
 * Given graphql response data and error path,
 * finds the respective data record and returns an object
 * with fieldName, object and errorField name
 * */
function getObjectAtPath(
  data: Record<string, any>,
  path: (string | number)[],
): {
  key: string | null;
  record: Record<string, any> | null;
  fieldErrorField: string;
} {
  const result: {
    key: string | null;
    record: Record<string, any> | null;
    fieldErrorField: string;
  } = {
    key: null,
    record: null,
    fieldErrorField: path[path.length - 1] as string,
  };
  path.slice(0, -1).reduce((acc, key) => {
    if (typeof acc === 'object') {
      const record = acc[key];
      if (typeof key === 'string') {
        result.key = key;
        result.record = record;
      }
      return record;
    }
    return;
  }, data);
  return result;
}

class Meta {
  isMeta: true = true;
  fields: Record<
    (AttrField | RelationshipField)['propertyName'],
    AttrField | RelationshipField
  > = {};
  properties: Record<
    (AttrField | RelationshipField)['propertyName'],
    (AttrField | RelationshipField)['dataKey']
  > = {};
}

const ensurePodMeta = (target: Pod['prototype']) => {
  if (!target.constructor.META) {
    target.constructor.META = new Meta();
  }
};

export { getObjectAtPath, ensurePodMeta, type Meta };
