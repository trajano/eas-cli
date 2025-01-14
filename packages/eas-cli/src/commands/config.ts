import { getProjectConfigDescription } from '@expo/config';
import { Platform } from '@expo/eas-build-job';
import { EasJsonAccessor, EasJsonUtils } from '@expo/eas-json';
import { Flags } from '@oclif/core';
import chalk from 'chalk';

import { evaluateConfigWithEnvVarsAsync } from '../build/evaluateConfigWithEnvVarsAsync';
import EasCommand from '../commandUtils/EasCommand';
import { createGraphqlClient } from '../commandUtils/context/contextUtils/createGraphqlClient';
import { EASEnvironmentFlagHidden, EasNonInteractiveAndJsonFlags } from '../commandUtils/flags';
import { toAppPlatform } from '../graphql/types/AppPlatform';
import Log from '../log';
import { appPlatformEmojis } from '../platform';
import { selectAsync } from '../prompts';
import { enableJsonOutput, printJsonOnlyOutput } from '../utils/json';

export default class Config extends EasCommand {
  static override description = 'display project configuration (app.json + eas.json)';

  static override flags = {
    platform: Flags.enum<Platform>({ char: 'p', options: [Platform.ANDROID, Platform.IOS] }),
    profile: Flags.string({
      char: 'e',
      description:
        'Name of the build profile from eas.json. Defaults to "production" if defined in eas.json.',
      helpValue: 'PROFILE_NAME',
    }),
    // This option is used only on EAS Build worker to read build profile from eas.json.
    'eas-json-only': Flags.boolean({
      hidden: true,
    }),
    ...EASEnvironmentFlagHidden,
    ...EasNonInteractiveAndJsonFlags,
  };

  static override contextDefinition = {
    ...this.ContextOptions.DynamicProjectConfig,
    ...this.ContextOptions.ProjectDir,
    ...this.ContextOptions.SessionManagment,
  };

  async runAsync(): Promise<void> {
    const { flags } = await this.parse(Config);
    if (flags.json) {
      enableJsonOutput();
    }
    const {
      platform: maybePlatform,
      profile: maybeProfile,
      'non-interactive': nonInteractive,
    } = flags;
    const { getDynamicPublicProjectConfigAsync, projectDir, sessionManager } =
      await this.getContextAsync(Config, {
        nonInteractive,
      });

    const accessor = EasJsonAccessor.fromProjectPath(projectDir);
    const profileName =
      maybeProfile ??
      (await selectAsync(
        'Select build profile',
        (await EasJsonUtils.getBuildProfileNamesAsync(accessor)).map(profileName => ({
          title: profileName,
          value: profileName,
        }))
      ));
    const platform =
      maybePlatform ??
      (await selectAsync('Select platform', [
        {
          title: 'Android',
          value: Platform.ANDROID,
        },
        {
          title: 'iOS',
          value: Platform.IOS,
        },
      ]));

    const profile = await EasJsonUtils.getBuildProfileAsync(accessor, platform, profileName);
    if (flags['eas-json-only']) {
      if (flags.json) {
        printJsonOnlyOutput({ buildProfile: profile });
      } else {
        const appPlatform = toAppPlatform(platform);
        const platformEmoji = appPlatformEmojis[appPlatform];
        Log.log(`${platformEmoji} ${chalk.bold(`Build profile "${profileName}"`)}`);
        Log.newLine();
        Log.log(JSON.stringify(profile, null, 2));
      }
    } else {
      const { authenticationInfo } = await sessionManager.ensureLoggedInAsync({
        nonInteractive,
      });
      const graphqlClient = createGraphqlClient(authenticationInfo);
      const { exp: appConfig } = await evaluateConfigWithEnvVarsAsync({
        flags,
        buildProfile: profile,
        graphqlClient,
        getProjectConfig: getDynamicPublicProjectConfigAsync,
        opts: { env: profile.env },
      });

      if (flags.json) {
        printJsonOnlyOutput({ buildProfile: profile, appConfig });
      } else {
        Log.addNewLineIfNone();
        Log.log(chalk.bold(getProjectConfigDescription(projectDir)));
        Log.newLine();
        Log.log(JSON.stringify(appConfig, null, 2));
        Log.newLine();
        Log.newLine();
        const appPlatform = toAppPlatform(platform);
        const platformEmoji = appPlatformEmojis[appPlatform];
        Log.log(`${platformEmoji} ${chalk.bold(`Build profile "${profileName}"`)}`);
        Log.newLine();
        Log.log(JSON.stringify(profile, null, 2));
      }
    }
  }
}
