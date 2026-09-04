import type { FeatureKind } from '../types.js';

export const CLI_NAME = 'create-nest-next-auth';

export const MANIFEST_FILE = 'template.manifest.json';

export const TEMPLATE_DIR_NAME = 'template';

/** Env example files the pruner edits, relative to a generated project. */
export const ENV_EXAMPLE_FILES = [
  'backend/.env.example',
  '.env.docker.example',
  'frontend/.env.example',
] as const;

/** Env var written into backend/.env.example with the enabled feature ids. */
export const FEATURE_FLAG_VAR = 'AUTH_FEATURES';

/** Names npm strips from a tarball. sync-template.mjs writes the left side. */
export const RESTORED_FILENAMES: Record<string, string> = {
  _gitignore: '.gitignore',
  _npmrc: '.npmrc',
  '_package-lock.json': 'package-lock.json',
};

export const FEATURE_KIND_ORDER: FeatureKind[] = [
  'credential',
  'oauth',
  'passwordless',
  'second-factor',
];

export const FEATURE_KIND_LABELS: Record<FeatureKind, string> = {
  credential: 'Credentials',
  oauth: 'OAuth providers',
  passwordless: 'Passwordless',
  'second-factor': 'Second factor',
};

/** Extensions scanned by the post-prune reference check. */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** Directories the pruner never walks into. */
export const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'out', 'coverage']);

export const DEFAULT_COMMIT_MESSAGE = 'chore: scaffold from create-nest-next-auth';

export const GIT_FALLBACK_NAME = CLI_NAME;

export const GIT_FALLBACK_EMAIL = `${CLI_NAME}@users.noreply.github.com`;
