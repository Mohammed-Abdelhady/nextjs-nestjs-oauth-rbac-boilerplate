import { describe, expect, it } from 'vitest';
import { createTimerPort } from '../src/ports/timer';
import { createFetchTransport } from '../src/transport';
import type { FetchInit, FetchResponseApi, HttpApi } from '../src/types/modules';
import { TestAbort } from './support/abort';
import { FakeTime } from './support/fake-modules';
import { settle } from './support/subject';

const ORIGIN = 'http://localhost:5001';
const DEADLINE_MS = 20_000;

interface FakeSignal {
  aborted: boolean;
}

/** `fetch` and `AbortController`: answers from a script, rejects when aborted. */
class FakeHttp implements HttpApi<FakeSignal> {
  readonly sent: { address: string; init: FetchInit<FakeSignal> }[] = [];
  answer: { status: number; text: string; headers?: Record<string, string> } | 'hang' | Error = {
    status: 200,
    text: '',
  };

  fetch(address: string, init: FetchInit<FakeSignal>): Promise<FetchResponseApi> {
    this.sent.push({ address, init });
    const { answer } = this;
    if (init.signal.aborted) return Promise.reject(new Error('Aborted'));
    if (answer instanceof Error) return Promise.reject(answer);
    if (answer !== 'hang') {
      const { headers } = answer;
      return Promise.resolve({
        status: answer.status,
        text: async () => answer.text,
        // `fetch` matches a header name whatever its case.
        headers: { get: (name: string) => headers?.[name.toLowerCase()] ?? null },
      });
    }
    return new Promise((_resolve, reject) => {
      this.rejectHanging = () => reject(new Error('Aborted'));
    });
  }

  createAbort(): { signal: FakeSignal; abort(): void } {
    const signal: FakeSignal = { aborted: false };
    return {
      signal,
      abort: () => {
        signal.aborted = true;
        this.rejectHanging?.();
      },
    };
  }

  private rejectHanging: (() => void) | undefined;
}

function setup() {
  const http = new FakeHttp();
  const time = new FakeTime();
  const transport = createFetchTransport(http, createTimerPort(time), ORIGIN, DEADLINE_MS);
  return { http, time, transport };
}

describe('fetch transport', () => {
  it('hands on the nonce of a DPoP challenge, and no other response header', async () => {
    const { http, transport } = setup();
    http.answer = {
      status: 400,
      text: '{"error":"use_dpop_nonce"}',
      headers: { 'dpop-nonce': 'nonce-1', 'cache-control': 'no-store' },
    };

    const response = await transport.request({ method: 'POST', path: '/api/oauth/token' });

    expect(response).toEqual({
      status: 400,
      body: { error: 'use_dpop_nonce' },
      headers: { 'DPoP-Nonce': 'nonce-1' },
    });
  });

  it('returns no headers when the response carries no nonce', async () => {
    const { http, transport } = setup();
    http.answer = { status: 200, text: '{}', headers: { 'cache-control': 'no-store' } };

    const response = await transport.request({ method: 'GET', path: '/api/user/profile' });

    expect(response).toEqual({ status: 200, body: {} });
  });

  it('sends a JSON body to the origin plus the path, without cookies', async () => {
    const { http, transport } = setup();
    http.answer = { status: 201, text: '{"success":true,"data":{"id":"1"}}' };

    const response = await transport.request({
      method: 'POST',
      path: '/api/oauth/token?x=1',
      headers: { Authorization: 'Bearer t', 'content-type': 'text/plain' },
      body: { grant_type: 'refresh_token' },
    });

    expect(response).toEqual({ status: 201, body: { success: true, data: { id: '1' } } });
    expect(http.sent).toEqual([
      {
        address: 'http://localhost:5001/api/oauth/token?x=1',
        init: {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: 'Bearer t',
            'Content-Type': 'application/json',
          },
          body: '{"grant_type":"refresh_token"}',
          credentials: 'omit',
          signal: { aborted: false },
        },
      },
    ]);
  });

  it('sends no body and no content type for a request without one', async () => {
    const { http, transport } = setup();

    await transport.request({ method: 'GET', path: '/api/user/profile' });

    expect(http.sent[0]?.init.body).toBeUndefined();
    expect(http.sent[0]?.init.headers).toEqual({ Accept: 'application/json' });
  });

  it.each([
    [204, '', undefined],
    [502, '<html>Bad Gateway</html>', undefined],
    [401, '{"success":false,"error":{"code":"UNAUTHORIZED"}}', { code: 'UNAUTHORIZED' }],
  ])('resolves status %i with the parsed body or none', async (status, text, error) => {
    const { http, transport } = setup();
    http.answer = { status, text };

    const response = await transport.request({ method: 'GET', path: '/api/user/profile' });

    expect(response).toEqual({
      status,
      body: error === undefined ? undefined : { success: false, error },
    });
  });

  it('aborts the request when the caller aborts, and drops its listener afterwards', async () => {
    const { http, transport } = setup();
    http.answer = 'hang';
    const abort = new TestAbort();
    const pending = transport.request({ method: 'GET', path: '/slow', signal: abort.signal });
    await settle();

    abort.abort();

    await expect(pending).rejects.toThrow('Aborted');
    expect(http.sent[0]?.init.signal.aborted).toBe(true);
    expect(abort.listenerCount).toBe(0);
  });

  it('hands fetch an aborted signal when the caller aborted before the call', async () => {
    const { transport } = setup();
    const abort = new TestAbort();
    abort.abort();

    await expect(
      transport.request({ method: 'GET', path: '/x', signal: abort.signal }),
    ).rejects.toThrow('Aborted');
  });

  it('ends a request that outlives the deadline, one millisecond late and not before', async () => {
    const { http, time, transport } = setup();
    http.answer = 'hang';
    let outcome = 'pending';
    const pending = transport.request({ method: 'GET', path: '/slow' }).catch((error: Error) => {
      outcome = error.message;
    });

    time.advance(DEADLINE_MS - 1);
    await settle();
    expect(outcome).toBe('pending');
    time.advance(1);
    await pending;

    expect(outcome).toBe('The request passed its deadline.');
  });

  it('clears the deadline once the response has arrived', async () => {
    const { time, transport } = setup();

    await transport.request({ method: 'GET', path: '/api/user/profile' });

    expect(time.pendingTimers).toBe(0);
  });

  it('passes a network failure on as it came', async () => {
    const { http, time, transport } = setup();
    http.answer = new TypeError('Network request failed');

    await expect(transport.request({ method: 'GET', path: '/x' })).rejects.toThrow(
      'Network request failed',
    );
    expect(time.pendingTimers).toBe(0);
  });
});
