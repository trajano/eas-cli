import { AppleTeamFragment } from '../../../graphql/generated.js';
import { CredentialsContext } from '../../context.js';
import { AppLookupParams } from '../api/GraphqlClient.js';

export async function resolveAppleTeamIfAuthenticatedAsync(
  ctx: CredentialsContext,
  app: AppLookupParams
): Promise<AppleTeamFragment | null> {
  if (!ctx.appStore.authCtx) {
    return null;
  }
  return await ctx.ios.createOrGetExistingAppleTeamAsync(app.account, {
    appleTeamIdentifier: ctx.appStore.authCtx.team.id,
    appleTeamName: ctx.appStore.authCtx.team.name,
  });
}

export function formatAppleTeam({ appleTeamIdentifier, appleTeamName }: AppleTeamFragment): string {
  return `Team ID: ${appleTeamIdentifier}${appleTeamName ? `, Team name: ${appleTeamName}` : ''}`;
}
