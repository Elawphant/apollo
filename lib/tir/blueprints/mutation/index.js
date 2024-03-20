'use strict';

module.exports = {
  description:
    'Generates a mutation file. If --contents is provided as string, also adds the contens to the file',

  shouldTransformTypeScript: true,

  availableOptions: [
    {
      name: 'contents',
      type: String,
      default: '',
    },
  ],

  locals(options) {
    return {
      contents: options.contents,
    };
  },
};
