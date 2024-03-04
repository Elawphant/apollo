import type { ClientId } from "ember-apollo-data/model/types";
import { ScalarRoot } from "./scalar-root";
import { FieldProcessor } from "ember-apollo-data/field-processor";
import type { RelationshipField } from "ember-apollo-data/model/field-mappings";
import type { InMemoryCache } from "./in-memory";



// TODO: implement getters and setters to update relation
class NodeRoot extends ScalarRoot<ClientId | null> {
    declare private parentClientId: ClientId

    declare private relationUpdater: InMemoryCache["updateRoot"];

    declare protected clientId: `${string}:${number}`;

    public get isRelation() {
        return Boolean(this.clientId);
    }


    // TODO: replace InMemoryCache["updateRoot"] with TirCache["updateRoot"] abstract method for compatibility improvement
    constructor(
        initial: ClientId | null,
        dataKey: RelationshipField["dataKey"],
        clientId: ClientId,
        relationUpdater: InMemoryCache["updateRoot"],
        processor?: FieldProcessor | undefined,
    ) {
        super(initial, dataKey, clientId, processor);
        this.relationUpdater = relationUpdater;
    };

    // TODO
    public set = (clientId: ClientId | null) => {
        this.value = clientId;
        // this.relationUpdater(this.clientId, this.dataKey, pod);
    };

    

}

export { NodeRoot };