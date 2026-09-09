import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { excludedPath, exportSource } from '../../../scripts/verify-docker.mjs';
const root = process.cwd();
const evidence = join(root, '.hyperflow/evidence/t30-runtime');
const hash = (value) => createHash('sha256').update(value).digest('hex');
async function inventory(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (excludedPath(path)) continue;
    if (entry.isDirectory()) files.push(...await inventory(directory, path));
    else if (entry.isFile()) {
      const content = await readFile(join(directory, path));
      files.push({ path, sha256: hash(content), bytes: content.length });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const prior = JSON.parse(await readFile(join(root, '.hyperflow/evidence/t30-operational/capture.json'), 'utf8'));
const operational = await Promise.all(prior.files.map(async ({path, sha256}) => {
  const current = hash(await readFile(join(root, path)));
  return {path, sha256: current, unchanged: current === sha256};
}));
assert(operational.every((file) => file.unchanged), 'operational source moved');
const parent = await mkdtemp('/private/tmp/t30-runtime-');
const source = join(parent, 'source');
await mkdir(source);
const before = await inventory(root);
await exportSource(root, source);
const copied = await inventory(source);
const after = await inventory(root);
const stable = JSON.stringify(before) === JSON.stringify(after) && JSON.stringify(before) === JSON.stringify(copied);
const examples = [];
for (const path of ['.env.docker.example','backend/.env.example','frontend/.env.example']) {
  const content = execFileSync('git', ['show', `HEAD:${path}`], {cwd: root});
  await writeFile(join(source, path), content);
  examples.push({path, sha256: hash(content), origin: 'HEAD'});
}
const capture = {capturedAt: new Date().toISOString(), baseRevision: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), parent, source, stable, fingerprint: hash(JSON.stringify(before)), fileCount: before.length, sourceBytes: before.reduce((sum,file)=>sum+file.bytes,0), operational, examples, before, after, copied};
await writeFile(join(evidence, 'capture.json'), JSON.stringify(capture,null,2));
await writeFile(join(evidence, 'source-status.txt'), execFileSync('git',['status','--short']));
console.log(JSON.stringify({parent,source,stable,fingerprint:capture.fingerprint,fileCount:capture.fileCount,sourceBytes:capture.sourceBytes,operationalUnchanged:true}));
assert(stable, 'capture changed during copy; root reconciliation required');
