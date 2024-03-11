
import { FieldProcessor } from 'tir/field-processor';


export default class <%= classifiedModuleName %> FieldProcessor extends FieldProcessor {

  /**
   * Serializes the data to ApolloModel data type
   * Use this method when encapsulating response data
   * IMPORTANT! You must either return the serialized data or return a call to "this.process" 
   * Remove this method to bypass serialization
   */
  public serialize = (deserialized: any): any => {
    return this.process(deserialized);
  }

  /**
   * Deserializes the encapsulated data to simple data
   * Use this method when encapsulating response data
   * Remove this method to bypass deserialization 
   */
  public deserialize = (serialized: any): any => {
    return serialized;
  }

  /**
   * Is called in the store for attr fields with processors enabled during value assignemnt.
   */
  public process = (value: any) => {
    return value;
  }

}
