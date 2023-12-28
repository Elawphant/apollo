declare module 'ember-apollo-data/' {
  import EADStoreService from 'ember-apollo-data/services/ead-store-urql';
  import EADModel from 'ember-apollo-data/model/node';
  import EADTransform from 'ember-apollo-data/field-processor/field-processor';

  export { EADStoreService, EADModel, EADTransform };
}
