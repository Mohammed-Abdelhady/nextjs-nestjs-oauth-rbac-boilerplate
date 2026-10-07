export const AGENT_RULE_COPY: Record<string, { heading: string; sentence: string }> = {
  'Markup injection bypasses safe text and children.': {
    heading: 'Markup injection',
    sentence: 'These rules block browser APIs that treat text as markup.',
  },
  'Type escapes bypass compile-time checking.': {
    heading: 'Type escapes',
    sentence: 'These rules block casts and assertions that bypass type checks.',
  },
  'Suppression hides a failing gate instead of fixing its cause.': {
    heading: 'Hidden checks',
    sentence: 'These directives hide tool errors instead of fixing them.',
  },
  'Gate bypass flags disable required verification.': {
    heading: 'Gate bypass flags',
    sentence: 'These command flags skip required verification.',
  },
};

export const KNOWN_WORKSPACE_COPY: Record<string, string> = {
  backend: 'The NestJS API and its tests.',
  frontend: 'The Next.js web app.',
  'shared/core': 'Shared permissions and common types.',
  'shared/sdk': 'API routes, wire types, and the typed client.',
};

export const STANDARD_CODE_TEXT =
  'Follow the workspace lint rules. Inline lint configuration is refused.';

export const STANDARD_NOT_ENFORCED =
  'The banned-construct scan and file length ceiling are off. The rules level was chosen at generation. Editing `.create-nest-next-auth.json` does not switch it.';

export const AGENTS_TEMPLATE = `# Project instructions

This file gives developers and coding agents the rules for this project.

Rules level: {{level}}.

## Code

Source file limit: {{fileLineLimit}} lines.

The checker applies this limit to the source files it covers. Split long files to stay within it.

Do not use these constructs.

{{bannedConstructs}}{{explicitTypeLint}}

## Commit messages

Use the format \`type(scope): subject\` or \`type: subject\`.

- Types: {{commitTypes}}
- Scopes: {{commitScopes}}
- Subject limit: {{subjectLimit}} characters.

## Checks

Run these checks before opening a pull request. Commands come from \`scripts/ci/gates.json\`.

{{checks}}

## What enforces this

{{hooks}}
{{actions}}
{{branchProtection}}

## What is not enforced

{{notEnforced}}

## Where things are

{{whereThingsAre}}

## Package manager

Package manager: {{packageManager}} {{packageManagerVersion}}.

Use this package manager for project commands.
`;
