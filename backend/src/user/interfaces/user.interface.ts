import { HydratedDocument } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';
import { LinkedAccount, User } from '../schemas/user.schema';

export interface IUser {
  email: string;
  password?: string;
  name: string;
  avatarUrl?: string;
  role: UserRole;
  linkedAccounts: LinkedAccount[];
  isVerified: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
