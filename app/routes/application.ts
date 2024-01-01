import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type User from 'apollo/nodes/user';
import type { Node } from 'ember-apollo-data/model';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export default class ApplicationRoute extends Route {
  @service('ead-store') declare store: EADStoreService;

  model = async () => {
    const connection = this.store.connection('user', {});
    connection.afterQuery(() => {
      const newUser = this.store.node('user', { id: "VXNlcjpORDd3NEhiaTI3bkZGdTN5WmFMcmFx"}) as any;
      newUser.email = 'merimba@mail.com';
    })
    return connection;

  };

}
