import { ConfigService } from '@nestjs/config';
import { API_PATHS, OAUTH_ERROR, createApiClient } from '@app/sdk';
import { hashToken } from '../../../src/session/utils/hashing/token-hash';
import { bootE2eApp, type E2eApp } from '../../utils/e2e-app';
import { TEST_NOW } from '../../utils/frozen-clock';
import { createNativeApplication } from '../../utils/native/native-authorize.fixtures';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../utils/hook-timeouts';
import {
  isRefreshBody,
  openEngineWithDeviceKey,
  readStoredAuthRecord,
  type BoundEngineHarness,
} from '../../utils/native/native-auth-engine-harness';
import {
  ACCESS_TOKEN_MARGIN_MS,
  advanceAccessClock,
  credentialsForToken,
  isCodeExchange,
  parseProof,
  refreshTokenFrom,
  requiredSessionFields,
  tokenEntries,
} from '../../utils/native/native-auth-engine-dpop-support';

const NONCE_SECRET_KEY = 'auth.nativeDpopNonceSecret';
const OTHER_NONCE_SECRET = 'a-second-nonce-secret-of-48-characters-for-tests';
const CHALLENGE = { error: OAUTH_ERROR.USE_DPOP_NONCE };

type SentRequest = BoundEngineHarness['requests'][number];

