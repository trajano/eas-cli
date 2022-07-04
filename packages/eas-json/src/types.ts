import { EasJsonBuildProfile } from './build/types.js';
import { EasJsonSubmitProfile } from './submit/types.js';

export type ProfileType = 'build' | 'submit';
export type EasJsonProfile<T extends ProfileType> = T extends 'build'
  ? EasJsonBuildProfile
  : EasJsonSubmitProfile;

export enum CredentialsSource {
  LOCAL = 'local',
  REMOTE = 'remote',
}

export interface EasJson {
  cli?: {
    version?: string;
    requireCommit?: boolean;
  };
  build?: { [profileName: string]: EasJsonBuildProfile };
  submit?: { [profileName: string]: EasJsonSubmitProfile };
}
