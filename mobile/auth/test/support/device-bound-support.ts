import { HTTP_METHOD } from '@app/sdk';
import { Buffer } from 'node:buffer';
import { createAuthEngine } from './engine';
import { SoftwareDeviceKey } from './software-device-key';
import { CONFIG, ScriptedTransport, acceptCode, successUserReply, testPorts } from './support';

export function requestPayload(proof: string): Record<string, unknown> {
  const payload = proof.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function dpopTokenReply(
  accessToken = 'access-secret-0',
  refreshToken = 'refresh-secret-0',
  expiresIn = 300,
) {
  return {
    status: 200,
    body: {
      access_token: accessToken,
      token_type: 'DPoP',
      expires_in: expiresIn,
      refresh_token: refreshToken,
      scope: 'api',
    },
  };
}

export function refreshRequests(transport: ScriptedTransport) {
  return transport.sent.filter(({ path, body }) => {
    if (path !== '/api/oauth/token' || typeof body !== 'object' || body === null) return false;
    return 'grant_type' in body && body.grant_type === 'refresh_token';
  });
}

export async function establishBoundSession(transport = new ScriptedTransport()) {
  const deviceKey = new SoftwareDeviceKey();
  const ports = testPorts(transport, deviceKey);
  transport.enqueue(dpopTokenReply(), successUserReply());
  acceptCode(ports.authBrowser, 'bound-code');
  const engine = createAuthEngine(CONFIG, ports);
  await engine.restore();
  const outcome = await engine.signIn();
  return { engine, ports, transport, deviceKey, outcome };
}

export async function requestProfile(engine: ReturnType<typeof createAuthEngine>) {
  return engine.transport.request({ method: HTTP_METHOD.GET, path: '/api/user/profile' });
}
