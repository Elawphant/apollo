/**
 *
 */
export interface ApolloConfig {
  queryRootField: string;
  createRootField: string;
  updateRootField: string;
  deleteRootField: string;
  createInputTypeName: string;
  updateInputTypeName: string;
  deleteInputTypeName: string;

  keyArgs?: Record<string, string>;
  inputFieldName?: string;
}
