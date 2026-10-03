import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './env.schema';
import { ACTIVATION_CODE_EXPIRES_IN_MAX } from '../auth/constants/registration';

/** The constraint names the activation lifetime field failed. */
function activationLifetimeErrors(value: number): string[] {
  const instance = plainToInstance(EnvironmentVariables, {
    ACTIVATION_CODE_EXPIRES_IN: value,
  });
  return validateSync(instance)
    .filter((error) => error.property === 'ACTIVATION_CODE_EXPIRES_IN')
    .flatMap((error) => Object.keys(error.constraints ?? {}));
}

describe('activation code lifetime configuration', () => {
  it('accepts the named maximum', () => {
    expect(
      activationLifetimeErrors(ACTIVATION_CODE_EXPIRES_IN_MAX),
    ).toHaveLength(0);
  });

  it('refuses a value above the named maximum', () => {
    expect(
      activationLifetimeErrors(ACTIVATION_CODE_EXPIRES_IN_MAX + 1),
    ).toContain('max');
  });
});
