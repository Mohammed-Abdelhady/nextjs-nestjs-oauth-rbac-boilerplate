/** `hidden` features are never offered; another feature pulls them in. */
export type FeatureKind =
  | 'credential'
  | 'oauth'
  | 'second-factor'
  | 'passwordless'
  | 'hidden';

export type FeatureStatus = 'available' | 'planned';

export interface Feature {
  label: string;
  description: string;
  kind: FeatureKind;
  default: boolean;
  files: string[];
  envVars: string[];
  requires: string[];
  docs: string[];
  /** Omitted means available. Planned features are never offered by the prompt. */
  status?: FeatureStatus;
}

export interface Manifest {
  features: Record<string, Feature>;
  core: {
    alwaysRemoveFiles: string[];
  };
}

export interface CliOptions {
  /** Target path as typed by the user, or undefined when it has to be prompted. */
  directory?: string;
  yes: boolean;
  features?: string[];
  install: boolean;
  git: boolean;
}

export interface DanglingReference {
  file: string;
  line: number;
  specifier: string;
  target: string;
}

export interface PruneResult {
  selected: string[];
  removed: string[];
  deletedFiles: string[];
  strippedEnvVars: string[];
  removedDocLines: number;
  /** Files a `feature:` marker was stripped from, or deleted lines out of. */
  markedFiles: string[];
  removedMarkedLines: number;
  dangling: DanglingReference[];
}
