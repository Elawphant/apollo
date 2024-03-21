import type { Composer } from './composer';
import type { QueryField } from './types';
import type { withScalar } from './with-scalar';

const mutation = (
  fields: {
    [key: string]: QueryField;
    __input: Record<string, ReturnType<typeof withScalar>>;
  },
  operationName?: string,
) => {
  const __mutation = (composer: Composer) => {
    const { __input, ...rest } = fields;
    const level = 0;
    const __operationName = composer.registerOperationName(operationName);
    if (__input) {
      // only register
      composer.handleVariables(__input, __operationName, level);
    }
    let tree = '';
    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      tree += composer.resolveFields(
        fieldName,
        fieldValue,
        __operationName,
        [],
        level + 1,
      );
    });
    // IMPORTANT! must be called after resolveFields with all the tree to ensure all variables are recorded!
    const operationVariables =
      composer.composeOperationVariables(__operationName);
    return `mutation ${__operationName} ${operationVariables} {
            ${tree}
        }`;
  };
  return __mutation;
};

export { mutation };
