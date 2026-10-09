import type { Manifest, PruneResult, RulesPolicy } from '../types.js';
import {
  ENV_EXAMPLE_FILES,
  FRONTEND_PACKAGE_JSON,
  PNPM_WORKSPACE_FILE,
  ROOT_PACKAGE_JSON,
  DEFAULT_RULES_POLICY,
} from '../constants/index.js';
import { pruneRules } from './rules.js';
import { removeDocMarkers } from './doc-markers.js';
import { removeDocLinks } from './docs.js';
import { DEPENDABOT_FILE, pruneDependabot } from './dependabot.js';
import { type EnvRemovals, stripEnvFiles, writeFeatureFlag } from './env.js';
import { deleteMatchingFiles } from './files.js';
import { formatChangedFiles } from './format.js';
import { removeFeatureLines } from './markers.js';
import { pruneMessageCatalogues } from './messages.js';
import { pruneRootPackage } from './package-scripts.js';
import { renderWorkspace } from '../scaffold/workspace.js';
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
 * Removes everything the unselected features and options own, marked lines and
 * sections included, then reports imports and scripts into deleted files and
 * missing relative documentation links.
 */
export async function prune(
  root: string,
  manifest: Manifest,
  selectedFeatures: string[],
  selectedOptions: string[],
  rules: RulesPolicy = DEFAULT_RULES_POLICY,
): Promise<PruneResult> {
  const selected = new Set(selectedFeatures);
  const removed = Object.keys(manifest.features).filter((id) => !selected.has(id));

  const keptOptions = new Set(selectedOptions);
  const removedOptions = Object.keys(manifest.options).filter((id) => !keptOptions.has(id));

  const doomedFiles: string[] = [];
  const doomedDocs: string[] = [];
  for (const id of removed) {
    const feature = manifest.features[id];
    doomedFiles.push(...feature.files);
    doomedDocs.push(...feature.docs);
  }
  for (const id of removedOptions) {
    const option = manifest.options[id];
    doomedFiles.push(...option.files);
    doomedDocs.push(...option.docs);
  }

  const deletedFiles = await deleteMatchingFiles(root, [
    ...manifest.core.alwaysRemoveFiles,
    ...doomedFiles,
    ...doomedDocs,
  ]);
  deletedFiles.push(...(await pruneRules(root, rules)));

  // Runs for every selection, not only a partial one: the full project has to
  // come out without marker comments too. Option ids are valid marker names.
  const markerIds = [...Object.keys(manifest.features), ...Object.keys(manifest.options)];
  const markers = await removeFeatureLines(
    root,
    [...selectedFeatures, ...selectedOptions],
    markerIds,
  );
  const docMarkers = await removeDocMarkers(
    root,
    [...selectedFeatures, ...selectedOptions],
    markerIds,
  );

  const removedMarkdown = deletedFiles.filter((path) => path.endsWith('.md'));
  const docs = await removeDocLinks(root, [...doomedDocs, ...removedMarkdown]);
  const strippedEnvVars = await stripEnvFiles(root, removedEnvVars(manifest, selected));
  await writeFeatureFlag(root, selectedFeatures);
  const workspaceChanged = await renderWorkspace(root);
  await pruneRootPackage(root, deletedFiles);
  await pruneDependabot(root, deletedFiles);
  const editedCatalogues = await pruneMessageCatalogues(root, manifest, removedOptions);

  // The generated project's own prettier config, applied to every file the
  // pruner edited, so a fresh scaffold lints without a manual format run.
  const formattedFiles = await formatChangedFiles(root, [
    ...markers.editedFiles,
    ...docMarkers.editedFiles,
    ...docs.editedFiles,
    ...ENV_EXAMPLE_FILES,
    ...editedCatalogues,
    ROOT_PACKAGE_JSON,
    FRONTEND_PACKAGE_JSON,
    ...(workspaceChanged ? [PNPM_WORKSPACE_FILE] : []),
    DEPENDABOT_FILE,
  ]);

  const dangling = await findDanglingReferences(root, deletedFiles);

  return {
    selected: selectedFeatures,
    removed,
    removedOptions,
    deletedFiles,
    strippedEnvVars,
    removedDocLines: docs.removedLines,
    markedFiles: [...markers.editedFiles, ...docMarkers.editedFiles],
    removedMarkedLines: markers.removedLines + docMarkers.removedLines,
    formattedFiles,
    dangling,
  };
}
