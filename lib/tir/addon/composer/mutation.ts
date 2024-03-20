import type { Composer } from "./composer";
import type { Fields } from "./types";

const mutation = (fields: Fields, operationName?: string) => {
    const __mutation = (composer: Composer) => {
        const { __input } = fields;
        const __operationName = composer.registerOperationName(operationName);
        if (__input){
            composer.handleVariables(__input, __operationName);
        };
        const tree = composer.resolveFields(fields, __operationName, [], 0);
        // IMPORTANT! must be called after resolveFields with all the tree to ensure all variables are recorded!
        const operationVariables = composer.composeOperationVariables(__operationName);
        return `mutation ${__operationName} ${operationVariables} {
            ${tree}
        }`
    };
    return __mutation;
};

export { mutation };