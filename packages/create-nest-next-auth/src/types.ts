/** `hidden` features are never offered; another feature pulls them in. */
export type FeatureKind = 'credential' | 'oauth' | 'second-factor' | 'passwordless' | 'hidden';

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
  /** When present, the feature only applies to projects with one of these targets. */
  targets?: string[];
}

/** What a target pulls in: shared modules and, for convenience, other targets. */
export interface TargetRequires {
  shared: string[];
  targets: string[];
}

export interface Target {
  label: string;
  default: boolean;
  files: string[];
  workspaces: string[];
  envFiles: string[];
  requires: TargetRequires;
  /** A mobile shell still needs the browser sign-in pages to authenticate. */
  needsSignInSite?: boolean;
  status?: FeatureStatus;
}

export interface SharedModule {
  files: string[];
  workspaces: string[];
}

export interface Database {
  label: string;
  default: boolean;
  files: string[];
  envVars: string[];
  composeServices: string[];
  status?: FeatureStatus;
}

/** Catalogue keys an option owns, removed from that catalogue when it is off. */
export interface CatalogueKeyRule {
  path: string;
  keys: string[];
}

export interface ProjectOption {
  label: string;
  default: boolean;
  files: string[];
  requires: string[];
  docs: string[];
  catalogueKeys: CatalogueKeyRule[];
  status?: FeatureStatus;
}

/** A preset either lists ids or names the available/default ones to resolve later. */
export type PresetValue = string[] | 'available' | 'defaults';

export interface Preset {
  targets: PresetValue;
  features: PresetValue;
  options: PresetValue;
}

export interface Manifest {
  /** 2 for the dimension-aware manifest; a 1 (or unversioned) file loads as web + mongodb. */
  version: number;
  features: Record<string, Feature>;
  targets: Record<string, Target>;
  shared: Record<string, SharedModule>;
  databases: Record<string, Database>;
  options: Record<string, ProjectOption>;
  presets: Record<string, Preset>;
  core: {
    alwaysRemoveFiles: string[];
  };
}

export interface CliOptions {
  /** Target path as typed by the user, or undefined when it has to be prompted. */
  directory?: string;
  yes: boolean;
  features?: string[];
  targets?: string[];
  databases?: string[];
  preset?: string;
  config?: string;
  dryRun: boolean;
  locales?: string[];
  /** Explicit option ids mapped to on/off, from `--no-docker` and friends. */
  optionOverrides: Partial<Record<string, boolean>>;
  install: boolean;
  git: boolean;
}

export interface DanglingReference {
  file: string;
  line: number;
  specifier: string;
  target: string;
  /** Set when the reference is a package.json script, not an import. */
  script?: string;
}

export interface PruneResult {
  selected: string[];
  removed: string[];
  removedOptions: string[];
  deletedFiles: string[];
  strippedEnvVars: string[];
  removedDocLines: number;
  /** Files a `feature:` marker was stripped from, or deleted lines out of. */
  markedFiles: string[];
  removedMarkedLines: number;
  /** Changed files the pruner reformatted with the project's prettier config. */
  formattedFiles: string[];
  dangling: DanglingReference[];
}
