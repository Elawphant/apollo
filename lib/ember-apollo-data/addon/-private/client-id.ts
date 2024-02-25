import type { NodeRegistry } from "ember-apollo-data/model/registry";


/** 
 * A map of modelName to last internal private key number 
 * This serves as a column of private keys per modelName
 * */
const PrivateKeys: Map<keyof NodeRegistry, number> = new Map();


/**
 * Generates and returns a unique ClientId string for each modelType in form of `<modelName>:<PK>`;
 */
function clientIdFor(modelname: keyof NodeRegistry){
    const lastPK = PrivateKeys.get(modelname);
    const newPK = lastPK ? lastPK + 1 : 0;
    PrivateKeys.set(modelname, newPK);
    return `${modelname}:${newPK}`;
}

export { clientIdFor };