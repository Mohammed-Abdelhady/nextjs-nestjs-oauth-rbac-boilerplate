import type { FeatureKind } from '../types.js';

/** Every kind a user can pick from the prompt. */
type PromptedKind = Exclude<FeatureKind, 'hidden'>;

export const CLI_NAME = 'create-nest-next-auth';

export const MANIFEST_FILE = 'template.manifest.json';

export const TEMPLATE_DIR_NAME = 'template';

/** Manifest version this package writes and understands. */
export const MANIFEST_VERSION = 2;

/** Preset applied when none was named. Used only when the manifest defines it. */
export const DEFAULT_PRESET_ID = 'standard';

/** The target whose sign-in pages a native shell borrows. */
export const WEB_TARGET_ID = 'web';

/** Synthetic plan entry for the browser sign-in pages a native shell needs. */
export const SIGN_IN_SITE_ID = 'web-sign-in-pages';

export const SIGN_IN_SITE_LABEL = 'web sign-in pages';

/** Option ids toggled by dedicated flags. */
export const DOCKER_OPTION_ID = 'docker';

export const PRODUCTION_OPTION_ID = 'production';

export const LOCALE_AR_OPTION_ID = 'locale-ar';

/** Locales a generated project can carry today. */
export const LOCALE_IDS = ['en', 'ar'] as const;

/** Exit code for every usage error: bad flags, bad config, bad selection. */
export const USAGE_EXIT_CODE = 2;

/** Preset keywords, kept together so validation and resolution agree. */
export const PRESET_KEYWORDS = ['available', 'defaults'] as const;

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

/** Kinds shown in the prompt, in order. `hidden` is deliberately absent. */
export const FEATURE_KIND_ORDER: PromptedKind[] = [
  'credential',
  'oauth',
  'passwordless',
  'second-factor',
];

export const FEATURE_KIND_LABELS: Record<PromptedKind, string> = {
  credential: 'Credentials',
  oauth: 'OAuth providers',
  passwordless: 'Passwordless',
  'second-factor': 'Second factor',
};

/** Extensions scanned by the post-prune reference check. */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/**
 * Extensions scanned for `feature:` markers. Code only: JSON has no comments
 * and markdown is pruned by its own doc rules.
 */
export const MARKER_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

/** The `@/` alias in the generated frontend, and what it points at. */
export const FRONTEND_ALIAS = '@/';

export const FRONTEND_SOURCE = 'frontend/src';

/**
 * `@app/<name>` and `@app/<name>/<subpath>` name the workspace at
 * shared/<name>. Names and subpath segments are npm-style: no dots, so `..`
 * and a file extension never match.
 */
export const SHARED_PACKAGE_SPECIFIER = /^@app\/([a-z0-9-]+)((?:\/[a-z0-9-]+)*)$/;

export const SHARED_PACKAGES_ROOT = 'shared';

/** Where the root export points when the package manifest is gone or names none. */
export const SHARED_PACKAGE_ENTRY = 'src/index';

export const PACKAGE_MANIFEST = 'package.json';

export const ROOT_EXPORT = '.';

/** Directories the pruner never walks into. */
export const SKIPPED_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'out', 'coverage']);

export const DEFAULT_COMMIT_MESSAGE = 'chore: scaffold from create-nest-next-auth';

export const GIT_FALLBACK_NAME = CLI_NAME;

export const GIT_FALLBACK_EMAIL = `${CLI_NAME}@users.noreply.github.com`;
