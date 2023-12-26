import EmberApolloDataTransorm from 'ember-apollo-data/transform/transform';

export default class StringTransform extends EmberApolloDataTransorm {
  /**
   * Serializes the data to ApolloModel data type
   * Use this method when encapsulating response data
   * Remove this method to bypass serialization
   *
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: transformed/encapsulated data
   */
  serialize = (deserialized: any): string | null => {
    return deserialized ? String(deserialized) : null;
  };
}
