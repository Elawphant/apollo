'use strict';

// type FieldOption = {
//   propertyName: string;
//   dataKey?: string;
// } & (
//   | {
//       propertyType: 'attr';
//       valueType: string;
//     }
//   | {
//       propertyType: 'belongsTo' | 'hasMany';
//       modelName: string;
//       inverse: string;
//     }
// );

module.exports = {
  description: 'Generates a Pod',

  shouldTransformTypeScript: true,

  availableOptions: [
    {
      name: 'fields',
      type: String,
      default: '[]',
    },
  ],

  locals(options) {
    let fieldsArray = [];
    try {
      // Ensure that a JSON string of fields array is parsed correctly
      fieldsArray = JSON.parse(options.fields);
      if (!Array.isArray(fieldsArray)) {
        throw new Error(
          `Option "--fields" must be a stringified array of field configuration object.`,
        );
      }
    } catch (e) {
      throw e;
    }

    const fields = fieldsArray
      .map((field) => {
        if (field.propertyType === 'attr') {
          return `  @attr() ${field.propertyName}: ${field.valueType};`;
        } else {
          return `  @${field.propertyType}('${field.modelName}', { inverse: ${field.inverse}, }) ${field.propertyName}: ${field.modelName};`;
        }
      })
      .join('\n');
    return {
      fields: fields,
    };
  },
};
