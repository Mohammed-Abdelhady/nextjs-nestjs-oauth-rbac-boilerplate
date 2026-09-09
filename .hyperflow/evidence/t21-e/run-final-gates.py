import os, json, subprocess, time, sys
from pathlib import Path
ROOT = Path("/Users/mohammedabdelhady/Documents/ref/nextjs-nestjs-oauth-rbac-boilerplate")
SAFE = Path("/var/folders/d1/tk4y3j012j57stv_sy0qpglr0000gn/T/t29b-safe-jke84nuk")
OUT = ROOT / ".hyperflow/evidence/t21-e/node22"
BIN = OUT / "node-v22.18.0-darwin-arm64/bin"
env = {"PATH": str(BIN) + ":/usr/bin:/bin:/usr/sbin:/sbin", "HOME": str(OUT / "tool-home"), "TMPDIR": os.environ.get("TMPDIR", "/tmp"), "NPM_CONFIG_USERCONFIG": str(OUT / "user-npmrc"), "NPM_CONFIG_GLOBALCONFIG": str(OUT / "global-npmrc"), "NEXT_PUBLIC_API_URL": "http://127.0.0.1:5107", "PLAYWRIGHT_CHROMIUM_CHANNEL": "chrome"}
gates = [
 ("root-build", ["npm", "run", "build"], 420),
 ("root-lint", ["npm", "run", "lint"], 180),
 ("root-types", ["npm", "run", "typecheck"], 180),
 ("backend-unit", ["npm", "test", "-w", "backend", "--", "--runInBand"], 300),
 ("frontend-unit", ["npm", "test", "-w", "frontend"], 180),
 ("backend-e2e", ["npm", "run", "test:e2e", "-w", "backend", "--", "--runInBand"], 300),
 ("cli-unit", ["npm", "test", "-w", "packages/create-nest-next-auth"], 300),
 ("cli-combinations", ["npm", "run", "test:combinations", "-w", "packages/create-nest-next-auth"], 600),
 ("anonymous-browser", ["node", "node_modules/@playwright/test/cli.js", "test", "--config", "frontend/playwright.frontend.config.ts"], 600),
 ("application-browser", ["node", "node_modules/@playwright/test/cli.js", "test", "--config", "frontend/playwright.config.ts"], 900),
 ("npm-pack", ["npm", "pack", "-w", "packages/create-nest-next-auth", "--pack-destination", str(OUT)], 180),
 ("npm-publish-dry-run", ["npm", "publish", "--dry-run", "-w", "packages/create-nest-next-auth"], 180),
]
results_path = OUT / "gate-results.json"
results = json.loads(results_path.read_text()) if results_path.exists() else []
for name, cmd, timeout in gates:
 if sys.argv[1:] and name not in sys.argv[1:]:
  continue
 print("START " + name, flush=True)
 start = time.time()
 with (OUT / (name + ".log")).open("w") as log:
  try:
   result = subprocess.run(cmd, cwd=SAFE, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=timeout)
   code = result.returncode
  except subprocess.TimeoutExpired:
   code = 124
 results.append({"gate": name, "command": cmd, "exit": code, "seconds": round(time.time()-start, 2)})
 (OUT / "gate-results.json").write_text(json.dumps(results, indent=2) + "\n")
 print("END " + name + " exit=" + str(code), flush=True)
 if code:
  raise SystemExit(code)
