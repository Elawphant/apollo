import type { Composer } from './composer';
import type { QueryField } from './types';

const query = (fields: Record<string, QueryField>, operationName?: string) => {
  const __query = (composer: Composer) => {
    const __operationName = composer.registerOperationName(operationName);
    const operationVariables =
      composer.composeOperationVariables(__operationName);
    let tree = '';
    Object.entries(fields).forEach(([fieldName, fieldValue]) => {
      tree += composer.resolveFields(
        fieldName,
        fieldValue,
        __operationName,
        [],
        0,
      );
    });
    // IMPORTANT! must be called after resolveFields with all the tree to ensure all variables are recorded!
    return `query ${__operationName} ${operationVariables} {
            ${tree}
        }`;
  };
  return __query;
};

export { query };
