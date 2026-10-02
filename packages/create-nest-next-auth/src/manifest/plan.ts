import type { Manifest, Preset } from '../types.js';
import {
  DEFAULT_PRESET_ID,
  LOCALE_AR_OPTION_ID,
  LOCALE_IDS,
  SIGN_IN_SITE_ID,
  WEB_TARGET_ID,
} from '../constants/index.js';
import {
  AddedLog,
  availableOptionIds,
  availableTargetIds,
  defaultDatabaseIds,
  defaultOptionIds,
  defaultTargetIds,
  expandPresetValue,
  expandRequires,
  firstRequirer,
  unique,
} from './dimensions.js';
import { resolveFeatureSelection } from './features.js';
import { isMember } from './read.js';
import { availableFeatures, isAvailable } from './select.js';
import type { Plan, PlanError, PlanRequest } from './plan-types.js';

export type {
  Plan,
  PlanChange,
  PlanError,
  PlanErrorReason,
  PlanRemoval,
  PlanRequest,
  RemovalReason,
} from './plan-types.js';

interface TargetResult {
  chosen: Set<string>;
  shared: Set<string>;
}

function resolveTargets(
  manifest: Manifest,
  request: PlanRequest,
  preset: Preset | undefined,
  added: AddedLog,
  errors: PlanError[],
): TargetResult {
  const available = availableTargetIds(manifest);
  const requested = unique(
    request.targets ??
      (preset
        ? expandPresetValue(preset.targets, available, defaultTargetIds(manifest))
        : defaultTargetIds(manifest)),
  );

  const base = new Set<string>();
  for (const id of requested) {
    const target = manifest.targets[id];
    if (!target) {
      errors.push({ id, reason: 'unknown' });
      continue;
    }
    if (!isAvailable(target)) {
      errors.push({ id, reason: 'planned' });
      continue;
    }
    base.add(id);
  }

  const chosen = new Set(base);
  expandRequires(manifest.targets, chosen, new Set(available), (target) => target.requires.targets);
  if (chosen.size === 0) errors.push({ id: 'targets', reason: 'empty' });

  const shared = new Set<string>();
  for (const [id, target] of Object.entries(manifest.targets)) {
    if (!chosen.has(id)) continue;
    for (const sharedId of target.requires.shared) {
      shared.add(sharedId);
      added.record(sharedId, id);
    }
  }
  for (const id of available) {
    if (chosen.has(id) && !base.has(id)) {
      added.record(
        id,
        firstRequirer(manifest.targets, chosen, id, (target) => target.requires.targets),
      );
    }
  }

  return { chosen, shared };
}

function resolveDatabase(manifest: Manifest, request: PlanRequest, errors: PlanError[]): string {
  const requested = unique(request.databases ?? defaultDatabaseIds(manifest));
  const valid: string[] = [];
  for (const id of requested) {
    const database = manifest.databases[id];
    if (!database) {
      errors.push({ id, reason: 'unknown' });
      continue;
    }
    if (!isAvailable(database)) {
      errors.push({ id, reason: 'planned' });
      continue;
    }
    valid.push(id);
  }

  if (valid.length === 0) {
    // Every requested id was already rejected: a second "pick one" is noise.
    if (requested.length === 0) errors.push({ id: 'database', reason: 'empty' });
    return '';
  }
  if (valid.length > 1) {
    errors.push({ id: valid.join(','), reason: 'database-conflict' });
    return valid[0];
  }
  return valid[0];
}

function optionOverrides(
  request: PlanRequest,
  errors: PlanError[],
): Partial<Record<string, boolean>> {
  const overrides: Partial<Record<string, boolean>> = { ...(request.options ?? {}) };
  if (request.locales !== undefined) {
    const locales = unique(request.locales);
    for (const locale of locales) {
      if (!isMember(LOCALE_IDS, locale)) errors.push({ id: locale, reason: 'unknown' });
    }
    if (!locales.includes('en')) errors.push({ id: 'locales', reason: 'locales' });
    overrides[LOCALE_AR_OPTION_ID] = locales.includes('ar');
  }
  return overrides;
}

