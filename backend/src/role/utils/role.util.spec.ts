import { AppException } from '../../common/exceptions/app.exception';
import { assertValidPermissions } from './role.util';

function refusalOf(permissions: string[]): unknown {
  try {
    assertValidPermissions(permissions);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('assertValidPermissions', () => {
  it.each([
    [['users:read:all']],
    [['users:read']],
    [['*']],
    [['users:read:all', '*', 'roles:update:all']],
    [[]],
  ])('accepts %j', (permissions) => {
    expect(refusalOf(permissions)).toBeUndefined();
  });

  it.each([
    [['users']],
    [['not a permission']],
    [['users:read:all', 'Users:Read']],
    [['']],
  ])(
    'refuses %j with INVALID_PERMISSION_FORMAT and status 400',
    (permissions) => {
      const refusal = refusalOf(permissions);

      expect(refusal).toBeInstanceOf(AppException);
      expect(refusal).toMatchObject({
        code: 'INVALID_PERMISSION_FORMAT',
        status: 400,
      });
    },
  );
});
