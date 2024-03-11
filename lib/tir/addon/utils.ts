import { assert } from '@ember/debug';
import { getOwner, setOwner } from '@ember/owner';
import type TirService from 'tir/services/tir';
import type { PodRegistry } from './model/registry';
import type ApplicationInstance from '@ember/application/instance';

function configureOwner(store: TirService, object: Object) {
  const owner = getOwner(store);
  assert(
    `Unable to set owner on ${object.toString()} from ${store.toString()}: ${store.toString()}, owner is "${owner}"`,
    owner,
  );
  setOwner(object, owner);
}

function configure(store: TirService, object: { store: TirService }) {
  const owner = getOwner(store) as ApplicationInstance;
  setOwner(object, owner);
  assert(
    `Unable to set owner on ${object.toString()} from ${store.toString()}: owner is "${owner}"`,
    owner,
  );
  object.store = store;
};

export { configureOwner, configure };
