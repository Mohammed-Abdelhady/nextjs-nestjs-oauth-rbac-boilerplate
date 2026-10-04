import { readFileSync } from 'node:fs'; // feature:locale-ar
import { fileURLToPath } from 'node:url'; // feature:locale-ar
import { describe, expect, it } from 'vitest';
import { loadMessages, mergeMessageTrees } from '../load-messages';
import codeVerificationEn from '../messages/code-verification.en.json';
import { lookupMessage } from './message-tree';
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
  'session-kinds',
  'code-verification',
  'admin-users',
  'admin-email-confirmation',
  'profile-settings',
];
// feature:locale-ar:end

/** The two code-step keys the code-verification overlay rewrites. */
const CODE_STEP_KEYS = [
  'errors.codes.ACTIVATION_CODE_INVALID',
  'errors.codes.PASSWORD_RESET_CODE_INVALID',
];

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

  it('resolves the code-step messages to the overlay in English', async () => {
    const merged = await loadMessages('en');

    for (const key of CODE_STEP_KEYS) {
      expect(lookupMessage(merged, key)).toBe(lookupMessage(codeVerificationEn, key));
    }
  });

  it.each([
    'en',
    'ar', // feature:locale-ar
  ] as const)('resolves name errors from overlays in %s', async (locale) => {
    const merged = await loadMessages(locale);
    const admin = (await import(`../messages/admin-users.${locale}.json`)).default;
    const profile = (await import(`../messages/profile-settings.${locale}.json`)).default;
    for (const key of ['nameMaxLength', 'namePattern', 'nameNoLetter']) {
      expect(lookupMessage(merged, `users.editUser.errors.${key}`)).toBe(
        lookupMessage(admin, `users.editUser.errors.${key}`),
      );
      expect(lookupMessage(merged, `validation.${key}`)).toBe(
        lookupMessage(admin, `validation.${key}`),
      );
    }
    for (const key of ['namePattern', 'nameNoLetter']) {
      expect(lookupMessage(merged, `settings.profile.${key}`)).toBe(
        lookupMessage(profile, `settings.profile.${key}`),
      );
    }
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

  it('resolves the code-step messages to the overlay in Arabic', async () => {
    const merged = await loadMessages('ar');
    const overlay = readOverlay('code-verification', 'ar');

    for (const key of CODE_STEP_KEYS) {
      expect(lookupMessage(merged, key)).toBe(lookupMessage(overlay, key));
    }
  });
  // feature:locale-ar:end
});
