import { FieldProcessor } from './index';

export type FieldProcessorRegistry = Record<string, typeof FieldProcessor>;
