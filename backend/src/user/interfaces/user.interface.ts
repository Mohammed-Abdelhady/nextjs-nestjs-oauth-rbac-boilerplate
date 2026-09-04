import { HydratedDocument } from 'mongoose';
import { UserRole } from '../enums/user-role.enum';
import { User } from '../schemas/user.schema';

export interface IUser {
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  googleId?: string;
  facebookId?: string;
  isVerified: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
}

export type UserDocument = HydratedDocument<User>;
