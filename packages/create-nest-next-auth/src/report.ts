import type { DanglingReference, Manifest, PruneResult } from './types.js';

export function describeSelection(manifest: Manifest, result: PruneResult): string[] {
  const label = (id: string): string => manifest.features[id]?.label ?? id;
  // Hidden features ride along with the ones that require them, so naming them
  // here would only be noise.
  const named = (id: string): boolean => manifest.features[id]?.kind !== 'hidden';
  const lines = [`Included: ${result.selected.filter(named).map(label).join(', ')}`];

  const removedAvailable = result.removed.filter(
    (id) => named(id) && manifest.features[id]?.status !== 'planned',
  );
  if (removedAvailable.length > 0) {
    lines.push(`Removed: ${removedAvailable.map(label).join(', ')}`);
  }
  if (result.deletedFiles.length > 0) {
    lines.push(`Deleted ${result.deletedFiles.length} files`);
  }
  if (result.markedFiles.length > 0) {
    lines.push(`Edited ${result.markedFiles.length} files around their feature markers`);
  }
  if (result.strippedEnvVars.length > 0) {
    lines.push(`Stripped ${result.strippedEnvVars.length} env vars from the examples`);
  }
  return lines;
}

/** The message printed when pruning leaves imports pointing at deleted files. */
export function describeDangling(dangling: DanglingReference[]): string[] {
  const lines = [
    'The generated project imports files that were removed with the unselected features.',
    'Add the shared files to the manifest, or make the code load providers dynamically.',
    '',
  ];
  for (const reference of dangling) {
    lines.push(`${reference.file}:${reference.line} imports ${reference.specifier}`);
  }
  return lines;
}
