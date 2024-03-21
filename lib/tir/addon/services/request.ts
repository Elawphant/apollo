import Service from '@ember/service';
// import RequestManager from '@ember-data/request';


// TODO: deprecate graphql-request in favor of own service using RequestManager from '@ember-data/request'
export default class Request extends Service.extend({
  // anything which *must* be merged to prototype here
}) {
  // normal class body definition here
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    request: Request;
  }
}