describe('native auth engine nonce challenge (e2e)', () => {
  let e2e: E2eApp;
  let nonceSecret: unknown;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    nonceSecret = e2e.app.get(ConfigService).get<unknown>(NONCE_SECRET_KEY);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    e2e?.app.get(ConfigService).set(NONCE_SECRET_KEY, nonceSecret);
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
    const config = e2e.app.get(ConfigService);
    config.set('auth.nativeEnabled', true);
    config.set('auth.nativeDpopRequired', false);
    config.set(NONCE_SECRET_KEY, nonceSecret);
    await createNativeApplication(e2e);
  });

  /** Runs `act` just before the repeat of the first request `matches` picks. */
  function beforeRepeat(
    harness: BoundEngineHarness,
    matches: (request: SentRequest) => boolean,
    act: (request: SentRequest) => Promise<void> | void,
  ): void {
    let seen = 0;
    harness.ports.beforeTransportRequest = async (request) => {
      if (!matches(request)) return;
      seen += 1;
      if (seen === 2) await act(request);
    };
  }

  function changeNonceSecret(): void {
    e2e.app.get(ConfigService).set(NONCE_SECRET_KEY, OTHER_NONCE_SECRET);
  }

  async function codeConsumed(code: string): Promise<boolean | undefined> {
    const found = await e2e.state.native.authorizationRequestForCode(
      hashToken(code),
    );
    return found?.consumed;
  }

  async function tokenSpent(token: string): Promise<boolean | undefined> {
    return (await credentialsForToken(e2e, token))[0]?.spent;
  }

  it('signs a client in that has never seen a nonce, and the challenge leaves the code unused', async () => {
    const harness = await openEngineWithDeviceKey(e2e);
    let consumedBeforeRepeat: boolean | undefined;
    beforeRepeat(
      harness,
      ({ body }) => isCodeExchange(body),
      async ({ body }) => {
        if (isCodeExchange(body))
          consumedBeforeRepeat = await codeConsumed(body.code);
      },
    );

    const outcome = await harness.engine.signIn();
    const exchanges = tokenEntries(harness).filter(({ request }) =>
      isCodeExchange(request.body),
    );
    const codes = exchanges.flatMap(({ request }) =>
      isCodeExchange(request.body) ? [request.body.code] : [],
    );
    const nonce = exchanges[0]?.response?.headers?.['DPoP-Nonce'];

    expect(outcome.kind).toBe('signedIn');
    expect(exchanges.map(({ response }) => response?.status)).toEqual([
      400, 200,
    ]);
    expect(exchanges[0]?.response?.body).toMatchObject(CHALLENGE);
    expect(parseProof(exchanges[0]?.request).claims.nonce).toBe('');
    expect(typeof nonce).toBe('string');
    expect(parseProof(exchanges[1]?.request).claims.nonce).toBe(nonce);
    expect(codes).toHaveLength(2);
    expect(codes[1]).toBe(codes[0]);
    expect(consumedBeforeRepeat).toBe(false);
    expect(await codeConsumed(codes[0] ?? '')).toBe(true);
    expect(harness.engine.snapshot.status).toBe('signedIn');
  });

  it('ends sign-in after a second exchange challenge in a row, with two requests and no more', async () => {
    const harness = await openEngineWithDeviceKey(e2e);
    beforeRepeat(
      harness,
      ({ body }) => isCodeExchange(body),
      changeNonceSecret,
    );

    const outcome = await harness.engine.signIn();
    const exchanges = tokenEntries(harness).filter(({ request }) =>
      isCodeExchange(request.body),
    );

    expect(outcome.kind).toBe('oauthFailure');
    expect(exchanges.map(({ response }) => response?.status)).toEqual([
      400, 400,
    ]);
    expect(exchanges[1]?.response?.body).toMatchObject(CHALLENGE);
    expect(harness.engine.snapshot.status).toBe('signedOut');
    expect(await readStoredAuthRecord(harness.ports)).toBeUndefined();
  });

  it('repeats a challenged refresh with the same token, which the challenge left unspent', async () => {
    const harness = await signedIn();
    const previous = requiredSessionFields(
      await readStoredAuthRecord(harness.ports),
    );
    let spentBeforeRepeat: boolean | undefined;
    beforeRepeat(
      harness,
      ({ body }) => isRefreshBody(body),
      async () => {
        spentBeforeRepeat = await tokenSpent(previous.refreshToken);
      },
    );
    advanceAccessClock(harness, ACCESS_TOKEN_MARGIN_MS);

    const profile = await createApiClient(
      harness.engine.transport,
    ).profile.get();
    const refreshes = refreshEntries(harness);
    const next = requiredSessionFields(
      await readStoredAuthRecord(harness.ports),
    );

    expect(profile.email).toBe('user@seed.local');
    expect(refreshes.map(({ response }) => response?.status)).toEqual([
      400, 200,
    ]);
    expect(
      refreshes.map(({ request }) => refreshTokenFrom(request.body)),
    ).toEqual([previous.refreshToken, previous.refreshToken]);
    expect(spentBeforeRepeat).toBe(false);
    expect(await tokenSpent(previous.refreshToken)).toBe(true);
    expect(next.refreshToken).not.toBe(previous.refreshToken);
    expect(harness.engine.snapshot.status).toBe('signedIn');
  });

  it('stops a refresh after a second challenge in a row and leaves the token unspent', async () => {
    const harness = await signedIn();
    const previous = requiredSessionFields(
      await readStoredAuthRecord(harness.ports),
    );
    beforeRepeat(harness, ({ body }) => isRefreshBody(body), changeNonceSecret);
    advanceAccessClock(harness, ACCESS_TOKEN_MARGIN_MS);

    await expect(
      createApiClient(harness.engine.transport).profile.get(),
    ).rejects.toMatchObject(CHALLENGE);
    const refreshes = refreshEntries(harness);

    expect(refreshes.map(({ response }) => response?.status)).toEqual([
      400, 400,
    ]);
    expect(await tokenSpent(previous.refreshToken)).toBe(false);
    expect(harness.engine.snapshot).toMatchObject({
      status: 'reauthRequired',
      reason: 'refreshInterrupted',
    });
  });

  it('reports a failed revocation after a second revoke challenge in a row', async () => {
    const harness = await signedIn();
    beforeRepeat(
      harness,
      ({ path }) => path === API_PATHS.oauth.revoke,
      changeNonceSecret,
    );

    const outcome = await harness.engine.signOut();
    const revokes = tokenEntries(harness).filter(
      ({ request }) => request.path === API_PATHS.oauth.revoke,
    );

    expect(outcome).toMatchObject({ kind: 'signedOut', revocation: 'failed' });
    expect(revokes.map(({ response }) => response?.status)).toEqual([400, 400]);
    expect(revokes[1]?.response?.body).toMatchObject(CHALLENGE);
    expect(harness.engine.snapshot.status).toBe('signedOut');
  });

  async function signedIn(): Promise<BoundEngineHarness> {
    const harness = await openEngineWithDeviceKey(e2e);
    const outcome = await harness.engine.signIn();
    if (outcome.kind !== 'signedIn')
      throw new Error(`Sign in failed: ${outcome.kind}`);
    return harness;
  }
});

function refreshEntries(harness: BoundEngineHarness) {
  return tokenEntries(harness).filter(({ request }) =>
    isRefreshBody(request.body),
  );
}
