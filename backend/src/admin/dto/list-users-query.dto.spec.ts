import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './list-users-query.dto';
import { ListRolesQueryDto } from '../../role/dto/list-roles-query.dto';

describe('ListUsersQueryDto (D-06 & S-11)', () => {
  it('maps "true" string to boolean true', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { isVerified: 'true' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.isVerified).toBe(true);
  });

  it('maps "false" string to boolean false', async () => {
    const dto = plainToInstance(ListUsersQueryDto, { isVerified: 'false' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.isVerified).toBe(false);
  });

  it('maps case-insensitive boolean strings', () => {
    const dtoUpperTrue = plainToInstance(ListUsersQueryDto, {
      isVerified: 'TRUE',
    });
    const dtoUpperFalse = plainToInstance(ListUsersQueryDto, {
      isVerified: 'FALSE',
    });

    expect(dtoUpperTrue.isVerified).toBe(true);
    expect(dtoUpperFalse.isVerified).toBe(false);
  });

  it('preserves primitive booleans', () => {
    const dtoTrue = plainToInstance(ListUsersQueryDto, { isVerified: true });
    const dtoFalse = plainToInstance(ListUsersQueryDto, { isVerified: false });

    expect(dtoTrue.isVerified).toBe(true);
    expect(dtoFalse.isVerified).toBe(false);
  });

  it('fails validation when isVerified is not a boolean', async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      isVerified: 'not-a-bool',
    });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'isVerified')).toBe(true);
  });

  it('accepts search string up to 100 characters', async () => {
    const searchString = 'a'.repeat(100);
    const dto = plainToInstance(ListUsersQueryDto, { search: searchString });
    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'search')).toBe(false);
  });

  it('rejects search string exceeding 100 characters', async () => {
    const searchString = 'a'.repeat(101);
    const dto = plainToInstance(ListUsersQueryDto, { search: searchString });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });
});

describe('ListRolesQueryDto (S-11)', () => {
  it('accepts search string up to 100 characters', async () => {
    const searchString = 'r'.repeat(100);
    const dto = plainToInstance(ListRolesQueryDto, { search: searchString });
    const errors = await validate(dto);

    expect(errors.some((e) => e.property === 'search')).toBe(false);
  });

  it('rejects search string exceeding 100 characters', async () => {
    const searchString = 'r'.repeat(101);
    const dto = plainToInstance(ListRolesQueryDto, { search: searchString });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });
});
