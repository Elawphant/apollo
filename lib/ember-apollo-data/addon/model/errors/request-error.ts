import { GraphQLError } from "graphql";




export class RequestError extends GraphQLError {
    name = "GrpahQLRequestError";
}