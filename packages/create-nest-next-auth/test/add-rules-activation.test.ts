import { chmod, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { applyRules, planRules } from '../src/add-rules/plan.js';
import {
  cleanRulesFixtures,
  fixtureGit,
  put,
  rulesFixture,
  TRUSTED_RULES_ROOT,
} from './add-rules-fixture.js';

afterEach(cleanRulesFixtures);
it.each(['active', 'overridden', 'empty', 'missing', 'not-executable', 'directory'] as const)(
  'reports %s hook configuration honestly on replay',
  async (state) => {
    const root = await rulesFixture();
    fixtureGit(root, ['init', '--quiet']);
    await applyRules(await planRules(root, 'strict', TRUSTED_RULES_ROOT));
    for (const name of ['h', 'pre-commit', 'pre-push', 'commit-msg']) {
      await put(root, `.husky/_/${name}`, '#!/bin/sh\nexit 0\n');
      await chmod(join(root, '.husky/_', name), 0o755);
    }
    fixtureGit(root, ['config', '--add', 'core.hooksPath', '.husky/_']);
    if (state === 'empty') fixtureGit(root, ['config', '--add', 'core.hooksPath', '']);
    if (state === 'overridden')
      fixtureGit(root, ['config', '--add', 'core.hooksPath', 'custom-hooks']);
    if (state === 'missing' || state === 'directory') await rm(join(root, '.husky/_/pre-commit'));
    if (state === 'directory') await mkdir(join(root, '.husky/_/pre-commit'));
    if (state === 'not-executable') await chmod(join(root, '.husky/_/pre-commit'), 0o644);
    const plan = await planRules(root, 'strict', TRUSTED_RULES_ROOT);
    expect({
      active: plan.summary.hooks.active,
      activation: plan.summary.hooks.activationCommand,
      files: plan.files,
      blockers: plan.blockers,
    }).toEqual({
      active: state === 'active',
      activation: state === 'active' ? undefined : 'node node_modules/husky/bin.mjs',
      files: [],
      blockers: [],
    });
  },
);
