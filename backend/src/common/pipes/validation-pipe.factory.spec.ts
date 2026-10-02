import { HttpStatus, ValidationError } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';
import {
  collectValidationFields,
  createValidationPipe,
  summarizeValidationFields,
  validationExceptionFactory,
} from './validation-pipe.factory';

class AddressDto {
  @IsNotEmpty()
  city!: string;
}

class ItemDto {
  @MinLength(2)
  name!: string;
}

class OrderDto {
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  name!: string;

  @IsEmail()
  email!: string;

  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  items!: ItemDto[];

  @Matches(/^[a-z]+$/, {
    each: true,
    message: 'Each tag must be lowercase letters',
  })
  tags!: string[];
}

const VALID_ORDER = {
  name: 'Layla',
  email: 'layla@example.com',
  address: { city: 'Amman' },
  items: [{ name: 'Tea' }],
  tags: ['tea'],
};

async function rejectionOf(body: unknown): Promise<AppException> {
  try {
    await createValidationPipe().transform(body, {
      type: 'body',
      metatype: OrderDto,
    });
  } catch (error) {
    if (error instanceof AppException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected the pipe to reject the body');
}

describe('collectValidationFields', () => {
  it('keys two messages of one property under that property, in order', () => {
    const errors: ValidationError[] = [
      {
        property: 'password',
        constraints: {
          minLength: 'Password must be at least 8 characters',
          matches: 'Password must contain at least one letter and one number',
        },
      },
    ];

    expect(collectValidationFields(errors)).toEqual({
      password: [
        'Password must be at least 8 characters',
        'Password must contain at least one letter and one number',
      ],
    });
  });

  it('keys two properties separately', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'Invalid email format' } },
      { property: 'name', constraints: { minLength: 'Name is too short' } },
    ];

    expect(collectValidationFields(errors)).toEqual({
      email: ['Invalid email format'],
      name: ['Name is too short'],
    });
  });

  it('reports a parent and its child when both failed', () => {
    const errors: ValidationError[] = [
      {
        property: 'items',
        constraints: { arrayMinSize: 'Add at least two items' },
        children: [
          {
            property: '0',
            children: [
              { property: 'name', constraints: { minLength: 'Too short' } },
            ],
          },
        ],
      },
    ];

    expect(collectValidationFields(errors)).toEqual({
      items: ['Add at least two items'],
      'items.0.name': ['Too short'],
    });
  });

  it('returns no keys for no errors and for an error without messages', () => {
    expect(collectValidationFields([])).toEqual({});
    expect(collectValidationFields([{ property: 'name' }])).toEqual({});
  });

  it('keeps a property named __proto__ as an ordinary key', () => {
    const fields = collectValidationFields([
      {
        property: '__proto__',
        constraints: { whitelistValidation: 'not allowed' },
      },
    ]);

    expect(Object.keys(fields)).toEqual(['__proto__']);
    expect(Object.getOwnPropertyDescriptor(fields, '__proto__')?.value).toEqual(
      ['not allowed'],
    );
  });
});

