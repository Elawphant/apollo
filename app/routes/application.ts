import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type User from 'apollo/nodes/user';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export default class ApplicationRoute extends Route {
  @service('ead-store') declare store: EADStoreService;

  model = async () => {
    const connection = this.store.connection('user', {});
    connection.afterLoading(() => {
      const newUser = this.store.node('user', { id: "VXNlcjpORDd3NEhiaTI3bkZGdTN5WmFMcmFx" }) as User;
      newUser.afterLoading(() => {
        console.log(newUser.email, "2")
        newUser.email = 'merimba@mail.com';
      })
      console.log(newUser.email, "3")
    })
    return connection;

  };

}
