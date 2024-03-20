'use strict';

const { dasherize, camelize, classify } = require('ember-cli-string-utils');
const fs = require('fs-extra');
const path = require('path');
const { NAMING_CONVENTIONS } = require('../../addon/-private/globals');


module.exports = {
  description:
    'Analyses GraphQL introspection and creates available pods and GraphQL files.',

  shouldTransformTypeScript: true,

  availableOptions: [
    {
      // path to the introspection json file
      name: 'path',
      type: String,
      default: '',
    },
  ],

  locals(options) {
    return {
      contents: options.contents,
    };
  },


  read(path) {
    const schema = fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        throw err;
      };
      const modelNames = new Set()
      const configs = new Set();
      const types = schemaJson.data.__schema.types ?? [];
      const query = types.find(type => type.kind ==='OBJECT' && type.name === 'Query');
      const mutation = types.find(type => type.kind ==='OBJECT' && type.name === 'Mutation')
      if (query){
        query.fields.forEach(field => {
          if (!['id', 'node'].includes(field.name)){
            modelNames.add(field.name)
          }
        });
      };

      modelNames.forEach(modelName => {
        const TYPE = types.find(type => classify(modelName) === type.name);
        TYPE?.fields?.forEach(field => {
          if (field.type.ofType.kind === 'SCALAR') {
            podFields += `@attr() declare ${field.name}: ${
              ['String', 'Number', 'Boolean', 'Int', 'Float', 'Date']
              .includes(field.type.ofType.name)
                ? field.type.ofType.name 
                : 'unknown' 
            }\n`;
            defaultQueryFields += `${field.name}\n`;
          } else {
            if (field.type.name.includes('Connection')){
              
            }
            // Assuming it's a relation field
            const relationType = fieldType; // Simplification, real implementation might need more logic
            const dasherizedRelationType = dasherize(relationType);
            podFields += `@hasMany('${dasherizedRelationType}', { inverse: '${modelName}' }) declare ${field.name}: ConnectionRoot<${relationType}>\n`;
            // Queries might need adjustments for actual relation fields
          }

        })
      })


      if (types) {
        types.forEach((type) => {
          let podFields = '';
          let defaultQueryFields = '';
          


          type.fields.forEach(field => {
            const fieldType = type.kind === 'NON_NULL' ? type.ofType.name : type.name;
            if (['String', 'Int', 'Float', 'Boolean', 'ID', 'OBJECT'].includes(fieldType) && !field.name) {
              podFields += `@attr() declare ${field.name}: ${fieldType}\n`;
              defaultQueryFields += `${field.name}\n`;
            } else {
              // Assuming it's a relation field for simplicity
              const relationType = fieldType; // Simplification, real implementation might need more logic
              const dasherizedRelationType = dasherize(relationType);
              podFields += `@hasMany('${dasherizedRelationType}', { inverse: '${modelName}' }) declare ${field.name}: ConnectionRoot<${relationType}>\n`;
              // Queries might need adjustments for actual relation fields
            }

            const classifiedName = classify(name);
            const dasherizedName = dasherize(name);
            const camelizedName = dasherize(name);
            const config = {
              modelName: dasherizedName,
              podFields: [],
              defaultNodeQuery: `
                    query ${name}NodeQuery ($id: ID!) {
                      ${camelizedName}__${classifiedName}${NAMING_CONVENTIONS.item}: node (id: $id) {
                        ${fields.map(field => field.name).join('\n')}
                      }
                    }
                  `,
              defaultConnectionQuery: `
                    query ${classifiedName}ConnectionQuery
                  `

            }
            configs.add(config)
          });

        })
      }
    })
  }


};
