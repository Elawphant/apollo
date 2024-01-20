import { action } from '@ember/object';
import Route from '@ember/routing/route';
import type Transition from '@ember/routing/transition';
import { service } from '@ember/service';
import type User from 'apollo/nodes/user';
import type { Node } from 'ember-apollo-data/model';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export default class ApplicationRoute extends Route {
  @service('ead-store') declare store: EADStoreService;

  model = async () => {
    this.store.query([
      {
        user: {
          type: 'node',
          fields: ['email', 'entrepreneurships'],
          variables: {
            id: 'VXNlcjpORDd3NEhiaTI3bkZGdTN5WmFMcmFx',
          },
        },
      },
    ]) as any;
  };
}
