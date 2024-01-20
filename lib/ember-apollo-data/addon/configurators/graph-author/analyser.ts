import type { Node } from 'ember-apollo-data/model';
import type { RelationshipField } from 'ember-apollo-data/model/field-mappings';

/**
 * Analyzes dotted relations into NodeType and returns the NodeType that will require variable configuration
 * E.g. 'friends.crush.mutualFriends' will become Friend NodeType
 * The function will retrieve the ParentNodeType using modelFor and parentModelName;
 * then it will split the dottedString and for each splitted string in the array, it will access the
 */
export function analyze(
  modelFor: (modelName: string) => typeof Node,
  parentModelName: string,
  relationsSequence: string[],
) {
  const NodeType = modelFor(parentModelName)!;
  return relationsSequence.reduce((PreviousNodeType, currentField) => {
    return modelFor(
      (PreviousNodeType.Meta[currentField]! as RelationshipField).modelName,
    );
  }, NodeType);
}
