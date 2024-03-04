import { assert } from "@ember/debug";
import { getOwner, setOwner } from "@ember/owner";
import type { TirService } from "ember-apollo-data/";
import type { PodRegistry } from "./model/registry";




function configureOwner(store: TirService, object: Object) {
    const owner = getOwner(store);
    assert(`Unable to set owner on ${object.toString()} from ${store.toString()}: ${store.toString()}, owner is "${owner}"`, owner);
    setOwner(object, owner);
}

function configure(store: TirService, object: { store: TirService }) {
    const owner = getOwner(store);
    assert(`Unable to set owner on ${object.toString()} from ${store.toString()}: ${store.toString()}, owner is "${owner}"`, owner);
    setOwner(object, owner);
    object.store = owner.lookup(`service:${store.SERVICE_NAME}`) as TirService;
}

function configurePrototype(store: TirService, modelName: keyof PodRegistry, object: Object) {
    const owner = getOwner(store);
    assert(`Unable to set owner on ${object.toString()} from ${store.toString()}: ${store.toString()}, owner is "${owner}"`, owner);
    setOwner(object, owner);
    Object.assign(object, {
        store:owner.lookup(`service:${store.SERVICE_NAME}`) as TirService,
        modelName: modelName,
    });
}


export {
    configureOwner,
    configure, configurePrototype
}