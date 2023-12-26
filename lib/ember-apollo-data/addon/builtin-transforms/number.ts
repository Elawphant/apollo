import Transform from 'ember-apollo-data/transform/transform';

export default class NumberTransform extends Transform {
  /**
   * Serializes the data to ApolloModel data type
   * Use this method when encapsulating response data
   * Remove this method to bypass serialization
   *
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: transformed/encapsulated data
   */
  serialize = (deserialized: any): number | null => {
    return deserialized ? Number(deserialized) : null;
  };
}
