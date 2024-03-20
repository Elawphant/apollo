import type { Composer } from "./composer";
import type { Fields } from "./types";

const query = (fields: Fields, operationName?: string) => {
    const __query = (composer: Composer) => {
        const __operationName = composer.registerOperationName(operationName)
        const tree = composer.resolveFields(fields, __operationName, [], 0);
        // IMPORTANT! must be called after resolveFields with all the tree to ensure all variables are recorded!
        const operationVariables = composer.composeOperationVariables(__operationName);
        return `query ${__operationName} ${operationVariables} {
            ${tree}
        }`
    };

    return __query;
}

export { query };