import TEMPLATE_TEST_POLICY from './template-tests.json' with { type: 'json' };

export const RULES_HOOK_PATHS = [
  '.husky/pre-commit',
  '.husky/pre-push',
  '.husky/commit-msg',
] as const;
export const RULES_WORKFLOW_PATH = '.github/workflows/ci.yml';
export const RULES_TRUSTED_WORKFLOW_PATH = '.github/workflows/trusted-scan.yml';
export const RULES_GATES_PATH = 'scripts/ci/gates.json';
export const RULES_SCANNER_ENTRY = 'scripts/check-hard-bans.mjs';
export const RULES_SCAN_GATE = 'Full-tree hard bans';
export const RULES_RANGE_JOB = 'range-scan';
export const RULES_SCAN_SCRIPT = 'check:bans';
export const RULES_QUALITY_DOC_PATH = TEMPLATE_TEST_POLICY.DOC_PATH;
export const RULES_DOC_INDEX_PATH = 'docs/README.md';
export const RULES_STANDARD_DOC_TEXT =
  "# Code quality\n\nSee `AGENTS.md` for this project's rules level, checks, commit format, and enforcement.\n";
