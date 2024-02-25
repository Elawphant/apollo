import { configure } from "ember-apollo-data/utils";
import type { TirService } from "ember-apollo-data/";




class BaseType {
    declare readonly store: TirService;

    constructor(store: TirService){
        configure(store, this);
    }
}


export { BaseType };