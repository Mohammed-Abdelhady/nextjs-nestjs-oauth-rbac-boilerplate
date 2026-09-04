import type { Feature, FeatureKind, FeatureStatus, Manifest } from '../types.js';

const KINDS: FeatureKind[] = ['credential', 'oauth', 'second-factor', 'passwordless'];
const STATUSES: FeatureStatus[] = ['available', 'planned'];
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export class ManifestError extends Error {
  constructor(public readonly problems: string[]) {
    super(`template.manifest.json is invalid:\n  ${problems.join('\n  ')}`);
    this.name = 'ManifestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown, where: string, problems: string[]): string[] {
  if (!Array.isArray(value)) {
    problems.push(`${where} must be an array of strings`);
    return [];
  }
  const entries: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.length === 0) {
      problems.push(`${where} must contain non-empty strings`);
      continue;
    }
    entries.push(entry);
  }
  return entries;
}

function readPathArray(value: unknown, where: string, problems: string[]): string[] {
  const entries = readStringArray(value, where, problems);
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.includes('..') || entry.includes('\\')) {
      problems.push(`${where} entry "${entry}" must be a relative posix path inside the project`);
    }
  }
  return entries;
}

function readString(value: unknown, where: string, problems: string[]): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    problems.push(`${where} must be a non-empty string`);
    return '';
  }
  return value;
}

function readFeature(id: string, value: unknown, problems: string[]): Feature {
  if (!isRecord(value)) {
    problems.push(`features.${id} must be an object`);
    return emptyFeature();
  }

  const kind = value.kind;
  if (typeof kind !== 'string' || !KINDS.includes(kind as FeatureKind)) {
    problems.push(`features.${id}.kind must be one of ${KINDS.join(', ')}`);
  }

  const status = value.status;
  if (
    status !== undefined &&
    (typeof status !== 'string' || !STATUSES.includes(status as FeatureStatus))
  ) {
    problems.push(`features.${id}.status must be one of ${STATUSES.join(', ')}`);
  }

  if (typeof value.default !== 'boolean') {
    problems.push(`features.${id}.default must be a boolean`);
  }

  return {
    label: readString(value.label, `features.${id}.label`, problems),
    description: readString(value.description, `features.${id}.description`, problems),
    kind: (KINDS.includes(kind as FeatureKind) ? kind : 'oauth') as FeatureKind,
    default: value.default === true,
    files: readPathArray(value.files, `features.${id}.files`, problems),
    envVars: readStringArray(value.envVars, `features.${id}.envVars`, problems),
    requires: readStringArray(value.requires, `features.${id}.requires`, problems),
    docs: readPathArray(value.docs, `features.${id}.docs`, problems),
    status: status === 'planned' ? 'planned' : 'available',
  };
}

function emptyFeature(): Feature {
  return {
    label: '',
    description: '',
    kind: 'oauth',
    default: false,
    files: [],
    envVars: [],
    requires: [],
    docs: [],
    status: 'planned',
  };
}

/** Parses and checks the manifest. Throws ManifestError listing every problem. */
export function validateManifest(value: unknown): Manifest {
  const problems: string[] = [];

  if (!isRecord(value)) throw new ManifestError(['the manifest must be a JSON object']);
  if (!isRecord(value.features)) throw new ManifestError(['features must be an object']);

  const features: Record<string, Feature> = {};
  for (const [id, entry] of Object.entries(value.features)) {
    if (!ID_PATTERN.test(id)) {
      problems.push(`feature id "${id}" must be lowercase letters, digits and hyphens`);
    }
    features[id] = readFeature(id, entry, problems);
  }

  for (const [id, feature] of Object.entries(features)) {
    for (const required of feature.requires) {
      const target = features[required];
      if (!target) {
        problems.push(`features.${id}.requires names "${required}", which does not exist`);
        continue;
      }
      if (feature.status !== 'planned' && target.status === 'planned') {
        problems.push(`features.${id} is available but requires planned feature "${required}"`);
      }
    }
  }

  const core = isRecord(value.core) ? value.core : undefined;
  if (!core) problems.push('core must be an object with alwaysRemoveFiles');
  const alwaysRemoveFiles = readPathArray(
    core?.alwaysRemoveFiles ?? [],
    'core.alwaysRemoveFiles',
    problems,
  );

  if (problems.length > 0) throw new ManifestError(problems);
  return { features, core: { alwaysRemoveFiles } };
}
