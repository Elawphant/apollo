import type { ClientId, Pod } from 'tir/model/types';
import { ScalarRoot } from './scalar-root';

class NodeRoot<T extends Pod> extends ScalarRoot<ClientId | null> {
  private declare parentClientId: ClientId;

  protected declare clientId: `${string}:${number}`;

  public get isRelation() {
    return this.clientId !== undefined;
  }

  public set = (clientId: ClientId | null) => {
    this.update(clientId, false, false);
  };

  public getPod: (index: number) => Pod | null = (index: number) => {
    return this.value ? this.store.getPodByClientId(this.value) ?? null : null;
  };

  public update = (
    clientId: ClientId | null,
    updateInitial?: boolean,
    markLoaded?: boolean,
  ) => {
    this.value = clientId;
    if (updateInitial) {
      if (clientId) {
        this.store.registerBond(clientId, this.rootKey, updateInitial);
      } else if (this.initial) {
        this.store.unregisterBond(this.initial, updateInitial);
      }
      this.initial = this.value;
    }
    if (markLoaded) {
      this.markLoaded();
    }
  };
}

export { NodeRoot };
