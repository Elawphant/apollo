import type { FieldProcessor } from "ember-apollo-data/field-processor";
import type { AttrField, RelationshipField } from "ember-apollo-data/model/field-mappings";
import type { GraphQlErrorData, ClientId } from "ember-apollo-data/model/types";
import { tracked } from "tracked-built-ins";




class ScalarRoot<T> {
    declare private loaded: boolean;

    /** dataKey on parent Pod */
    declare protected readonly dataKey: (AttrField | RelationshipField)["dataKey"];
    declare protected readonly clientId?: ClientId | undefined; // undefined only for root ConnectionRoot

    declare public initial: T;

    @tracked
    declare public value: T;

    declare private readonly processor?: FieldProcessor;

    declare private readonly errors: Set<GraphQlErrorData["message"]>;

    constructor(initial: T, dataKey: (AttrField | RelationshipField)["dataKey"] | string, clientId?: ClientId, processor?: FieldProcessor) 
    {
        this.loaded = false;
        this.initial = initial;
        this.value = initial;
        this.processor = processor;
        this.dataKey = dataKey;
        this.clientId = clientId;
    };

    get isRelation(){
        return false;
    }

    public revert = () => {
        this.update(this.initial);
    };

    public set = (val: T) => {
        this.value = this.processor ? this.processor.process(val) : val;
    };

    /** Updates the state optionally updating the initial value and marking it as loaded */
    public update = (val: any, updateInitial: boolean = false, markLoaded: boolean = false) => {
        this.set(val);
        if (updateInitial){
            this.initial = this.value;
        };
        if (markLoaded) {
            this.markLoaded();
        };
    };

    public markLoaded = () => {
        this.loaded = true;
    };

    get isLoaded() {
        return this.loaded;
    };

    addError = (message: GraphQlErrorData["message"]) => {
        this.errors.add(message);
    };

    resetErrors = () => {
        this.errors.clear();
    }
};

export { ScalarRoot };