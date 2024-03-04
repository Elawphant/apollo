declare module 'ember-apollo-data/' {
  import TirService from 'ember-apollo-data/services/tir';
  import { NodePod } from 'ember-apollo-data/model/node-pod';
  import FieldProcessor from 'ember-apollo-data/field-processor/field-processor';

  export { TirService, NodePod, FieldProcessor };
}
