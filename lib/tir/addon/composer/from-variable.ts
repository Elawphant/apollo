import { assert } from '@ember/debug';
import type { Composer } from './composer';
import type { withScalar } from './with-scalar';
import { ERROR_MESSAGE_PREFIX } from 'tir/-private/globals';

const fromVariable = (variableName: string) => {
  const __fromVariable = (
    variablesForLevel: ReturnType<ReturnType<typeof withScalar>>[],
  ) => {
    const output = variablesForLevel.find(
      (variable) => variable.variableName === variableName,
    );
    assert(
      `${ERROR_MESSAGE_PREFIX}Cannot find variable '${variableName}'`,
      output,
    );
    return output;
  };
};

export { fromVariable };
