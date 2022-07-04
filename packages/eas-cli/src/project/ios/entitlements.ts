import ConfigPlugins from '@expo/config-plugins';
import { JSONObject } from '@expo/json-file';
import PrebuildConfig from '@expo/prebuild-config';

import { readPlistAsync } from '../../utils/plist.js';

const {
  IOSConfig,
  // eslint-disable-next-line async-protect/async-suffix
  compileModsAsync,
} = ConfigPlugins;
const {
  // eslint-disable-next-line async-protect/async-suffix
  getPrebuildConfigAsync,
} = PrebuildConfig;

interface Target {
  buildConfiguration?: string;
  targetName: string;
}

export async function getManagedApplicationTargetEntitlementsAsync(
  projectDir: string,
  env: Record<string, string>
): Promise<JSONObject> {
  const originalProcessEnv: NodeJS.ProcessEnv = process.env;
  try {
    process.env = {
      ...process.env,
      ...env,
    };
    const { exp } = await getPrebuildConfigAsync(projectDir, { platforms: ['ios'] });

    const expWithMods = await compileModsAsync(exp, {
      projectRoot: projectDir,
      platforms: ['ios'],
      introspect: true,
    });
    return expWithMods.ios?.entitlements || {};
  } finally {
    process.env = originalProcessEnv;
  }
}

export async function getNativeTargetEntitlementsAsync(
  projectDir: string,
  target: Target
): Promise<JSONObject | null> {
  const entitlementsPath = IOSConfig.Entitlements.getEntitlementsPath(projectDir, target);
  if (entitlementsPath) {
    const plist = await readPlistAsync(entitlementsPath);
    return plist ? (plist as unknown as JSONObject) : null;
  } else {
    return null;
  }
}
