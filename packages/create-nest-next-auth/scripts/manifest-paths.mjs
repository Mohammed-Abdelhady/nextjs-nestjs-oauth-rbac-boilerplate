import { matchesGlob } from './glob.mjs';

const WORKSPACE_MANIFEST = 'package.json';

function ownerProblems(where, owner, tracked) {
  const problems = [];
  for (const glob of owner.files ?? []) {
    if (!tracked.some((file) => matchesGlob(file, glob)))
      problems.push(`${where}.files names "${glob}", which matches no tracked file`);
  }
  for (const workspace of owner.workspaces ?? []) {
    if (!tracked.includes(`${workspace}/${WORKSPACE_MANIFEST}`))
      problems.push(
        `${where}.workspaces names "${workspace}", which has no tracked ${WORKSPACE_MANIFEST}`,
      );
  }
  return problems;
}

/**
 * Every `files` glob and `workspaces` entry that names nothing in the tree. A
 * stale entry deletes nothing, or keeps a workspace that is not there.
 */
export function manifestPathProblems(manifest, tracked) {
  const dimensions = [
    ['targets', manifest.targets ?? {}],
    ['shared', manifest.shared ?? {}],
    ['databases', manifest.databases ?? {}],
    ['options', manifest.options ?? {}],
    ['features', manifest.features ?? {}],
  ];
  return dimensions.flatMap(([dimension, owners]) =>
    Object.entries(owners).flatMap(([id, owner]) =>
      ownerProblems(`${dimension}.${id}`, owner, tracked),
    ),
  );
}
