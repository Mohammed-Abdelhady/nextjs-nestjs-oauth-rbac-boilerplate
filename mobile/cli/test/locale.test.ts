import { describe, expect, it } from 'vitest';
import { localeFromLanguageTag, textDirection } from '../src/locale';

describe('locale direction', () => {
  it('selects Modern Standard Arabic strings and right-to-left direction for Arabic tags', () => {
    expect(localeFromLanguageTag('ar')).toBe('ar');
    expect(localeFromLanguageTag('ar-SA')).toBe('ar');
    expect(textDirection('ar')).toBe('rtl');
  });

  it('uses English and left-to-right direction for other or absent language tags', () => {
    expect(localeFromLanguageTag('en-GB')).toBe('en');
    expect(localeFromLanguageTag('arc')).toBe('en');
    expect(localeFromLanguageTag('')).toBe('en');
    expect(textDirection('en')).toBe('ltr');
  });
});
