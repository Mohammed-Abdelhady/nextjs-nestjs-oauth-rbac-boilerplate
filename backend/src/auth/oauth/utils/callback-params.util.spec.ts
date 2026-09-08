import { toCallbackParams } from './callback-params.util';

describe('toCallbackParams', () => {
  it('keeps string values', () => {
    expect(
      toCallbackParams({ code: 'auth-code', state: 'state-value' }),
    ).toEqual({ code: 'auth-code', state: 'state-value' });
  });

  it('drops repeated and nested parameters', () => {
    expect(
      toCallbackParams({
        code: ['first', 'second'],
        state: { nested: 'value' },
        error: 'access_denied',
      }),
    ).toEqual({ error: 'access_denied' });
  });

  it('returns an empty object for a missing or non-object body', () => {
    expect(toCallbackParams(undefined)).toEqual({});
    expect(toCallbackParams(null)).toEqual({});
    expect(toCallbackParams('code=auth-code')).toEqual({});
  });
});
