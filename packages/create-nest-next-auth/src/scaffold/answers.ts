import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ANSWERS_FILE_NAME,
  ANSWERS_SCHEMA_VERSION,
  BROKEN_PACKAGE,
  LOCALE_OPTION_LOCALES,
  PACKAGE_MANIFEST,
  REINSTALL_HINT,
  REQUIRED_LOCALE_ID,
  SHA256_HEX_PATTERN,
  TEMPLATE_IDENTITY_FILE,
} from '../constants/index.js';
import { BrokenPackageError } from '../errors.js';
import type { Plan } from '../manifest/plan.js';
import { isRecord } from '../manifest/read.js';
import { formatChangedFiles } from '../prune/format.js';
import type {
  AnswersRecord,
  InstallerIdentity,
  ResolvedAnswers,
  TemplateIdentity,
} from '../types.js';
import { isErrnoException } from '../utils/fs.js';

function brokenPackage(detail: string): BrokenPackageError {
  return new BrokenPackageError(`${BROKEN_PACKAGE}: ${detail} ${REINSTALL_HINT}`);
}

async function readIdentityFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw brokenPackage(`${path} is missing.`);
    }
    const reason = error instanceof Error ? error.message : String(error);
    throw brokenPackage(`${path} could not be read (${reason}).`);
  }
}

/** The installer's own name and version, read once from its package.json. */
export async function readInstallerIdentity(root: string): Promise<InstallerIdentity> {
  const path = join(root, PACKAGE_MANIFEST);
  const raw = await readIdentityFile(path);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw brokenPackage(`${path} is not valid JSON (${reason}).`);
  }
  if (!isRecord(parsed)) throw brokenPackage(`${path} is not a JSON object.`);
  const { name, version } = parsed;
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw brokenPackage(`${path} does not carry a string name and version.`);
  }
  return { name, version };
}

/**
 * The SHA-256 sync-template.mjs computed over the template's file list and
 * contents at build time. Read from the manifest root, where the build writes
 * it beside the copied manifest: in the published package that root is the
 * package directory, next to the `template/` the digest describes.
 */
export async function readTemplateIdentity(root: string): Promise<TemplateIdentity> {
  const path = join(root, TEMPLATE_IDENTITY_FILE);
  const raw = await readIdentityFile(path);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw brokenPackage(`${path} is not valid JSON (${reason}).`);
  }
  const sha256 = isRecord(parsed) ? parsed.sha256 : undefined;
  if (typeof sha256 !== 'string' || !SHA256_HEX_PATTERN.test(sha256)) {
    throw brokenPackage(`${path} does not carry a 64-character sha256.`);
  }
  return { sha256 };
}

/**
 * The locales the resolved options leave in the project: the locale every
 * project ships, plus every locale whose manifest option is on.
 */
function resolvedLocales(options: readonly string[]): string[] {
  const locales = [REQUIRED_LOCALE_ID];
  for (const [optionId, locale] of Object.entries(LOCALE_OPTION_LOCALES)) {
    if (options.includes(optionId)) locales.push(locale);
  }
  return locales.sort();
}

/** The resolved plan, every array sorted so identical choices give identical bytes. */
function resolvedAnswers(plan: Plan): ResolvedAnswers {
  return {
    targets: [...plan.targets].sort(),
    database: plan.database,
    features: [...plan.features].sort(),
    options: [...plan.options].sort(),
    locales: resolvedLocales(plan.options),
  };
}

/** The answers record for one run: schema version, installer, template, plan. */
export function answersRecord(
  installer: InstallerIdentity,
  template: TemplateIdentity,
  plan: Plan,
): AnswersRecord {
  return {
    schemaVersion: ANSWERS_SCHEMA_VERSION,
    installer,
    template,
    answers: resolvedAnswers(plan),
  };
}

/**
 * Writes `<target>/.create-nest-next-auth.json`: two spaces and a trailing
 * newline, nothing local and no timestamp, so the same choices always produce
 * the same file. The generated project's own prettier config then leaves the
 * bytes unchanged, the same way the pruner formats what it edits.
 */
export async function recordAnswers(target: string, record: AnswersRecord): Promise<void> {
  await writeFile(join(target, ANSWERS_FILE_NAME), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
  await formatChangedFiles(target, [ANSWERS_FILE_NAME]);
}
