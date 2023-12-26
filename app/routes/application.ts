import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type User from 'apollo/nodes/user';
import type EADStoreService from 'ember-apollo-data/services/ead-store';

export default class ApplicationRoute extends Route {
  @service('ead-store') declare store: EADStoreService;

  model = async () => {
    const connection = this.store.connection('eshop', {});
    const newUser = this.store.create('user') as User;
    newUser.email = "info@mail.com";
    newUser.save()
    console.log(newUser)
    return connection;
  };
}
