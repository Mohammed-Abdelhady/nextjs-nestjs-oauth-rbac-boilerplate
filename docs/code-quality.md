# Code Quality Guide

This guide explains the code quality automation system in place for this project, including pre-commit hooks, linting, formatting, testing requirements, and troubleshooting.

## Overview

This project uses a comprehensive code quality automation system to ensure consistent, high-quality code across all contributors. The system includes:

- **Pre-commit hooks** (Husky) - Automatically run checks before each commit
- **Linting** (ESLint) - Enforce code style and best practices
- **Formatting** (Prettier) - Consistent code formatting across the project
- **Type checking** (TypeScript) - Strict type safety for both backend and frontend
- **Commit message linting** (commitlint) - Enforce Conventional Commits format
- **Test automation** - Run relevant tests before committing

## GitHub Actions CI

The [CI workflow](../.github/workflows/ci.yml) runs on pull requests and pushes to
`master`. It uses Node.js 20 and the committed `package-lock.json` to expose three
stable checks:

- **Backend** — locked install, backend lint, forbidden-disable scan, build, and Jest tests.
- **Frontend** — locked install, ESLint, and the production Next.js build.
- **Dependency smoke** — locked-install verification, top-level dependency graph output,
  and a production dependency audit uploaded as an artifact. Known vulnerability
  advisories remain non-blocking, but registry/network/CLI failures fail the check.

The audit step is intentionally non-blocking while the existing advisory baseline is
handled by the dependency-maintenance workstream. Advisories are still printed as a
warning and retained in the workflow artifact; they are not hidden or auto-fixed by CI.

Run the same checks locally:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint --workspace backend -- --no-fix
npm run lint:check-disables --workspace backend
npm run build --workspace backend
npm test --workspace backend -- --runInBand
npm run lint --workspace frontend
npm run build --workspace frontend
npm ls --all --depth=0
npm audit --omit=dev --audit-level=high --json > audit.json 2> audit.stderr
# A non-zero exit is acceptable only when audit.json contains metadata.vulnerabilities.
# Missing/invalid audit metadata indicates an operational failure and must fail CI.
```

## Pre-commit Hooks

### What They Do

Pre-commit hooks automatically run whenever you execute `git commit`. They perform the following checks:

1. **Format code** with Prettier
2. **Lint and auto-fix** with ESLint
3. **Type-check** with TypeScript compiler
4. **Run tests** for changed files (backend only, currently)

### How They Work

The hooks are managed by [Husky](https://typicode.github.io/husky/) and configured to run [lint-staged](https://github.com/okonet/lint-staged), which only processes files that you've changed. This makes the hooks fast and efficient.

### Hook Scripts

- `.husky/pre-commit` - Runs lint-staged on staged files
- `.husky/commit-msg` - Validates commit message format with commitlint

## TypeScript Strict Mode

Both backend and frontend use strict TypeScript settings to ensure type safety:

### Backend (NestJS)

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictBindCallApply": true,
  "noFallthroughCasesInSwitch": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### Frontend (Next.js)

```json
{
  "strict": true
}
```

### ESLint Rules

Backend enforces strict type checking with these rules:

- `@typescript-eslint/no-explicit-any`: Error (disallows `any` types)
- `@typescript-eslint/no-floating-promises`: Error (requires handling promises)
- `@typescript-eslint/no-unsafe-argument`: Error (prevents unsafe type assertions)
- `@typescript-eslint/no-unused-vars`: Error (catches unused variables)
- `@typescript-eslint/no-misused-promises`: Error (prevents promise misuse)
- `@typescript-eslint/no-unnecessary-type-assertion`: Error (prevents redundant type assertions)

## Commit Message Format

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat` - A new feature
- `fix` - A bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks
- `revert` - Reverting a previous commit

### Scopes

Allowed scopes for this monorepo:

- `backend` - Changes to the NestJS backend
- `frontend` - Changes to the Next.js frontend
- `root` - Changes to root-level configuration
- `docs` - Documentation changes
- `husky` - Git hooks configuration
- `lint-staged` - Lint-staged configuration

