import spawnAsync from '@expo/spawn-async';
import { appendFile, pathExists, readFile, writeFile } from 'fs-extra';
import os from 'os';
import path from 'path';

import EasCommand from '../../commandUtils/EasCommand';
import { EASNonInteractiveFlag } from '../../commandUtils/flags';
import Log from '../../log';
import { confirmAsync } from '../../prompts';

const ENVRC_TEMPLATE =
  'dotenv_if_exists .env;\ndotenv_if_exists .env.local;\ndotenv_if_exists .env.eas.local;\n';

export default class EnvironmentVariableInit extends EasCommand {
  static override description = 'setup environment variables';

  static override hidden = true;

  static override flags = {
    ...EASNonInteractiveFlag,
  };

  static override contextDefinition = {
    ...this.ContextOptions.ProjectDir,
  };

  async runAsync(): Promise<void> {
    const {
      flags: { 'non-interactive': nonInteractive },
    } = await this.parse(EnvironmentVariableInit);

    if (nonInteractive) {
      throw new Error("Non-interactive mode is not supported for 'eas env:init'");
    }

    const { projectDir } = await this.getContextAsync(EnvironmentVariableInit, {
      nonInteractive,
    });

    await this.ensureDirenvInstalledAsync(projectDir);
    await this.setupEnvrcFileAsync(projectDir);
    await this.addDirenvHookToShellConfigAsync();
    await this.addToGitIgnoreAsync(projectDir);
    Log.log('Running direnv allow...');
    await spawnAsync('direnv', ['allow'], { cwd: projectDir, stdio: 'inherit' });
  }

  private async addDirenvHookToShellConfigAsync(): Promise<void> {
    const direnvConfig = this.getShellDirenvConfig();

    if (direnvConfig && (await pathExists(direnvConfig.shellConfigPath))) {
      const { shellConfigPath, direnvHookCmd, direnvInitCmd } = direnvConfig;

      const confirm = await confirmAsync({
        message: `Do you want to add the direnv hook to ${shellConfigPath}?`,
      });

      if (!confirm) {
        Log.log('Skipping adding the direnv hook to the shell config');
        Log.log('You may need to add the direnv hook to your shell config manually.');
        Log.log('Learn more: https://direnv.net/docs/hook.html');
        return;
      }

      const configContent = await readFile(shellConfigPath, 'utf8');

      if (configContent.includes(direnvHookCmd)) {
        Log.log('The direnv hook is already present in the shell config');
        return;
      }

      await appendFile(shellConfigPath, `\n${direnvHookCmd}\n`, 'utf8');
      Log.log(`Added direnv hook to ${shellConfigPath}`);
      await spawnAsync(...direnvInitCmd);
    } else {
      Log.log("Unable to determine the user's shell");
      Log.log('You may need to add the direnv hook to your shell config manually.');
      Log.log('Learn more: https://direnv.net/docs/hook.html');
    }
  }

  private getShellDirenvConfig(): {
    shellConfigPath: string;
    direnvHookCmd: string;
    direnvInitCmd: [string, string[]];
  } | null {
    const shellEnv = process.env.SHELL;
    if (!shellEnv) {
      return null;
    }

    if (shellEnv.endsWith('bash')) {
      return {
        shellConfigPath: path.join(os.homedir(), '.bashrc'),
        direnvHookCmd: 'eval "$(direnv hook bash)"',
        direnvInitCmd: ['eval', ['"$(direnv hook bash)"']],
      };
    } else if (shellEnv.endsWith('zsh')) {
      return {
        shellConfigPath: path.join(os.homedir(), '.zshrc'),
        direnvHookCmd: 'eval "$(direnv hook zsh)"',
        direnvInitCmd: ['eval', ['"$(direnv hook zsh)"']],
      };
    } else if (shellEnv.endsWith('fish')) {
      return {
        shellConfigPath: path.join(os.homedir(), '.config/fish/config.fish'),
        direnvHookCmd: 'direnv hook fish | source',
        direnvInitCmd: ['eval', ['"$(direnv hook fish)"']],
      };
    } else {
      return null;
    }
  }

