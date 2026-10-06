import { readFileSync } from 'node:fs';
import { CI_VERSION_PATTERN } from '../guardrails/policy.mjs';
import { resolve } from 'node:path';

export function gateEnvironment(config, cwd, env) {
  const values = { ...config.environment };
  if (values.MONGOMS_DOWNLOAD_DIR)
    values.MONGOMS_DOWNLOAD_DIR = resolve(cwd, values.MONGOMS_DOWNLOAD_DIR);
  return { ...env, ...values };
}

export function cacheMetadata(config, cwd) {
  const packagePrefix = `  ${config.mongoCache.packageName}@`;
  const versions = [
    ...new Set(
      readFileSync(resolve(cwd, config.mongoCache.lockfile), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.startsWith(packagePrefix) && line.endsWith(':'))
        .map((line) => line.slice(packagePrefix.length, -1).split('(')[0]),
    ),
  ].sort();
  if (!versions.length || versions.some((version) => !CI_VERSION_PATTERN.test(version)))
    throw new Error('Mongo package version is missing or invalid in the lockfile');
  const binaryVersion = config.environment.MONGOMS_VERSION;
  if (typeof binaryVersion !== 'string' || !CI_VERSION_PATTERN.test(binaryVersion))
    throw new Error('Mongo binary version is missing or invalid');
  return {
    path: config.environment.MONGOMS_DOWNLOAD_DIR,
    key: `${config.mongoCache.keyPrefix}${versions.join('_')}-mongod-${binaryVersion}`,
  };
}
