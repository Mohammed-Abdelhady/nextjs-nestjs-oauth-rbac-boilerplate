import { readAppleUserName } from './apple-user-payload.util';

describe('readAppleUserName', () => {
  it('joins the first and last name Apple sends', () => {
    expect(
      readAppleUserName(
        '{"name":{"firstName":"Ada","lastName":"Lovelace"},"email":"ada@example.com"}',
      ),
    ).toBe('Ada Lovelace');
  });

  it('uses whichever half is present', () => {
    expect(readAppleUserName('{"name":{"firstName":"Ada"}}')).toBe('Ada');
    expect(readAppleUserName('{"name":{"lastName":"Lovelace"}}')).toBe(
      'Lovelace',
    );
  });

  it('returns nothing on later logins, when Apple omits the payload', () => {
    expect(readAppleUserName()).toBeUndefined();
    expect(readAppleUserName('')).toBeUndefined();
  });

  it('returns nothing for a payload without a usable name', () => {
    expect(readAppleUserName('{"email":"ada@example.com"}')).toBeUndefined();
    expect(
      readAppleUserName('{"name":{"firstName":"  ","lastName":""}}'),
    ).toBeUndefined();
  });

  it('swallows a malformed payload instead of failing the login', () => {
    expect(readAppleUserName('{not json')).toBeUndefined();
    expect(readAppleUserName('"a string"')).toBeUndefined();
  });
});
