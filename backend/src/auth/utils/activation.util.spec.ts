import { Model } from 'mongoose';
import { UserDocument } from '../../user/schemas/user.schema';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { resolveActivatedUser } from './activation.util';

interface MockUserModel {
  findOne: jest.Mock;
  create: jest.Mock;
}

describe('resolveActivatedUser', () => {
  const mockUserModel: MockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const userModel = mockUserModel as unknown as Model<UserDocument>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create the account a registration described', async () => {
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockResolvedValue({ email: 'new@example.com' });

    await resolveActivatedUser(
      {
        email: 'new@example.com',
        name: 'New User',
        hashedPassword: 'hashed',
      },
      userModel,
    );

    expect(mockUserModel.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'hashed',
      name: 'New User',
      isVerified: true,
    });
  });

  it('should verify an existing account without touching its password', async () => {
    const existing = {
      email: 'moved@example.com',
      password: 'previous-hash',
      isVerified: false,
      save: jest.fn().mockResolvedValue(true),
    };
    mockUserModel.findOne.mockResolvedValue(existing);

    const result = await resolveActivatedUser(
      { email: 'moved@example.com', name: 'Target User' },
      userModel,
    );

    expect(result).toBe(existing);
    expect(existing.isVerified).toBe(true);
    expect(existing.password).toBe('previous-hash');
    expect(existing.save).toHaveBeenCalled();
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });

  it('should refuse a code aimed at an account that is already verified', async () => {
    mockUserModel.findOne.mockResolvedValue({
      email: 'taken@example.com',
      isVerified: true,
      save: jest.fn(),
    });

    await expect(
      resolveActivatedUser(
        { email: 'taken@example.com', name: 'Taken' },
        userModel,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_ALREADY_EXISTS });
  });

  it('should refuse a pending record with neither account nor password', async () => {
    mockUserModel.findOne.mockResolvedValue(null);

    await expect(
      resolveActivatedUser(
        { email: 'ghost@example.com', name: 'Ghost' },
        userModel,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.NO_PENDING_REGISTRATION });
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });
});
