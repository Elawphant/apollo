import type { QueryFieldDeclaration } from 'ember-apollo-data/-private/util';
import type { VariableDeclaration } from './variables';

export function levelizeVars(
  variables: VariableDeclaration,
): Map<number, VariableDeclaration[]> {
  const map = new Map<number, VariableDeclaration[]>();
  Object.entries(variables).forEach(([varKey, varDecl]) => {
    const vars = varKey.split('.');
    if (!map.get(vars.length)) {
      map.set(vars.length, []);
    }
    map.get(vars.length)?.push({ [varKey]: varDecl });
  });
  return map;
}
