import { action } from '@ember/object';
import Route from '@ember/routing/route';
import type Transition from '@ember/routing/transition';
import { service } from '@ember/service';
import type User from 'apollo/nodes/user';
import type { RootQueryDescription } from 'ember-apollo-data/-private/util';
import type { Node } from 'ember-apollo-data/model';
import type TirService from 'ember-apollo-data/services/ead-store';

export default class ApplicationRoute extends Route {
  @service('ead-store') declare store: TirService;

  model = async () => {
    const queryParams: RootQueryDescription = {
      type: 'connection',
      fields: ['email', 'entrepreneurships'],
      variables: {

      }
    };
    await this.store.query([
      {
        user: queryParams,
      },
    ]);
    const connection = this.store.connection('user', queryParams.variables!)
    return connection
  };
}
