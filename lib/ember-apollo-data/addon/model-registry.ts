import EADModel from './model/node';

interface ModelRegistry {
  [modelName: string]: typeof EADModel;
}

export const modelRegistry: ModelRegistry = {};
