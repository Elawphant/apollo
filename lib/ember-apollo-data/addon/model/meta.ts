import type { ScalarTypeDefinitionNode, VariableDefinitionNode } from "graphql";

/**
 *
 */
export interface TypeConfig {
  nodeQueryField?: string;
  connectionQueryField?: string;
  createMutationField: string;
  updateMutationField: string;
  deleteMutationField: string;
  createInputTypeName: ScalarTypeDefinitionNode["name"]["value"];
  updateInputTypeName: ScalarTypeDefinitionNode["name"]["value"];
  deleteInputTypeName: ScalarTypeDefinitionNode["name"]["value"];

  operationVariables?: {
    [key: VariableDefinitionNode["variable"]["name"]["value"]]: ScalarTypeDefinitionNode["name"]["value"];
  };
  inputFieldName?: string;
}