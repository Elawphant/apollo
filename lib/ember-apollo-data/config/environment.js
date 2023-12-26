'use strict';

module.exports = function (environment /** appConfig */) {
  let ENV = {
    'ember-apollo-data': {
      apiURL: 'http://127.0.0.1:8000/graphql_dashboard_v1',
    },
  };
  if (environment === 'development') {
  }
  return ENV;
};
