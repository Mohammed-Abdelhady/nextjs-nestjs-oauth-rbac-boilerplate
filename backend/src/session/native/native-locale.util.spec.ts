import { negotiateNativeAuthorizeLocale } from './native-locale.util';

describe('negotiateNativeAuthorizeLocale', () => {
  it.each([
    { label: 'English locale', header: 'en', expected: 'en' },
    { label: 'Arabic locale', header: 'ar', expected: 'ar' },
    { label: 'regional Arabic tag', header: 'ar-EG, en;q=0.8', expected: 'ar' },
    {
      label: 'weighted preference',
      header: 'en;q=0.4, ar;q=0.9',
      expected: 'ar',
    },
    {
      label: 'unsupported before supported',
      header: 'fr-CA, en;q=0.8',
      expected: 'en',
    },
    {
      label: 'disabled first preference',
      header: 'ar;q=0, en;q=0.5',
      expected: 'en',
    },
    { label: 'unsupported locale', header: 'fr-FR', expected: 'en' },
    { label: 'malformed quality', header: 'ar;q=broken', expected: 'en' },
    { label: 'empty header', header: '', expected: 'en' },
    { label: 'missing header', header: undefined, expected: 'en' },
  ])('$label selects its supported locale', ({ header, expected }) => {
    expect(negotiateNativeAuthorizeLocale(header)).toBe(expected);
  });
});
