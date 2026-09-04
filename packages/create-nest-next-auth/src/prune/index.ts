import type { Manifest, PruneResult } from '../types.js';
import { removeDocLinks } from './docs.js';
import { type EnvRemovals, stripEnvFiles, writeFeatureFlag } from './env.js';
import { deleteMatchingFiles } from './files.js';
import { findDanglingReferences } from './references.js';

/** Env vars only the removed features use, mapped to the words naming them. */
function removedEnvVars(manifest: Manifest, selected: Set<string>): EnvRemovals {
  const keptVars = new Set<string>();
  for (const id of selected) {
    for (const name of manifest.features[id]?.envVars ?? []) keptVars.add(name);
  }

  const removals: EnvRemovals = new Map();
  for (const [id, feature] of Object.entries(manifest.features)) {
    if (selected.has(id)) continue;
    for (const name of feature.envVars) {
      if (keptVars.has(name)) continue;
      removals.set(name, [feature.label, id]);
    }
  }
  return removals;
}

/**
 * Removes everything the unselected features own, then reports imports that
 * still point at deleted files.
 */
export async function prune(
  root: string,
  manifest: Manifest,
  selectedIds: string[],
): Promise<PruneResult> {
  const selected = new Set(selectedIds);
  const removed = Object.keys(manifest.features).filter((id) => !selected.has(id));

  const doomedFiles: string[] = [];
  const doomedDocs: string[] = [];
  for (const id of removed) {
    const feature = manifest.features[id];
    doomedFiles.push(...feature.files);
    doomedDocs.push(...feature.docs);
  }

  const deletedFiles = await deleteMatchingFiles(root, [
    ...manifest.core.alwaysRemoveFiles,
    ...doomedFiles,
    ...doomedDocs,
  ]);

  const docs = await removeDocLinks(root, doomedDocs);
  const strippedEnvVars = await stripEnvFiles(root, removedEnvVars(manifest, selected));
  await writeFeatureFlag(root, selectedIds);
  const dangling = await findDanglingReferences(root, deletedFiles);

  return {
    selected: selectedIds,
    removed,
    deletedFiles,
    strippedEnvVars,
    removedDocLines: docs.removedLines,
    dangling,
  };
}
