# Markers

Deleting a method's files is not enough: the module that registers it, the page
that renders it and the barrel that re-exports it all live in shared files. Those
lines carry a marker naming the feature they belong to, and the CLI deletes them
for a method that was not picked. The markers of the methods that stay are
stripped, so a generated project carries none.

```ts
import { PasskeysModule } from './auth/passkeys/passkeys.module'; // feature:passkeys

// feature:totp:start
import {
  TwoFactorChallenge,
  TwoFactorChallengeSchema,
} from './two-factor/schemas/two-factor-challenge.schema';
// feature:totp:end
```

Rules:

- `// feature:<id>` at the end of a line marks that one line.
- `// feature:<id>:start` and `// feature:<id>:end`, each on a line of its own,
  mark everything between them. A block marker may not share a line with code.
- In JSX use `{/* feature:<id> */}` and `{/* feature:<id>:start */}` /
  `{/* feature:<id>:end */}`. Both forms work in any file; the JSX form is there
  for places where `//` would land inside markup.
- Several ids on one marker, `// feature:totp,passkeys`, mean **any of them**:
  the line stays if at least one is selected. For **all of them**, nest blocks.
- Blocks nest. The `:end` has to name the block it closes.
- Every id has to exist in the manifest, and a marker that names something else
  fails the run with the file and line. That is on purpose: a typo would
  otherwise delete the line from every project.
- Markers are read in `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs` and `.cjs` files.
  JSON is left alone; markdown uses `<!-- feature:id:start -->` and
  `<!-- feature:id:end -->` blocks with the same rules.

Mark the smallest thing that compiles on its own. An import that only one method
uses, the provider line in a module, the JSX element, the assertion in a spec.
Where removing a line would leave an unused variable or an empty block, mark the
variable and the block too, or move the shared part out of the feature's reach,
the way `TWO_FACTOR_CLIENT_PATH` sits in `common/constants/client-paths.ts`.

## Adding a method

1. Land the code in the boilerplate, keeping everything the method owns inside
   its own directory.
2. Add the entry, listing every file that belongs to that method alone and every
   env var it reads.
3. Mark the lines shared files needed for it.
4. Add the combination to `test/combinations.slow.test.ts` and run
   `npm run test:combinations -w packages/create-nest-next-auth`. It scaffolds a
   project per combination and typechecks both workspaces, and it checks that a
   project with everything selected matches the repository with the markers
   taken off.

The reference check is the other honest signal. If dropping a method leaves an
import pointing at a deleted file, either the file is shared and does not belong
in `files`, or the line needed a marker.
