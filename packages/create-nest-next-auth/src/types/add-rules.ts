import type { ADD_RULES_AGENT_COPY } from '../constants/rules.js';
import type { RulesPolicy } from '../types.js';
import type { SetupSummary } from './setup.js';

export interface RulesFile {
  path: string;
  content: string;
}
export interface RulesLayout {
  manager: 'pnpm' | 'npm';
  version: string;
  manifest: Record<string, unknown>;
  workspaces: string[];
  observations: Map<string, string | undefined>;
  repository: boolean;
  guards: Map<string, boolean>;
}
export interface RulesPlan {
  root: string;
  level: RulesPolicy;
  files: RulesFile[];
  blockers: string[];
  observations: Map<string, string | undefined>;
  guards: Map<string, boolean>;
  gitHooks?: string[];
  summary: SetupSummary;
}
export interface RulesTextFacts {
  gates: { name: string; command: string; args: string[] }[];
  manager: { name: string; version: string };
  explicitTypeLint: string;
  whereThingsAre: string;
  standardCodeText?: string;
  standardNotEnforced?: string;
}

export interface RulesIntegration {
  files: RulesFile[];
  notAdded: { check: string; reason: string }[];
}

export interface AddRulesOptions {
  rules: RulesPolicy;
  dryRun: boolean;
  yes: boolean;
  agentsFile?: typeof ADD_RULES_AGENT_COPY;
}
