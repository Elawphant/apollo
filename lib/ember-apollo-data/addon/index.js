// /your-addon/addon/index.js

import { join, basename, extname } from 'path';
import { readdirSync } from 'fs';

// Initialize the model registry
import { modelRegistry } from './model-registry';
import { transformRegistry } from './transform-registry';

// Define the path to the app's apollo-models folder
// const appModelsPath = join(__dirname, './app/ead-models');
// const appTransformsPath = join(__dirname, './app/ead-transforms');
// Read the contents of the apollo-models folder
const modelFiles = readdirSync(appModelsPath);
const transformFiles = readdirSync(appTransformsPath);

// Dynamically import and populate the model registry
modelFiles.forEach((file) => {
  if (file.endsWith('.js') || file.endsWith('.ts')) {
    const modelName = basename(file, extname(file));
    const modelClass = require(join(appModelsPath, file)).default;
    modelRegistry[modelName] = modelClass;
  }
});
// Dynamically import and populate the transform registry
transformFiles.forEach((file) => {
  if (file.endsWith('.js') || file.endsWith('.ts')) {
    const transformName = basename(file, extname(file));
    const transformClass = require(join(appTransformsPath, file)).default;
    transformRegistry[transformName] = transformClass;
  }
});

// Export the registries
export { modelRegistry, transformRegistry };