### Examples

```bash
feat(backend): add user authentication endpoint

Implement JWT-based authentication with login and registration endpoints.

Closes #123
```

```bash
fix(frontend): resolve navigation bug on mobile devices

The navigation menu was not closing properly on mobile screens.
```

```bash
docs: update API documentation

Added documentation for new authentication endpoints.
```

### Validation

Commit messages are automatically validated by commitlint. If your message doesn't follow the format, the commit will be rejected with an error message explaining what's wrong.

## Linting and Formatting

### Prettier

Prettier is configured at the root level (`.prettierrc`) with these settings:

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "tabWidth": 2,
  "semi": true,
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "auto"
}
```

### ESLint

Both backend and frontend have ESLint configured:

- **Backend**: TypeScript ESLint with strict rules
- **Frontend**: Next.js ESLint with Prettier integration

### Running Manually

You can run linting and formatting manually:

```bash
# Format all files
npm run format

# Lint all files
npm run lint

# Lint and auto-fix
npm run lint:fix

# Type-check all files
npm run type-check
```

### Workspace-specific commands

```bash
# Backend
cd backend
npm run lint
npm run format

# Frontend
cd frontend
npm run lint
npm run format
```

## Testing Requirements

### Backend Tests

Backend uses Jest for unit and e2e testing. Tests are automatically run for changed files during pre-commit.

```bash
# Run all tests
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

### Test Configuration

Tests are configured to:

- Run only tests related to changed files (`--findRelatedTests`)
- Stop on first failure (`--bail`)
- Use up to 4 workers for parallel execution (`--maxWorkers=4`)

### Frontend Tests

Frontend tests are not yet configured but will be added in the future.

## Troubleshooting

### Pre-commit Hooks Not Running

**Problem**: Hooks don't execute when you commit.

**Solutions**:

1. Ensure hooks are installed:

   ```bash
   npm run prepare
   ```

2. Check if hooks are executable:

   ```bash
   ls -la .husky/
   ```

   The files should have execute permissions (`-rwxr-xr-x`).

3. If hooks were bypassed with `--no-verify`, reinstall them:
   ```bash
   npm run prepare
   ```

### Commit Message Rejected

**Problem**: commitlint rejects your commit message.

**Solutions**:

1. Check the error message for specific issues
2. Ensure format: `<type>(<scope>): <subject>`
3. Keep subject under 72 characters
4. Use one of the allowed types and scopes

**Example of invalid message**:

```
Added new feature
```

**Correct format**:

```
feat(backend): add user authentication
```

### Linting Errors Blocking Commit

**Problem**: ESLint errors prevent committing.

**Solutions**:

1. Run lint with auto-fix:

   ```bash
   npm run lint:fix
   ```

2. Fix errors manually in your editor
3. If you must commit temporarily (not recommended):
   ```bash
   git commit --no-verify -m "your message"
   ```

### Type Errors Blocking Commit

**Problem**: TypeScript type errors prevent committing.

**Solutions**:

1. Run type-check to see all errors:

   ```bash
   npm run type-check
   ```

2. Fix type errors by:
   - Adding proper type annotations
   - Using `unknown` instead of `any`
   - Fixing type mismatches

3. For temporary suppression (use sparingly):
   ```typescript
   // @ts-expect-error - TODO: fix this type error
   const data = someFunction();
   ```

### Tests Failing on Commit

**Problem**: Tests fail during pre-commit hook.

**Solutions**:

1. Run tests manually to see full output:

   ```bash
   cd backend
   npm test -- --bail --findRelatedTests
   ```

2. Fix failing tests
3. If tests are unrelated to your changes, skip them temporarily:
   ```bash
   git commit --no-verify -m "your message"
   ```

### Hooks Too Slow

**Problem**: Pre-commit hooks take too long to run.

**Solutions**:

1. Check which files are being staged:

   ```bash
   git diff --cached --name-only
   ```

2. Unstage files you don't want to commit yet:

   ```bash
   git reset HEAD <file>
   ```

