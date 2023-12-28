
import FieldProcessor from 'ember-apollo-data/field-processor';


export default class <%= classifiedModuleName %>FieldProcessor extends FieldProcessor {

  /**
   * Serializes the data to ApolloModel data type
   * Use this method when encapsulating response data
   * Remove this method to bypass serialization
   * 
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: transformed/encapsulated data
   */
  serialize = (deserialized: any): any => {
    
  }

  /**
   * Deserializes the encapsulated data to simple data
   * Use this method when encapsulating response data
   * Remove this method to bypass deserialization 
   * 
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: serialized value
   */
  deserialize = (serialized: any): any => {

  }

}
