import { describe, expect, it } from 'vitest';
import { parseCliOptions, splitFeatureList } from '../src/flags/options.js';

describe('parseCliOptions', () => {
  it('defaults to install and git with no directory', () => {
    expect(parseCliOptions([])).toEqual({
      directory: undefined,
      yes: false,
      features: undefined,
      install: true,
      git: true,
    });
  });

  it('reads the directory argument', () => {
    expect(parseCliOptions(['my-app']).directory).toBe('my-app');
  });

  it('accepts an absolute path as the directory', () => {
    expect(parseCliOptions(['/tmp/cna-smoke']).directory).toBe('/tmp/cna-smoke');
  });

  it('turns off install and git', () => {
    const options = parseCliOptions(['app', '--no-install', '--no-git']);
    expect(options.install).toBe(false);
    expect(options.git).toBe(false);
  });

  it('reads --yes and --features together', () => {
    const options = parseCliOptions(['app', '--yes', '--features', 'email-password,google']);
    expect(options.yes).toBe(true);
    expect(options.features).toEqual(['email-password', 'google']);
  });

  it('rejects an unknown flag', () => {
    expect(() => parseCliOptions(['app', '--turbo'])).toThrow();
  });

  it('rejects a second positional argument', () => {
    expect(() => parseCliOptions(['app', 'extra'])).toThrow();
  });
});

describe('splitFeatureList', () => {
  it('trims, lowercases and drops empty entries', () => {
    expect(splitFeatureList(' Google , github ,, ')).toEqual(['google', 'github']);
  });
});