3. For large changes, consider splitting into smaller commits

4. If absolutely necessary, bypass hooks (not recommended):
   ```bash
   git commit --no-verify -m "your message"
   ```

### Prettier Formatting Issues

**Problem**: Prettier reformats code unexpectedly.

**Solutions**:

1. Check `.prettierrc` settings at project root
2. Ensure your editor uses the same Prettier configuration
3. For specific files that shouldn't be formatted, add to `.prettierignore`

### ESLint and Prettier Conflicts

**Problem**: ESLint and Prettier have conflicting rules.

**Solutions**:

1. This project uses `eslint-config-prettier` to disable conflicting ESLint rules
2. If conflicts persist, check your ESLint configuration
3. Ensure Prettier plugin is loaded after other ESLint configs

## Best Practices

### Before Committing

1. **Stage only what you need**: Only stage files you want to commit
2. **Run checks manually**: Use `npm run lint` and `npm run type-check` before committing
3. **Write good commit messages**: Follow Conventional Commits format
4. **Keep commits focused**: One logical change per commit
5. **Test your changes**: Ensure tests pass before committing

### Writing Code

1. **Use TypeScript types**: Avoid `any` types, use proper type annotations
2. **Follow naming conventions**:
   - Classes: `PascalCase`
   - Functions/variables: `camelCase`
   - Constants: `UPPER_SNAKE_CASE`
3. **Write tests**: Add tests for new features and bug fixes
4. **Keep functions small**: Single responsibility principle
5. **Use meaningful names**: Self-documenting code

### Working with Hooks

1. **Don't bypass hooks**: Only use `--no-verify` in emergencies
2. **Fix issues immediately**: Don't let linting errors accumulate
3. **Learn from errors**: Understand why hooks are failing
4. **Ask for help**: If you're stuck, consult the team

## FAQ

**Q: Can I disable pre-commit hooks?**

A: Yes, but it's not recommended. Use `git commit --no-verify` to bypass hooks. This should only be done in emergencies or for WIP commits.

**Q: Why are my commits rejected?**

A: Check the error message. Common reasons:

- Invalid commit message format
- Linting errors
- Type errors
- Failing tests

**Q: How do I fix `any` type errors?**

A: Replace `any` with proper types:

- Use `unknown` for truly unknown data
- Create interfaces or types for your data
- Use type guards for runtime checks

**Q: Can I change the Prettier configuration?**

A: Yes, edit `.prettierrc` at the project root. Changes will affect all developers, so discuss with the team first.

**Q: What if I need to commit code with temporary errors?**

A: Use `git commit --no-verify -m "your message"`. Add a TODO comment to fix the errors later.

**Q: How do I add new commit types or scopes?**

A: Edit `commitlint.config.js` to add new types to `type-enum` or new scopes to `scope-enum`.

**Q: Why are tests running on my frontend changes?**

A: Frontend tests are not yet configured. Only backend tests run during pre-commit. This will be added in the future.

**Q: Can I run hooks manually?**

A: Yes, run `npx lint-staged` to execute the pre-commit hook manually.

**Q: How do I check if hooks are installed?**

A: Run `ls -la .husky/` to see the hook scripts. They should be executable.

**Q: What's the difference between `npm run lint` and `npm run lint:fix`?**

A: `npm run lint` checks for errors, `npm run lint:fix` automatically fixes fixable issues.

## Additional Resources

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/okonet/lint-staged)
- [commitlint Documentation](https://commitlint.js.org/)
- [Prettier Documentation](https://prettier.io/)
- [ESLint Documentation](https://eslint.org/)
- [TypeScript Documentation](https://www.typescriptlang.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Next.js Documentation](https://nextjs.org/docs)

## Getting Help

If you encounter issues not covered in this guide:

1. Check the error message carefully
2. Search the documentation for related topics
3. Ask a team member for help
4. Create an issue in the project repository

Remember: The code quality automation system is here to help you write better code, not to hinder your productivity. Embrace it, and you'll see the benefits in code quality and team collaboration.
