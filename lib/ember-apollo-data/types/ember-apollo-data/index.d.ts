declare module 'ember-apollo-data/' {
  import TirService from 'ember-apollo-data/services/tir';
  import EADModel from 'ember-apollo-data/model/node';
  import EADTransform from 'ember-apollo-data/field-processor/field-processor';

  export { TirService, EADModel, EADTransform };
}
