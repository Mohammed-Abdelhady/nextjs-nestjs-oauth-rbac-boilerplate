import { isDeepStrictEqual } from 'node:util';

// This function is serialized into the existing backend container; keep it self-contained.
export async function runHttpProbes(
  fetchResponse = fetch,
  timeout = 10_000,
  maxBytes = 1024 * 1024,
) {
  const targets = [
    { name: 'backend-health', url: 'http://backend:5000/health' },
    { name: 'nginx-health', url: 'http://nginx:8080/health' },
    { name: 'frontend-en', url: 'http://frontend:3000/en/auth/login', locale: 'en' },
    { name: 'frontend-ar', url: 'http://frontend:3000/ar/auth/login', locale: 'ar' },
    { name: 'auth-methods', url: 'http://backend:5000/api/auth/methods' },
  ];
  const checked = [];
  for (const target of targets) {
    let response;
    let body = '';
    let size = 0;
    const signal = AbortSignal.timeout(timeout);
    try {
      response = await fetchResponse(target.url, { redirect: 'manual', signal });
      if (response.status !== 200 || response.headers.get('location') !== null) {
        await response.body?.cancel().catch(() => undefined);
        return { failure: target.name, reason: 'unexpected HTTP status or redirect' };
      }
      const decoder = new TextDecoder();
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) {
          return { failure: target.name, reason: 'response too large' };
        }
        body += decoder.decode(chunk, { stream: true });
      }
      body += decoder.decode();
    } catch {
      return {
        failure: target.name,
        reason: signal.aborted ? 'request timed out' : 'request failed',
      };
    }
    if (target.locale) {
      if (!body.includes(`lang="${target.locale}"`) || !body.includes('<form')) {
        return { failure: target.name, reason: 'login document contract' };
      }
    } else {
      let value;
      try {
        value = JSON.parse(body);
      } catch {
        return { failure: target.name, reason: 'invalid JSON' };
      }
      if (target.name === 'backend-health') {
        if (
          !value ||
          Object.keys(value).sort().join(',') !== 'status,timestamp' ||
          value.status !== 'healthy' ||
          !Number.isFinite(Date.parse(value.timestamp))
        )
          return { failure: target.name, reason: 'health response contract' };
      } else if (target.name === 'nginx-health') {
        if (!value || Object.keys(value).join(',') !== 'status' || value.status !== 'healthy') {
          return { failure: target.name, reason: 'health response contract' };
        }
      } else {
        const methods = value?.data?.methods;
        if (
          !methods ||
          typeof methods.password !== 'boolean' ||
          methods.magicLink ||
          methods.twoFactor ||
          methods.passkeys ||
          (methods.oauth && (!Array.isArray(methods.oauth) || methods.oauth.length !== 0))
        )
          return { failure: target.name, reason: 'auth method contract' };
      }
    }
    checked.push(target.name);
  }
  return { checked };
}

export function httpProbeProgram() {
  return `const result = await (${runHttpProbes.toString()})(); process.stdout.write(JSON.stringify(result));`;
}

export function validateProbeResults(output) {
  let result;
  try {
    result = JSON.parse(output);
  } catch {
    throw new Error('container HTTP probes: invalid result JSON');
  }
  const names = ['backend-health', 'nginx-health', 'frontend-en', 'frontend-ar', 'auth-methods'];
  const reasons = [
    'unexpected HTTP status or redirect',
    'response too large',
    'request timed out',
    'request failed',
    'login document contract',
    'invalid JSON',
    'health response contract',
    'auth method contract',
  ];
  if (names.includes(result?.failure) && reasons.includes(result?.reason)) {
    throw new Error(`${result.failure}: ${result.reason}`);
  }
  if (!isDeepStrictEqual(result, { checked: names })) {
    throw new Error('container HTTP probe result contract');
  }
}
