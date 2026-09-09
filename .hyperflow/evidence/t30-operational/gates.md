# Runtime commands awaiting root's window

These commands were not run in this batch. Start only after root reconciles the native fixture/source boundary and grants capacity. Keep ports 3107/5107/5108 free for the sequential browser job. Use Node 22.12 or newer within the Node 22 line and npm 10.9 or newer. Confirm disk capacity before install/build.

Create a new owned temporary parent and export from the reconciled source revision. The export intentionally omits all environment examples; restore only the three approved tracked examples for CLI gates. Do not copy inherited environment files or dependency directories.

```sh
T30_RUN=$(mktemp -d /private/tmp/t30-runtime-XXXXXX)
T30_CAPTURE="$T30_RUN/source"
mkdir -p "$T30_RUN/tool-home" "$T30_RUN/docker-config"
env -i PATH="$PATH" node scripts/verify-docker.mjs --check-checkout
env -i PATH="$PATH" node scripts/verify-docker.mjs --export "$T30_CAPTURE"
for example in .env.docker.example backend/.env.example frontend/.env.example; do
  git show "HEAD:$example" > "$T30_CAPTURE/$example"
done
cd "$T30_CAPTURE"
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm ci
```

Record the lockfile hash before and after install, plus Node/npm versions. Run the repository's final gates from this permitted capture. Root should coordinate these with the native owner to avoid duplicate heavy checks.

```sh
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run lint
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run typecheck
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run test
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run build
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run test:combinations -w packages/create-nest-next-auth
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run test:e2e -w backend -- --runInBand
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true NEXT_PUBLIC_API_URL=http://127.0.0.1:5107 npm run build -w frontend
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm exec --workspace frontend --no -- playwright install chromium
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run test:e2e -w frontend -- --config=playwright.frontend.config.ts
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" CI=true npm run test:e2e -w frontend
```

The root test command includes the CLI packed suite, including the new exclusion case. Inspect executed, skipped, failed and flaky browser counts. Preserve the original failure code and let fixture cleanup finish. Final generated selections must still typecheck and their workflows must not require `packages/` or maintainer evidence directories.

Build Docker images from the safe capture. Docker contexts exclude the restored example files too. The commands below use Linux's default local socket. On Docker Desktop, append an explicitly verified local `DOCKER_HOST=unix:///.../docker.sock` to the clean Docker command environment, and pass the same socket using the helper's `--docker-host` option. Do not load a user Docker context/config to find it. Check that Compose is discoverable with the empty config before builds; return a missing-plugin problem to root.

```sh
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" docker --config "$T30_RUN/docker-config" compose version
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" docker --config "$T30_RUN/docker-config" build --target production -f backend/Dockerfile -t authboiler-smoke-backend:local .
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" docker --config "$T30_RUN/docker-config" build --target production -f frontend/Dockerfile --build-arg NEXT_PUBLIC_API_URL=http://127.0.0.1:5107 -t authboiler-smoke-frontend:local .
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" docker --config "$T30_RUN/docker-config" build -f nginx/Dockerfile -t authboiler-smoke-nginx:local nginx
env -i PATH="$PATH" HOME="$T30_RUN/tool-home" docker --config "$T30_RUN/docker-config" pull mongo:7
env -i PATH="$PATH" node scripts/verify-docker.mjs
```

Required real evidence is three successful production image builds, healthy synthetic Mongo/backend/frontend/nginx services, exact HTTP health without redirect, minimal backend health payload, English/Arabic login documents and disabled external auth methods. Record actual startup duration, bounded status diagnostics and project resource cleanup. Do not run production Compose directly or start certbot. Production TLS remains unverified.

A later bounded runtime assignment should cover real missing-image, startup-failure and readiness-timeout cleanup without modifying another worker's image tags or resources. The lightweight harness already covers these control paths using a fake executable and a direct subprocess timeout test. It does not substitute for daemon-side teardown evidence. Remove only the runtime assignment's named temporary directory and owned resources after recording results; no global prune.
