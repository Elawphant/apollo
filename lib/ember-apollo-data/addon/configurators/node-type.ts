import type { Node } from 'ember-apollo-data/model';

export function configureModelConstructor(
  shimInstance: Node,
  modelName: string,
): typeof Node {
  const constructor = shimInstance.constructor as typeof Node;
  constructor.modelName = modelName;

  // set Meta and let model constructor handle the rest via getters
  // this line is important.
  constructor.Meta = shimInstance.constructor.prototype.Meta;

  return constructor;
}
