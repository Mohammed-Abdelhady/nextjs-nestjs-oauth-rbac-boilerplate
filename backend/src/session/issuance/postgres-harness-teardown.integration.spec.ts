import {
  POSTGRES_BOOT_TIMEOUT_MS,
  POSTGRES_TEARDOWN_TIMEOUT_MS,
} from '../../../test/postgres-prototype/server/postgres-test-server';
import {
  StartedFixtureRun,
  startFixtureSuites,
} from '../../../test/postgres-prototype/teardown-fixtures/run-fixture-suites';

const ABANDONING_SUITE = 'a suite whose cases abandon open work';
const NEXT_SUITE = 'the suite that runs next';
const FAILED_BOOT_SUITE = 'a suite whose boot fails part way';
// Three suites boot a server each and stop it, on the budgets those hooks have.
const THREE_SUITES_MS =
  3 * (POSTGRES_BOOT_TIMEOUT_MS + POSTGRES_TEARDOWN_TIMEOUT_MS);

/**
 * A case that fails or runs out of its budget leaves a transaction open and a
 * connection checked out, and a boot can fail with its server already up. The
 * harness must still leave the next case empty tables, stop its server and let
 * the process end.
 */
describe('PostgreSQL harness teardown after abandoned work', () => {
  let run: StartedFixtureRun | undefined;

  afterEach(() => {
    run?.kill();
    run = undefined;
  });

  it(
    'cleans up after each failed case and a failed boot, lets the next suite start, and the process exits by itself',
    async () => {
      run = startFixtureSuites();

      const outcome = await run.finished;

      expect(outcome).toEqual({
        exitCode: 1,
        cases: [
          {
            suite: ABANDONING_SUITE,
            title: 'fails with an account held and a second writer waiting',
            status: 'failed',
          },
          {
            suite: ABANDONING_SUITE,
            title: 'starts the next case on empty tables',
            status: 'passed',
          },
          {
            suite: ABANDONING_SUITE,
            title:
              'fails again as the last case, so teardown meets the open work',
            status: 'failed',
          },
          {
            suite: NEXT_SUITE,
            title: 'starts on empty tables and stores its own account',
            status: 'passed',
          },
          {
            suite: FAILED_BOOT_SUITE,
            title: 'never runs its case',
            status: 'failed',
          },
        ],
      });
    },
    THREE_SUITES_MS,
  );
});
