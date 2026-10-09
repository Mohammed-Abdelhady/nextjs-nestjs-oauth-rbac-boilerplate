import { describe, expect, it } from 'vitest';
import {
  clearBrowserProof,
  currentBrowserProof,
  methodNeedsBrowserProof,
  rememberBrowserProof,
  takeBrowserProof,
} from '../browser-proof';

describe('browser proof memory', () => {
  it('keeps a session proof across requests and drops a pre-session proof once taken', () => {
    clearBrowserProof();
    rememberBrowserProof(null, 'session');
    expect(currentBrowserProof()).toBe('');
    rememberBrowserProof('proof-1', 'session');
    expect(currentBrowserProof()).toBe('proof-1');
    expect(takeBrowserProof()).toBe('proof-1');
    expect(takeBrowserProof()).toBe('proof-1');

    rememberBrowserProof('pre-1', 'pre-session');
    expect(currentBrowserProof()).toBe('pre-1');
    expect(takeBrowserProof()).toBe('pre-1');
    expect(takeBrowserProof()).toBe('');
    expect(currentBrowserProof()).toBe('');
  });

  it('ignores empty values and clears on demand', () => {
    clearBrowserProof();
    rememberBrowserProof('proof-1', 'session');
    rememberBrowserProof('', 'session');
    rememberBrowserProof(null, 'pre-session');
    expect(currentBrowserProof()).toBe('proof-1');
    clearBrowserProof();
    expect(currentBrowserProof()).toBe('');
  });

  it('asks for a proof only on unsafe methods', () => {
    expect(methodNeedsBrowserProof(undefined)).toBe(false);
    expect(methodNeedsBrowserProof('get')).toBe(false);
    expect(methodNeedsBrowserProof('POST')).toBe(true);
    expect(methodNeedsBrowserProof('delete')).toBe(true);
  });
});
