import { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../src/common/enums/error-code.enum';
import { SEED_USER } from '../constants/seed-users';
import { bootE2eApp, browserAgent, type E2eApp } from '../utils/e2e-app';
import { TEST_NOW } from '../utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../utils/hook-timeouts';

describe('magic link whose stored expiry has passed (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await bootE2eApp();
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await e2e?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    e2e.clock.set(TEST_NOW);
    await e2e.reset();
    e2e.app.get(ConfigService).set('magicLink.enabled', true);
  });

  async function mailedToken(): Promise<string> {
    const requester = await browserAgent(e2e.httpServer);
    await requester
      .post('/api/auth/magic-link/request')
      .send({ email: SEED_USER.email })
      .expect(200);
    const link = e2e.mail.at(-1)?.text?.match(/https?:\/\/[^\s]+/)?.[0];
    const token = link ? new URL(link).searchParams.get('token') : null;
    if (!token) throw new Error('Magic link mail has no token');
    return token;
  }

  it('refuses the link and signs nobody in, with the clock still inside its lifetime', async () => {
    const token = await mailedToken();
    await e2e.state.auth.expireMagicLinks();

    const verifier = await browserAgent(e2e.httpServer);
    const refused = await verifier
      .post('/api/auth/magic-link/verify')
      .send({ token });

    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({
      success: false,
      error: { code: ErrorCode.MAGIC_LINK_INVALID },
    });
    expect(await e2e.state.sessions.countSessions()).toBe(0);
  });

  it('accepts the same kind of link when nothing expired it', async () => {
    const token = await mailedToken();

    const verifier = await browserAgent(e2e.httpServer);
    await verifier
      .post('/api/auth/magic-link/verify')
      .send({ token })
      .expect(200);

    expect(await e2e.state.sessions.countSessions()).toBe(1);
  });
});
