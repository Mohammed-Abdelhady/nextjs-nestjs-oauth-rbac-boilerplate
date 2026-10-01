import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mergeMessageTrees } from '../load-messages';
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

  it('ships the same overlay keys in English and Arabic', () => {
    for (const name of ['session-authority', 'browser-proof', 'native-auth']) {
      expect(flatten(readOverlay(name, 'en')).sort()).toEqual(
        flatten(readOverlay(name, 'ar')).sort(),
      );
    }
    const english = flatten(readOverlay('session-authority', 'en'));
    expect(english).toContain('errors.codes.SESSION_LIMIT_REACHED');
    expect(english).toContain('errors.codes.AUTHORITY_UNAVAILABLE');
  });
});