describe('summarizeValidationFields', () => {
  it('names declared properties, nested ones by their path', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'Invalid email format' } },
      {
        property: 'address',
        children: [
          { property: 'city', constraints: { isNotEmpty: 'City is required' } },
        ],
      },
    ];

    expect(summarizeValidationFields(errors)).toEqual({
      fieldNames: ['email', 'address.city'],
      omittedCount: 0,
    });
  });

  it('counts a property the DTO does not declare instead of naming it', () => {
    const errors: ValidationError[] = [
      { property: 'name', constraints: { minLength: 'Name is too short' } },
      {
        property: 'hunter2',
        constraints: {
          whitelistValidation: 'property hunter2 should not exist',
        },
      },
    ];

    expect(summarizeValidationFields(errors)).toEqual({
      fieldNames: ['name'],
      omittedCount: 1,
    });
  });

  it('counts a name that could break a log line instead of naming it', () => {
    const errors: ValidationError[] = [
      {
        property: 'labels',
        children: [
          {
            property: 'x\n[Nest] forged line',
            constraints: { isString: 'must be a string' },
          },
        ],
      },
    ];

    expect(summarizeValidationFields(errors)).toEqual({
      fieldNames: [],
      omittedCount: 1,
    });
  });

  it('names at most twenty fields and counts the rest', () => {
    const errors: ValidationError[] = Array.from(
      { length: 23 },
      (_unused, index) => ({
        property: `field${index}`,
        constraints: { isString: 'must be a string' },
      }),
    );

    const summary = summarizeValidationFields(errors);

    expect(summary.fieldNames).toHaveLength(20);
    expect(summary.fieldNames[0]).toBe('field0');
    expect(summary.fieldNames[19]).toBe('field19');
    expect(summary.omittedCount).toBe(3);
  });

  it('names a property once when it failed twice', () => {
    const errors: ValidationError[] = [
      { property: 'name', constraints: { minLength: 'Name is too short' } },
      { property: 'name', constraints: { matches: 'Name has bad characters' } },
    ];

    expect(summarizeValidationFields(errors)).toEqual({
      fieldNames: ['name'],
      omittedCount: 0,
    });
  });

  it('has nothing to name when nothing failed', () => {
    expect(summarizeValidationFields([])).toEqual({
      fieldNames: [],
      omittedCount: 0,
    });
  });
});

describe('validationExceptionFactory', () => {
  it('builds a 400 VALIDATION_ERROR that carries the fields', () => {
    const exception = validationExceptionFactory([
      { property: 'email', constraints: { isEmail: 'Invalid email format' } },
    ]);

    expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(exception.getCode()).toBe(ErrorCode.VALIDATION_ERROR);
    expect(exception.message).toBe('Validation failed');
    expect(exception.getDetails()).toEqual({
      fields: { email: ['Invalid email format'] },
    });
  });
});

describe('createValidationPipe', () => {
  it('passes a valid body through', async () => {
    const result: unknown = await createValidationPipe().transform(
      VALID_ORDER,
      { type: 'body', metatype: OrderDto },
    );

    expect(result).toBeInstanceOf(OrderDto);
    expect(result).toEqual(VALID_ORDER);
  });

  it('keys a top-level failure by its property', async () => {
    const exception = await rejectionOf({ ...VALID_ORDER, email: 'nope' });

    expect(exception.getDetails()).toEqual({
      fields: { email: ['email must be an email'] },
    });
  });

  it('keys a message that does not start with the property name by the property', async () => {
    const exception = await rejectionOf({ ...VALID_ORDER, name: 'A' });

    expect(exception.getDetails()).toEqual({
      fields: { name: ['Name must be at least 2 characters'] },
    });
  });

  it('keys a nested failure by a dotted path', async () => {
    const exception = await rejectionOf({
      ...VALID_ORDER,
      address: { city: '' },
    });

    expect(exception.getDetails()).toEqual({
      fields: { 'address.city': ['city should not be empty'] },
    });
  });

  it('keys an array element by its index', async () => {
    const exception = await rejectionOf({
      ...VALID_ORDER,
      items: [{ name: 'Tea' }, { name: 'x' }],
    });

    expect(exception.getDetails()).toEqual({
      fields: {
        'items.1.name': ['name must be longer than or equal to 2 characters'],
      },
    });
  });

  it('keys an array of primitives by the array, once, whichever elements failed', async () => {
    const exception = await rejectionOf({
      ...VALID_ORDER,
      tags: ['tea', 'NOT OK', 'ALSO BAD'],
    });

    expect(exception.getDetails()).toEqual({
      fields: { tags: ['Each tag must be lowercase letters'] },
    });
  });

  it('keys a property the DTO does not have by that property', async () => {
    const exception = await rejectionOf({ ...VALID_ORDER, isAdmin: true });

    expect(exception.getDetails()).toEqual({
      fields: { isAdmin: ['property isAdmin should not exist'] },
    });
  });
});
