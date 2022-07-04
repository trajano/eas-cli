import { gql } from 'graphql-tag';

import { graphqlClient, withErrorHandlingAsync } from '../client.js';
import { CurrentUserQuery } from '../generated.js';

export const UserQuery = {
  async currentUserAsync(): Promise<CurrentUserQuery['meActor']> {
    const data = await withErrorHandlingAsync(
      graphqlClient
        .query<CurrentUserQuery>(
          gql`
            query CurrentUser {
              meActor {
                __typename
                id
                ... on User {
                  username
                }
                ... on Robot {
                  firstName
                }
                accounts {
                  id
                  name
                }
                isExpoAdmin
              }
            }
          `,
          /* variables */ undefined,
          {
            additionalTypenames: ['User'],
          }
        )
        .toPromise()
    );

    return data.meActor;
  },
};
