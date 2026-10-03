import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PasswordPolicy } from './password-policy.decorator';

class Subject {
  @PasswordPolicy()
  password!: string;
}

async function errorCount(password: string): Promise<number> {
  const instance = plainToInstance(Subject, { password });
  return (await validate(instance)).length;
}

describe('PasswordPolicy', () => {
  it('accepts a password of exactly 72 bytes', async () => {
    const password = `Aa1${'a'.repeat(69)}`;

    expect(Buffer.byteLength(password, 'utf8')).toBe(72);
    await expect(errorCount(password)).resolves.toBe(0);
  });

  it('rejects a password of 73 bytes', async () => {
    const password = `Aa1${'a'.repeat(70)}`;

    expect(Buffer.byteLength(password, 'utf8')).toBe(73);
    await expect(errorCount(password)).resolves.not.toBe(0);
  });

  it('rejects a 4-byte character that straddles the limit', async () => {
    const password = `Aa1${'a'.repeat(68)}\u{1F600}`;

    expect(Buffer.byteLength(password, 'utf8')).toBe(75);
    await expect(errorCount(password)).resolves.not.toBe(0);
  });

  it('requires an uppercase, a lowercase and a number', async () => {
    await expect(errorCount('abcdefgh1')).resolves.not.toBe(0);
    await expect(errorCount('ABCDEFGH1')).resolves.not.toBe(0);
    await expect(errorCount('Abcdefgh')).resolves.not.toBe(0);
  });
});
