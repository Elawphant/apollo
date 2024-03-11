import Route from '@ember/routing/route';
import { service } from '@ember/service';
import type User from 'apollo/pods/user';
import type TirService from 'tir/services/tir';
import { gql } from 'graphql-request';

export default class ApplicationRoute extends Route {
  @service declare store: TirService;

  model = async () => {
    // const doc = gql`
    //   query Entreprenurships () {
    //     entrepreneurshipConnection__EntrepreneurshipStem {
    //       edges {
    //         node {
    //           name
    //           users__UserStem {
    //             edges {
    //               node {
    //                 email
    //               }
    //             }
    //           }
    //         }
    //       }
    //     }
    //   }
    // `;
    const user = this.store.create("user") as User
    return user;
  };
}
