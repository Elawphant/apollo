import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import type TirService from 'ember-apollo-data/services/tir';

export default class ApplicationRoute extends Route {
  @service('tir') declare store: TirService;

  model = async () => {
    const queryParams: RootQueryDescription = {
      type: 'connection',
      fields: ['email', 'entrepreneurships'],
      variables: {

      }
    };
    const connection = this.store.request('user', queryParams.variables!)
    return connection
  };
}
