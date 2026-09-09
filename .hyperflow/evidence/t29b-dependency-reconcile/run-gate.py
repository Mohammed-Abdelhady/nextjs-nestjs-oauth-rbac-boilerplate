import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

EVIDENCE = Path(__file__).resolve().parent
snapshot = Path((EVIDENCE / 'snapshot-path.txt').read_text().strip())
runtime = snapshot.parent / 'verification-runtime'
for name in ['home', 'tmp', 'npm-cache']:
    (runtime / name).mkdir(parents=True, exist_ok=True)
environment = {
    'PATH': os.environ['PATH'],
    'HOME': str(runtime / 'home'),
    'TMPDIR': str(runtime / 'tmp'),
    'CI': '1',
    'NO_COLOR': '1',
    'NEXT_TELEMETRY_DISABLED': '1',
    'npm_config_cache': str(runtime / 'npm-cache'),
    'npm_config_update_notifier': 'false',
    'npm_config_audit': 'false',
    'npm_config_fund': 'false',
}
name, *command = sys.argv[1:]
started = datetime.now(timezone.utc).isoformat()
with (EVIDENCE / f'{name}.log').open('w') as log:
    process = subprocess.Popen(command, cwd=snapshot, env=environment, stdout=log, stderr=subprocess.STDOUT)
    (EVIDENCE / 'active-process.json').write_text(json.dumps({'pid': process.pid, 'command': command, 'gate': name}))
    status = process.wait()
result = {
    'command': command, 'cwd': str(snapshot), 'exit': status,
    'started_at_utc': started, 'finished_at_utc': datetime.now(timezone.utc).isoformat(),
    'node': subprocess.check_output(['node', '--version'], env=environment).decode().strip(),
    'free_disk_bytes_after': shutil.disk_usage(snapshot).free,
    'synthetic_fixture_entries_after': sorted(path.name for path in (runtime / 'tmp').iterdir()),
}
(EVIDENCE / f'{name}.json').write_text(json.dumps(result, indent=2) + '\n')
(EVIDENCE / f'{name}.status').write_text(str(status) + '\n')
(EVIDENCE / 'active-process.json').write_text(json.dumps({'state': 'exited', 'pid': process.pid, 'exit': status}))
print(json.dumps(result, indent=2))
sys.exit(status)
