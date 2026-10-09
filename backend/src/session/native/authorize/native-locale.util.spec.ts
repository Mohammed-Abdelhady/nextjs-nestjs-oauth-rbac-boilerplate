import { negotiateNativeAuthorizeLocale } from './native-locale.util';

describe('negotiateNativeAuthorizeLocale', () => {
  it.each([
    { label: 'English locale', header: 'en', expected: 'en' },
    { label: 'Arabic locale', header: 'ar', expected: 'ar' }, // feature:locale-ar
    { label: 'regional Arabic tag', header: 'ar-EG, en;q=0.8', expected: 'ar' }, // feature:locale-ar
    // feature:locale-ar:start
    {
      label: 'weighted preference',
      header: 'en;q=0.4, ar;q=0.9',
      expected: 'ar',
    },
    // feature:locale-ar:end
    {
      label: 'unsupported before supported',
      header: 'fr-CA, en;q=0.8',
      expected: 'en',
    },
    // feature:locale-ar:start
    {
      label: 'disabled first preference',
      header: 'en;q=0, ar;q=0.5',
      expected: 'ar',
    },
    { label: 'malformed quality', header: 'ar;q=broken', expected: 'en' },
    // feature:locale-ar:end
    { label: 'unsupported locale', header: 'fr-FR', expected: 'en' },
    { label: 'empty header', header: '', expected: 'en' },
    { label: 'missing header', header: undefined, expected: 'en' },
  ])('$label selects its supported locale', ({ header, expected }) => {
    expect(negotiateNativeAuthorizeLocale(header)).toBe(expected);
  });
});
