# Naming Conventions

- [Naming Conventions](#naming-conventions)
  - [Introduction](#introduction)
  - [Aliases](#aliases)
    - [Nodes](#nodes)
    - [Connections](#connections)
    - [Identifier fields](#identifier-fields)
  - [The logic behind the naming convention](#the-logic-behind-the-naming-convention)
  - [Queries and Mutations](#queries-and-mutations)

## Introduction

Tir offers encapsulation layer via Pod and Stem classes, as well as encapsulatable roots on them

The develper can opt to use the encapsulation layer where necessary, or deal with the fetched raw data without encapsulation.
This helps better manage what data is encapsulated, and what data is just a one time data, e.g. a token once retrieved and used to set headers.

To support this the client introduces a GraphQL Aliases naming convention.

## Aliases

- [Naming Conventions](#naming-conventions)
  - [Introduction](#introduction)
  - [Aliases](#aliases)
    - [Nodes](#nodes)
    - [Connections](#connections)
    - [Identifier fields](#identifier-fields)
  - [The logic behind the naming convention](#the-logic-behind-the-naming-convention)
  - [Queries and Mutations](#queries-and-mutations)

### Nodes

A node encapsualtes into a Pod subclass. For thet purpose, in the GraphQl document the root/field on any level (top or field) should use the following naming convention, in order the encapuslation takes place:

- it must start with camelcase rootField name, followed by
- a double underscore "__", followed by
- PascalCase modelName of the Pod subclass, followed by
- word "Pod", followed by
- any string (optional)
  
E.g. `userNode__UserPod` or `user__UserPod01`.

Internally the cache uses regex to capture the parts in the alias and infer the Pod subclass with the root field to associate and dedeuplicate data for.

BelonsgTo relations will also be encapsulated into NodeRoot.

### Connections

A connection encapsualtes into a ConnectionRoot. For thet purpose, in the GraphQl document the root/field on any level (top or field) should use the following naming convention, in order the encapuslation takes place:

- it must start with camelcase rootField name, followed by
- a double underscore "__", followed by
- PascalCase modelName of the Pod subclass, followed by
- word "Stem", followed by
- any string (optional)
  
E.g. `usersConnection__UserStem` or `users__UserStem01`.

The `node` field inside a connection query edge **MUST NOT** be aliased. Instead, if the developer for some hypothetical purpose wants GrapqhQL query result to inlcude the node twice in the edge or not encapsulated, an alias not conforming to Tir naming conventions should be used for non encapsulatable node, e.g.

```GraphQL
# ...
{
    edges {
        User: node {
            data_that_does_not_need_encapsulation
        }
    }
    cursor
}
```

### Identifier fields

Tir supports custom identifier fields, not only id.
Importantly, identifier fields are only attribute fields, relations cannot be identifier fields.

If an identifier field is somehow aliased in GrpahQL query document, this alias should be consistently used accross all GrpahQL queries for same type and be set as "dataKey" on the `attr` field on the Pod subclass.

## The logic behind the naming convention

Tir is built arround separation of GraphQL types from pods. The type system on the server side might be different from the pod system on the client side: this gives the benefit of, inter alia, changing GraphQL query documents without need to change the models if the fields change on the server, or have a pod to encapsulate different GraphQL types.

For that purpose Tir avoids inferring Pods and roots from GraphQL convention and instead adds own convention on top of it.

`Node` and `Connection` are naming conventions of GraphQL and Relay, by default Tir does not use them in its own naming conventions to avoid confusion, so a developer can use both conventions.

So in the following hypothetical example two connections are being queried. Both use the relay convention of appending Connection to the fieldName, however, the first one will not be encapsulated but will be returned as raw data, while the second one will result in encapsulated ConnectionRoot and associated Post pods.

```GraphQL
query Posts ($isPublished:Boolean, $isInTop: Boolean) {
    postsConnection: articles (isPublished: $isPublished) {
        edges {
            node {
                name
                age
            }
        }
    }
    # this will be encapsualted into top level ConnectionRoot
    postsConnection__PostStem: articles (isInTop: $isInTop) {
        edges {
            node {
                id
                name
                age
                # this will be encapsualted into NodeRoot and Author pod subclass
                mainAuthor__AuthorPod: mainAuthor {
                    name
                }
            }
        }
    }
}
```

The developer can also opt to use other words instead of `Pod` and `Stem` by configuring `item` and `set` in the environment variables of the ember app, e.g.

```ts
ENV = {
    Tir: {
        namingConventions: {
            item: "Node", // now instead of user__UserPod the naming convention is changed to user__UserNode
            set: "Connection" // now instead of users__UserStem the naming convention is changed to users__UserConnection
        }
    }
}

```

## Queries and Mutations

Tir will use naming conventions for automatic query generation and usage, e.g. the `ConnectionRoot<Post>.query` method will lookup for a graphql document in the graphql folder of the ember app for a GraphQL file named `post-connection-query.graphql`, while `NodeRoot<Post>.query` will lookup for a graphql document named `post-node-query.grapqhl`.

Similarly, the `Pod.save` method will look for `create-post-node-mutation.graphql`, `update-post-node-mutation.graphql`, `delete-post-node-mutation.graphql` documents.

**IMPORTANT**!!! The mutation operation name of the mutation must respectively include "Create", "Update" or "Delete" words.

These files will be autogenerated from blueprints during introspection parsing or via manual blueprint run after Post pod is declared.

See more on this in docs related to Pod.
