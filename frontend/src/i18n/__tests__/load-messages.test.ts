import { readFileSync } from 'node:fs'; // feature:locale-ar
import { fileURLToPath } from 'node:url'; // feature:locale-ar
import { describe, expect, it } from 'vitest';
import { mergeMessageTrees } from '../load-messages';
// feature:locale-ar:start
import type { MessageTree } from './message-tree';
import { isMessageTree } from './message-tree';

function readOverlay(name: string, locale: string): MessageTree {
  const parsed: unknown = JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../messages/${name}.${locale}.json`, import.meta.url)),
      'utf8',
    ),
  );
  if (!isMessageTree(parsed)) {
    throw new Error(`${name}.${locale}.json is not an object`);
  }
  return parsed;
}

function flatten(tree: MessageTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      keys.push(path);
      continue;
    }
    keys.push(...flatten(value, path));
  }
  return keys;
}

const OVERLAYS = [
  'session-authority',
  'browser-proof',
  'native-auth',
  'status-errors',
  'role-errors',
];
// feature:locale-ar:end

describe('session authority locale overlays', () => {
  it('keeps sibling catalog keys when overlaying nested error codes', () => {
    const merged = mergeMessageTrees(
      { errors: { codes: { SESSION_EXPIRED: 'expired', SESSION_INVALID: 'invalid' } } },
      { errors: { codes: { SESSION_LIMIT_REACHED: 'limit' } } },
    );

    expect(merged).toEqual({
      errors: {
        codes: {
          SESSION_EXPIRED: 'expired',
          SESSION_INVALID: 'invalid',
          SESSION_LIMIT_REACHED: 'limit',
        },
      },
    });
  });

  // feature:locale-ar:start
  it('ships the same overlay keys in English and Arabic', () => {
    for (const name of OVERLAYS) {
      expect(flatten(readOverlay(name, 'en')).sort()).toEqual(
        flatten(readOverlay(name, 'ar')).sort(),
      );
    }
    const english = flatten(readOverlay('session-authority', 'en'));
    expect(english).toContain('errors.codes.SESSION_LIMIT_REACHED');
    expect(english).toContain('errors.codes.AUTHORITY_UNAVAILABLE');
  });
  // feature:locale-ar:end
});