  private async addToGitIgnoreAsync(cwd: string): Promise<void> {
    const gitIgnorePath = path.resolve(cwd, '.gitignore');
    if (await pathExists(gitIgnorePath)) {
      const gitignoreContent = await readFile(gitIgnorePath, 'utf8');

      const filesToIgnore = ['.envrc', '.env.eas.local', '.env.eas.local.original'];
      const linesToAdd = filesToIgnore.filter(file => !gitignoreContent.includes(file));

      if (linesToAdd.length > 0) {
        const confirm = await confirmAsync({
          message: `Do you want to add ${linesToAdd.join(',')} to .gitignore?`,
        });
        if (confirm) {
          await appendFile(gitIgnorePath, linesToAdd.join('\n') + '\n', 'utf8');
          Log.log(`${linesToAdd.join(',')} added to .gitignore`);
        } else {
          Log.log('Skipping adding .envrc and .env.local to .gitignore');
        }
      } else {
        Log.log('.envrc and .env.local are already present in .gitignore');
      }
    }
  }

  private async setupEnvrcFileAsync(cwd: string): Promise<void> {
    const envrcPath = path.resolve(cwd, '.envrc');
    if (await pathExists(envrcPath)) {
      Log.log('.envrc file already exists');
      const envrcContent = await readFile(envrcPath, 'utf8');
      if (envrcContent.includes(ENVRC_TEMPLATE)) {
        Log.log('.envrc file is already set up');
        return;
      }

      const confirm = await confirmAsync({
        message: 'Do you want to modify the existing .envrc file?',
      });
      if (confirm) {
        Log.log('Modifying existing .envrc file...');
        await appendFile(envrcPath, ENVRC_TEMPLATE, 'utf8');
        Log.log('.envrc file modified');
      } else {
        Log.log('Skipping modifying .envrc file');
      }
    } else {
      Log.log('Creating .envrc file...');
      await writeFile(envrcPath, ENVRC_TEMPLATE, 'utf8');
      Log.log('.envrc file created');
    }
  }

  private async ensureDirenvInstalledAsync(cwd: string): Promise<void> {
    Log.log('Checking direnv installation...');
    try {
      await spawnAsync('direnv', ['--version']);
      Log.log('direnv is already installed');
    } catch {
      Log.log('direnv is not installed');
      const install = await confirmAsync({
        message: 'Do you want EAS CLI to install direnv for you?',
      });
      if (install) {
        await this.installDirenvAsync(cwd);
        Log.log('direnv installed');
      } else {
        Log.error("You'll need to install direnv manually");
        throw new Error('Aborting...');
      }
    }
  }

  private async installDirenvAsync(cwd: string): Promise<void> {
    const platform = os.platform();

    let installCommand;
    let installArgs;

    if (platform === 'darwin') {
      installCommand = 'brew';
      installArgs = ['install', 'direnv'];
    } else if (platform === 'linux') {
      const linuxDistribution = await spawnAsync('cat', ['/etc/os-release']);
      const stderr = linuxDistribution.stderr;
      if (stderr) {
        throw new Error(`Error reading OS release info: ${stderr}`);
      }

      const stdout = linuxDistribution.stdout;

      if (stdout.includes('Ubuntu') || stdout.includes('Debian')) {
        Log.log('Detected a Debian-based Linux distribution.');
        installCommand = 'sudo apt-get';
        installArgs = ['install', '-y', 'direnv'];
      } else if (stdout.includes('Fedora') || stdout.includes('CentOS')) {
        Log.log('Detected a Red Hat-based Linux distribution.');
        installCommand = 'sudo dnf';
        installArgs = ['install', '-y', 'direnv'];
      } else {
        throw new Error('Your Linux distribution is not supported by this script.');
      }
    } else {
      Log.log(`Your platform (${platform}) is not supported by this script.`);
    }

    if (!installCommand) {
      throw new Error('Failed to determine the installation command for direnv');
    }

    try {
      Log.log(`Running: ${installCommand}`);
      await spawnAsync(installCommand, installArgs, { stdio: 'inherit', cwd });
    } catch (error: any) {
      Log.error(`Failed to install direnv: ${error.message}`);
      throw error;
    }
  }
}
