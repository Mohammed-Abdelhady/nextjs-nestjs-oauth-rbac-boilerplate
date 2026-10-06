import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { gitEnvironment } from '../guardrails/git-environment.mjs';
import {
  BRANCH_REF_PREFIX,
  CI_AUTH_HEADER_NAME,
  CI_FETCH_REFS,
  CI_TRACE2_VARIABLES,
  GIT_MAX_BUFFER_BYTES,
  GIT_OBJECT_ID_PATTERN,
} from '../guardrails/policy.mjs';

export function fetchArguments(env) {
  if (
    typeof env.HEAD_SHA !== 'string' ||
    !GIT_OBJECT_ID_PATTERN.test(env.HEAD_SHA) ||
    /^0+$/.test(env.HEAD_SHA)
  )
    throw new Error('Invalid pull request head SHA');
  if (!env.GITHUB_TOKEN || /[\r\n\0]/.test(env.GITHUB_TOKEN))
    throw new Error('Missing or invalid fetch token');
  if (typeof env.BASE_REF !== 'string' || !env.BASE_REF) throw new Error('Missing base branch ref');
  return [
    'fetch',
    '--no-tags',
    '--no-recurse-submodules',
    'origin',
    `+${env.HEAD_SHA}:${CI_FETCH_REFS.HEAD}`,
    `+${BRANCH_REF_PREFIX}${env.BASE_REF}:${CI_FETCH_REFS.BASE}`,
  ];
}

export function fetchAuthentication(env) {
  const server = new URL(env.GITHUB_SERVER_URL);
  if (
    server.protocol !== 'https:' ||
    server.username ||
    server.password ||
    server.search ||
    server.hash
  )
    throw new Error('Invalid GitHub server URL');
  const serverUrl = server.href.replace(/\/$/, '');
  const credentials = Buffer.from(`x-access-token:${env.GITHUB_TOKEN}`).toString('base64');
  return {
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `http.${serverUrl}/.${CI_AUTH_HEADER_NAME}`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${credentials}`,
  };
}

export function fetchTrustedObjects({ cwd, env = process.env }) {
  const args = fetchArguments(env);
  const authentication = fetchAuthentication(env);
  const gitEnv = gitEnvironment(env);
  for (const name of Object.keys(gitEnv)) {
    if (name.startsWith('GIT_TRACE') || name === 'GIT_CURL_VERBOSE') delete gitEnv[name];
  }
  for (const name of CI_TRACE2_VARIABLES) gitEnv[name] = '0';
  delete gitEnv.GITHUB_TOKEN;
  const git = (args, extra = {}) =>
    spawnSync('git', args, {
      cwd,
      env: { ...gitEnv, ...extra },
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    });
  if (git(['check-ref-format', `${BRANCH_REF_PREFIX}${env.BASE_REF}`]).status !== 0)
    throw new Error('Invalid base branch ref');
  // Capture all Git output: errors and trace settings must never print credentials.
  if (git(args, authentication).status !== 0)
    throw new Error('Could not fetch trusted scan objects');
  const headResult = git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${CI_FETCH_REFS.HEAD}^{commit}`,
  ]);
  if (headResult.status !== 0 || headResult.stdout?.trim() !== env.HEAD_SHA)
    throw new Error('Could not resolve pull request head commit');
  const result = git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${CI_FETCH_REFS.BASE}^{commit}`,
  ]);
  const base = result.stdout?.trim();
  if (result.status !== 0 || !GIT_OBJECT_ID_PATTERN.test(base ?? ''))
    throw new Error('Could not resolve current base commit');
  if (!env.GITHUB_OUTPUT) throw new Error('Missing fetch output file');
  appendFileSync(env.GITHUB_OUTPUT, `base=${base}\n`);
}
