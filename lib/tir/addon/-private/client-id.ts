import type { PodRegistry } from 'tir/model/registry';
import type { ClientId } from 'tir/model/types';

/**
 * A map of modelName to last internal private key number
 * This serves as a column of private keys per modelName
 * */
const PrivateKeys: Map<keyof PodRegistry, number> = new Map();

/**
 * Generates and returns a unique ClientId string for each modelType in form of `<modelName>:<PK>`;
 */
function clientIdFor(modelname: keyof PodRegistry): ClientId {
  const lastPK = PrivateKeys.get(modelname);
  const newPK = lastPK ? lastPK + 1 : 0;
  PrivateKeys.set(modelname, newPK);
  return `${modelname}:${newPK}`;
}

export { clientIdFor };
