import Client from 'ember-apollo-data/client';

export default class ApplicationClient extends Client {
  public get endpoint(): string {
    return 'http://127.0.0.1:8000/graphql_dashboard_v1';
  } 
}
