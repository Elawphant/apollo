import FieldProcessor from 'tir/field-processor/field-processor';

export default class NumberFieldProcessor extends FieldProcessor {
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