function resolveOptions(
  manifest: Manifest,
  request: PlanRequest,
  preset: Preset | undefined,
  added: AddedLog,
  errors: PlanError[],
): Set<string> {
  const available = availableOptionIds(manifest);
  const base = new Set<string>(
    preset
      ? expandPresetValue(preset.options, available, defaultOptionIds(manifest))
      : defaultOptionIds(manifest),
  );

  // A planned option is fixed at its manifest default, whatever a preset says.
  for (const [id, option] of Object.entries(manifest.options)) {
    if (isAvailable(option)) continue;
    if (option.default) base.add(id);
    else base.delete(id);
  }

  const overrides = optionOverrides(request, errors);
  const explicit = new Set<string>();
  for (const [id, on] of Object.entries(overrides)) {
    const option = manifest.options[id];
    if (!option) {
      errors.push({ id, reason: 'unknown' });
      continue;
    }
    if (!isAvailable(option)) {
      if (on !== option.default) errors.push({ id, reason: 'planned' });
      continue;
    }
    explicit.add(id);
    if (on) base.add(id);
    else base.delete(id);
  }

  const chosen = new Set(base);
  expandRequires(manifest.options, chosen, new Set(available), (option) => option.requires);
  // A flag that turns an option off wins over a preset that turned it on.
  for (const id of explicit) {
    if (overrides[id] === true) chosen.add(id);
    else chosen.delete(id);
  }
  // An explicit "off" must not leave a selected option without its requirement.
  for (const id of chosen) {
    for (const required of manifest.options[id].requires) {
      if (!chosen.has(required)) errors.push({ id, needed: required, reason: 'option-conflict' });
    }
  }

  for (const id of available) {
    if (chosen.has(id) && !base.has(id)) {
      added.record(
        id,
        firstRequirer(manifest.options, chosen, id, (option) => option.requires),
      );
    }
  }

  return chosen;
}

function signInSite(
  manifest: Manifest,
  chosenTargets: Set<string>,
  added: AddedLog,
): Plan['signInSite'] {
  if (chosenTargets.has(WEB_TARGET_ID)) return 'full';
  const native = Object.entries(manifest.targets).find(
    ([id, target]) => chosenTargets.has(id) && target.needsSignInSite === true,
  );
  if (!native) return 'none';
  added.record(SIGN_IN_SITE_ID, native[0]);
  return 'kept-for-native';
}

/** Resolves every selection dimension into one deterministic plan. Pure: no I/O. */
export function resolvePlan(manifest: Manifest, request: PlanRequest): Plan {
  const errors: PlanError[] = [];
  const added = new AddedLog();

  let preset: Preset | undefined;
  if (request.preset !== undefined) {
    preset = manifest.presets[request.preset];
    if (!preset) errors.push({ id: request.preset, reason: 'unknown' });
  } else {
    preset = manifest.presets[DEFAULT_PRESET_ID];
  }

  const { chosen: chosenTargets, shared } = resolveTargets(
    manifest,
    request,
    preset,
    added,
    errors,
  );
  const database = resolveDatabase(manifest, request, errors);
  const chosenOptions = resolveOptions(manifest, request, preset, added, errors);
  const { chosen: chosenFeatures, removed } = resolveFeatureSelection(
    manifest,
    request,
    preset,
    chosenTargets,
    added,
    errors,
  );
  const selectedSignInSite = signInSite(manifest, chosenTargets, added);

  return {
    targets: availableTargetIds(manifest).filter((id) => chosenTargets.has(id)),
    database,
    features: availableFeatures(manifest)
      .map(({ id }) => id)
      .filter((id) => chosenFeatures.has(id)),
    options: Object.keys(manifest.options).filter((id) => chosenOptions.has(id)),
    shared: Object.keys(manifest.shared).filter((id) => shared.has(id)),
    signInSite: selectedSignInSite,
    added: added.list(),
    removed,
    errors,
  };
}
