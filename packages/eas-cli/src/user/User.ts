import { gql } from 'graphql-tag';

import * as Analytics from '../analytics/rudderstackClient.js';
import { api } from '../api.js';
import { graphqlClient } from '../graphql/client.js';
import { CurrentUserQuery } from '../graphql/generated.js';
import { UserQuery } from '../graphql/queries/UserQuery.js';
import { getAccessToken, getSessionSecret, setSessionAsync } from './sessionStorage.js';

// Re-export, but keep in separate file to avoid dependency cycle
export { getSessionSecret, getAccessToken };

export type Actor = NonNullable<CurrentUserQuery['meActor']>;

let currentUser: Actor | undefined;

/**
 * Resolve the name of the actor, either normal user or robot user.
 * This should be used whenever the "current user" needs to be displayed.
 * The display name CANNOT be used as project owner.
 */
export function getActorDisplayName(user?: Actor): string {
  switch (user?.__typename) {
    case 'User':
      return user.username;
    case 'Robot':
      return user.firstName ? `${user.firstName} (robot)` : 'robot';
    default:
      return 'anonymous';
  }
}

export async function getUserAsync(): Promise<Actor | undefined> {
  if (!currentUser && (getAccessToken() || getSessionSecret())) {
    const user = await UserQuery.currentUserAsync();
    currentUser = user ?? undefined;
    if (user) {
      await Analytics.setUserDataAsync(user.id, {
        username: getActorDisplayName(user),
        user_id: user.id,
        user_type: user.__typename,
      });
    }
  }
  return currentUser;
}

export async function loginAsync({
  username,
  password,
  otp,
}: {
  username: string;
  password: string;
  otp?: string;
}): Promise<void> {
  const body = await api.postAsync('auth/loginAsync', { body: { username, password, otp } });
  const { sessionSecret } = body.data;
  const result = await graphqlClient
    .query(
      gql`
        query UserQuery {
          viewer {
            id
            username
          }
        }
      `,
      {},
      {
        fetchOptions: {
          headers: {
            'expo-session': sessionSecret,
          },
        },
        additionalTypenames: [] /* UserQuery has immutable fields */,
      }
    )
    .toPromise();
  const { data } = result;
  await setSessionAsync({
    sessionSecret,
    userId: data.viewer.id,
    username: data.viewer.username,
    currentConnection: 'Username-Password-Authentication',
  });
}

export async function logoutAsync(): Promise<void> {
  currentUser = undefined;
  await setSessionAsync(undefined);
}
