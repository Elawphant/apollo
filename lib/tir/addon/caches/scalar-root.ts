import type TirService from 'tir/services/tir';
import type { FieldProcessor } from 'tir/field-processor';
import type {
  AttrField,
  RelationshipField,
} from 'tir/model/field-mappings';
import type { PodRegistry } from 'tir/model/registry';
import type { GraphQlErrorData, ClientId } from 'tir/model/types';
import { configure } from 'tir/utils';
import { tracked } from 'tracked-built-ins';

class ScalarRoot<T> {
  declare store: TirService;

  private declare loaded: boolean;

  /** dataKey on parent Pod */
  protected declare readonly dataKey: (
    | AttrField
    | RelationshipField
  )['dataKey'];

  /** Root's clientid: IMPORTANT! not to be confused with 'value' on NodeRoot */
  protected declare readonly clientId?: ClientId | undefined; // undefined only for root ConnectionRoot
  public declare readonly rootKey:
    | `${keyof PodRegistry}:${RelationshipField['dataKey']}:${ClientId}`
    | `${keyof PodRegistry}:${string}`;

  public declare initial: T;

  @tracked
  public declare value: T;

  private declare readonly processor?: FieldProcessor;

  private declare readonly errors: Set<GraphQlErrorData['message']>;

  constructor(
    store: TirService,
    initial: T,
    modelName: keyof PodRegistry,
    dataKey: (AttrField | RelationshipField)['dataKey'] | string,
    clientId?: ClientId,
    processor?: FieldProcessor,
  ) {
    configure(store, this);
    this.loaded = false;
    this.initial = initial;
    this.value = initial;
    this.processor = processor;
    this.dataKey = dataKey;
    this.clientId = clientId;
    this.rootKey = clientId
      ? `${modelName}:${dataKey}:${clientId}`
      : `${modelName}:${dataKey}`;
  }

  get isRelation() {
    return false;
  }

  /**
   *
   */
  public revert = () => {
    this.update(this.initial);
  };

  public get: () => T | null = () => {
    return this.value;
  }

  public set = (val: T) => {
    this.value = this.processor ? this.processor.process(val) : val;
  };

  /** Updates the state optionally updating the initial value and marking it as loaded */
  public update = (
    val: any,
    updateInitial: boolean = false,
    markLoaded: boolean = false,
  ) => {
    this.set(val);
    if (updateInitial) {
      this.initial = this.value;
    }
    if (markLoaded) {
      this.markLoaded();
    }
  };

  public markLoaded = () => {
    this.loaded = true;
  };

  get isLoaded() {
    return this.loaded;
  }

  addError = (message: GraphQlErrorData['message']) => {
    this.errors.add(message);
  };

  resetErrors = () => {
    this.errors.clear();
  };

  /**
   * When an inverse update occurs, this the inverse connection items are no more trusted.
   * isSettled property let's check whether an update would be approprate
   */
  get isSettled() {
    return this.initial === this.value;
  }
}

export { ScalarRoot };
