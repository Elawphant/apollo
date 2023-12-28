import { type FieldProcessor } from "./index";


export interface FieldProcessorRegistryInterface {
  [fieldProcessorName: string]: typeof FieldProcessor;
}

export const FieldProcessorRegistry: FieldProcessorRegistryInterface = {};
