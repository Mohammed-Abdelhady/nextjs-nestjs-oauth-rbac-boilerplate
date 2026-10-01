import { SIGN_IN_SITE_ID, SIGN_IN_SITE_LABEL } from '../constants/index.js';
import type { Plan, PlanError } from '../manifest/plan.js';
import type { Manifest } from '../types.js';

/** A label for any id a plan may name: target, database, option, feature or shared. */
function labelFor(manifest: Manifest, id: string): string {
  if (id === SIGN_IN_SITE_ID) return SIGN_IN_SITE_LABEL;
  return (
    manifest.targets[id]?.label ??
    manifest.databases[id]?.label ??
    manifest.options[id]?.label ??
    manifest.features[id]?.label ??
    id
  );
}

function labels(manifest: Manifest, ids: string[]): string {
  return ids.map((id) => labelFor(manifest, id)).join(', ');
}

/** The plan, in the order a reader meets it, printed before anything is written. */
export function buildSummary(manifest: Manifest, plan: Plan): string[] {
  const visibleFeatures = plan.features.filter((id) => manifest.features[id]?.kind !== 'hidden');
  const lines = [
    `Clients    ${labels(manifest, plan.targets)}`,
    `Database   ${plan.database === '' ? 'none' : labelFor(manifest, plan.database)}`,
    `Sign-in    ${labels(manifest, visibleFeatures)}`,
  ];

  if (plan.options.length > 0) {
    lines.push(`Options    ${labels(manifest, plan.options)}`);
  }
  for (const entry of plan.added) {
    lines.push(
      `Added      ${labelFor(manifest, entry.id)}, needed by ${labelFor(manifest, entry.because)}`,
    );
  }
  for (const entry of plan.removed) {
    const label = labelFor(manifest, entry.id);
    if (entry.reason === 'targets') {
      lines.push(
        `Removed    ${label}, only available for ${labels(manifest, entry.because.split(','))}`,
      );
    } else {
      lines.push(
        `Removed    ${label}, needs ${labelFor(manifest, entry.because)}, which is not available for the selected clients`,
      );
    }
  }
  return lines;
}

/** One line per resolver error, in the order the resolver recorded them. */
export function describePlanErrors(manifest: Manifest, errors: PlanError[]): string[] {
  return errors.map((error) => {
    switch (error.reason) {
      case 'unknown':
        return `"${error.id}" is not a known choice.`;
      case 'planned': {
        const option = manifest.options[error.id];
        if (option) {
          return option.default
            ? `Turning off "${option.label}" is not available yet. Every project includes this for now.`
            : `Turning on "${option.label}" is not available yet. Every project omits this for now.`;
        }
        return `"${error.id}" is not available yet.`;
      }
      case 'empty':
        return error.id === 'targets' ? 'Select at least one client.' : 'Select a database.';
      case 'database-conflict':
        return `Choose exactly one database; got: ${error.id}.`;
      case 'option-conflict':
        return `"${error.id}" needs "${error.needed}", which was turned off.`;
      case 'feature-conflict': {
        if (error.needed !== undefined) {
          return `"${error.id}" needs "${error.needed}", which the selected clients do not support.`;
        }
        const limit = manifest.features[error.id]?.targets ?? [];
        return `"${error.id}" needs one of: ${limit.join(', ')}.`;
      }
      case 'locales':
        return '--locales must include "en".';
    }
  });
}
