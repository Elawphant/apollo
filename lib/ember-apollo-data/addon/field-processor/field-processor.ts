import type Owner from '@ember/owner';
import { setOwner } from '@ember/application';
import type { TirService } from 'ember-apollo-data/';
import { configure } from 'ember-apollo-data/utils';

/**
 * All transforms of EmberApolloDataModels must extend EmberApolloDataTransform, e.g.
 * ```
 * class Mytransform extends EmberApolloDataTransform {
 *  // serialization and deserialization methods
 * }
 * ```
 * Models extending EmberApolloDataModel initialize EmberApolloDataTransforms with owner,
 * which means you can inject services and other dependencies into encapsulator objects, e.g.
 * ```
 * class Person {
 *  @service declare apolloDataStore: ApolloDataStore;
 *  @service declare session: SessionStore;
 *
 *  constructor(owner, data) {
 *    setOwner(this, owner);
 *    // data assignment
 *  }
 * }
 * ```
 * than in Mytransform
 * ```
 * // ...
 * serialize = (deserialized: any) => {
 *  return new Person(getOwner(this), deserialized);
 * }
 * //...
 * ```
 * Now Person has access to the apolloDataStore and session services.
 */
export default class FieldProcessor {

  public declare store: TirService;
  
  constructor(store: TirService) {
    configure(store, this);
  }

  /**
   * Serializes the data to Node field data type
   * Use this method when encapsulating response data
   * If not overwritten will return the data as is
   * @param { any } deserialized: non-serialized data received from server
   * @returns { any }: transformed/encapsulated data
   */
  serialize = (deserialized: any): any => {
    return deserialized;
  };

  /**
   * Deserializes the encapsulated data to simple data
   * Use this method when decapsulating request data
   * If not overwritten will return the data as is
   * @param {any} serialized : non-serialized data received from server
   * @returns {any} : serialized value
   */
  deserialize = (serialized: any): any => {
    return serialized;
  };
}
