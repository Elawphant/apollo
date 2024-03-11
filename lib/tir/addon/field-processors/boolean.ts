import { FieldProcessor } from 'tir/field-processor';

export default class BooleanFieldProcessor extends FieldProcessor {
  /**
   * Serializes the data to ApolloModel data type
   * Use this method when encapsulating response data
   * Remove this method to bypass serialization
   *
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: transformed/encapsulated data
   */
  public serialize = (deserialized: any): boolean | null => {
    return deserialized ? Boolean(deserialized) : null;
  };
}
