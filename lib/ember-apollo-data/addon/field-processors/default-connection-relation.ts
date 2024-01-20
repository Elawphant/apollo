import { Connection } from 'ember-apollo-data/model';
import { FieldProcessor } from 'ember-apollo-data/field-processor';

export default class DefaultConnectionRelationFieldProcessor extends FieldProcessor {
  serialize = (deserialized: Connection) => {
    throw new Error(`
      DefaultConnectionRelationTransform does not provide any default way to serialize connections, 
      because there is no convention about its implementation in the spec. 
      Create a "DefaultConnectionRelationTransform" with serialize method to overwrite this error and 
      implement default behavior for all connection relations or create a separate Transform for 
      ${deserialized.parentNode} and assign it to ${deserialized.fieldNameOnParent} on 
      "${deserialized.parentNode?.constructor.name} Node" .
    `);
  };
}
