'use strict';

const stringUtils = require('ember-cli-string-utils');
const { NAMING_CONVENTIONS } = require('../../addon/-private/globals');
const pluralize = require('pluralize');

module.exports = {
  description:
    'Generates default node and connection queries for given modelname',

  shouldTransformTypeScript: true,

  availableOptions: [
    {
      name: 'node',
      type: String,
      default: JSON.stringify({
        queryFields: 'id',
      }),
    },
    {
      name: 'connection',
      type: String,
      default: JSON.stringify({
        queryParamVars: `($first: 'Int', $last: 'Int', $before: 'String', $after: 'String', $offset: 'Int')`,
        queryParams: `(first: $first, last: $last, before: $before, after: $after, offset: $offset)`,
        queryFields: `
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor        
          }
        `,
      }),
    },
  ],

  locals(options) {
    const customNodeConfig = options.node ? JSON.parse(options.node) : {};
    const customConnectionConfig = options.node
      ? JSON.parse(options.connection)
      : {};
    console.log(customConnectionConfig);
    const rootFieldParts = options.entity.name.split('-');
    const pluralizedLastPart = pluralize(rootFieldParts.pop());
    const rootFieldName = stringUtils.camelize(
      [...rootFieldParts, pluralizedLastPart].join('-'),
    );
    return {
      node: {
        namingConventionForItem: NAMING_CONVENTIONS.item,
        ...customNodeConfig,
      },
      connection: {
        rootFieldName: rootFieldName,
        rootFieldName: rootFieldName,
        alias:
          rootFieldName +
          '__' +
          stringUtils.classify(options.entity.name) +
          NAMING_CONVENTIONS.set,
        connectionRoot: rootFieldName + 'Connection',
        ...customConnectionConfig,
      },
    };
  },
};
