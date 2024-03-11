

## Spec

All GraphQl Queries that the developer wants to be encapusalted into nodes and connections, must be aliased.
the alias must contain <typeName><Node|Connection> suffix; this should also apply to relations.
this queries to Node

e.g. 
```gql
query Operation {
    UserNode: user {
        __typename
        UserConnection: friends {
            edges {
                UserNode: node {
                    id
                    email
                }
            }
        }
    }
}