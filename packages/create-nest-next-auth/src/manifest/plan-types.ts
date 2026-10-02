export type PlanErrorReason =
  | 'unknown'
  | 'planned'
  | 'empty'
  | 'database-conflict'
  | 'option-conflict'
  | 'feature-conflict'
  | 'locales';

export interface PlanError {
  id: string;
  reason: PlanErrorReason;
  /** For a conflict, the other id: what `id` needs but cannot have. */
  needed?: string;
}

/** An id the plan gained, and what caused it. */
export interface PlanChange {
  id: string;
  because: string;
}

export type RemovalReason = 'targets' | 'needs';

/** A feature the plan dropped, and why. `because` is a target list or a feature id. */
export interface PlanRemoval {
  id: string;
  reason: RemovalReason;
  because: string;
}

export interface Plan {
  targets: string[];
  database: string;
  features: string[];
  options: string[];
  shared: string[];
  signInSite: 'full' | 'kept-for-native' | 'none';
  added: PlanChange[];
  removed: PlanRemoval[];
  errors: PlanError[];
}

/** What the flags, config file and prompts ask for, before presets and defaults. */
export interface PlanRequest {
  targets?: string[];
  databases?: string[];
  features?: string[];
  options?: Partial<Record<string, boolean>>;
  locales?: string[];
  preset?: string;
}
