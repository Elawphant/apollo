import type { Node } from 'ember-apollo-data/model';
import { FieldProcessor } from 'ember-apollo-data/field-processor';

export default class DefaultNodeRelationFieldProcessor extends FieldProcessor {
  serialize = (deserialized: Node) => {
    return deserialized.id;
  };
}
