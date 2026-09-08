import type { Feature, Manifest } from '../types.js';

export interface FeatureEntry {
  id: string;
  feature: Feature;
}

export interface Selection {
  /** Selected ids plus everything they require, in manifest order. */
  selected: string[];
  /** Available ids that were not selected. */
  removed: string[];
  /** Ids added because another selected feature requires them. */
  added: string[];
  /** Requested ids that are unknown or still planned. */
  rejected: string[];
}

export function isAvailable(feature: Feature): boolean {
  return feature.status !== 'planned';
}

export function availableFeatures(manifest: Manifest): FeatureEntry[] {
  return Object.entries(manifest.features)
    .filter(([, feature]) => isAvailable(feature))
    .map(([id, feature]) => ({ id, feature }));
}

export function defaultFeatureIds(manifest: Manifest): string[] {
  return availableFeatures(manifest)
    .filter(({ feature }) => feature.default)
    .map(({ id }) => id);
}

/** Expands requested ids with their requirements and reports what was dropped. */
export function resolveSelection(manifest: Manifest, requested: string[]): Selection {
  const available = new Set(availableFeatures(manifest).map(({ id }) => id));
  const rejected = requested.filter((id) => !available.has(id));
  const chosen = new Set(requested.filter((id) => available.has(id)));
  const added: string[] = [];

  const queue = [...chosen];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;
    for (const required of manifest.features[id]?.requires ?? []) {
      if (!available.has(required) || chosen.has(required)) continue;
      chosen.add(required);
      added.push(required);
      queue.push(required);
    }
  }

  const order = availableFeatures(manifest).map(({ id }) => id);
  return {
    selected: order.filter((id) => chosen.has(id)),
    removed: order.filter((id) => !chosen.has(id)),
    added,
    rejected,
  };
}
