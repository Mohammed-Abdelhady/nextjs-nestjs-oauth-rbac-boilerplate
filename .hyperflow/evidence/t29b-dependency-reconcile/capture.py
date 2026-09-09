import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

SOURCE = Path(__file__).resolve().parents[3]
EVIDENCE = Path(__file__).resolve().parent
EXAMPLES = {'.env.docker.example', 'backend/.env.example', 'frontend/.env.example'}
EXCLUDED = {'.git', '.hyperflow', '.agents', '.codex', '.claude', '.ssh', '.aws', '.kube', '.config', 'node_modules', '.next', 'dist', 'coverage', 'test-results', 'playwright-report', '.turbo'}


def permitted(relative):
    parts = Path(relative).parts
    name = parts[-1]
    if any(part in EXCLUDED for part in parts):
        return False
    if name == '.env' or name.startswith('.env.'):
        return relative in EXAMPLES
    return not name.endswith(('.pem', '.key', '.crt', '.tsbuildinfo', '.log'))


def inventory(root, names):
    return {name: hashlib.sha256((root / name).read_bytes()).hexdigest()
            for name in names if (root / name).is_file() and not (root / name).is_symlink()}


def digest(files):
    return hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()


def dependency_ignore(directory, names):
    return [name for name in names if name in {'.git', '.ssh', '.aws', '.kube', '.config'}
            or name == '.env' or name.startswith('.env.')
            or name.endswith(('.pem', '.key', '.crt'))]


def main():
    names = sorted(set(subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=SOURCE
    ).decode().strip('\0').split('\0')))
    names = [name for name in names if permitted(name)]
    before = inventory(SOURCE, names)
    snapshot_record = EVIDENCE / 'snapshot-path.txt'
    if snapshot_record.exists():
        snapshot = Path(snapshot_record.read_text().strip())
        assert snapshot.parent == Path('/private/tmp') and snapshot.name.startswith('t29b-dependency-reconcile-')
    else:
        snapshot = Path(tempfile.mkdtemp(prefix='t29b-dependency-reconcile-', dir='/private/tmp'))
    (EVIDENCE / 'snapshot-path.txt').write_text(str(snapshot) + '\n')
    for name in before:
        target = snapshot / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(SOURCE / name, target)
    copied = inventory(snapshot, names)
    after = inventory(SOURCE, names)
    assert before == copied == after, 'Source changed during capture'
    roots = ['node_modules', 'backend/node_modules', 'frontend/node_modules', 'packages/create-nest-next-auth/node_modules']
    for relative in roots:
        source = SOURCE / relative
        if source.is_dir():
            if not (snapshot / relative).exists():
                shutil.copytree(source, snapshot / relative, symlinks=True, ignore=dependency_ignore)
    links = []
    for directory, dirs, files in os.walk(snapshot):
        for name in dirs + files:
            path = Path(directory) / name
            if path.is_symlink():
                assert path.resolve().is_relative_to(snapshot), f'External link: {path}'
                if not path.exists():
                    assert path == snapshot / 'node_modules/.bin/create-nest-next-auth', f'Broken link: {path}'
                links.append(str(path.relative_to(snapshot)))
    result = {
        'captured_at_utc': datetime.now(timezone.utc).isoformat(),
        'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=SOURCE).decode().strip(),
        'snapshot': str(snapshot), 'source_files': len(before),
        'fingerprint_algorithm': 'sha256(json.dumps(path_to_sha256, sort_keys=True))',
        'source_fingerprint': digest(before), 'snapshot_fingerprint': digest(copied),
        'source_stable_during_capture': before == after,
        'source_stable_after_dependency_copy': before == inventory(SOURCE, names),
        'dependency_roots': roots, 'internal_symlinks': len(links),
        'approved_examples': sorted(EXAMPLES),
        'file_sha256': before,
    }
    (EVIDENCE / 'snapshot.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'file_sha256'}, indent=2))


if __name__ == '__main__':
    main()
