import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { AuthProvider } from '../enums/auth-provider.enum';

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: 'user' })
  role!: string;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  @Prop({ enum: AuthProvider, default: AuthProvider.EMAIL })
  authProvider!: AuthProvider;

  @Prop({ sparse: true, unique: true })
  googleId?: string;

  @Prop({ sparse: true, unique: true })
  facebookId?: string;

  @Prop({ sparse: true, unique: true })
  githubId?: string;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: [String], default: [] })
  linkedProviders!: string[];

  @Prop({ enum: AuthProvider })
  primaryProvider?: AuthProvider;

  @Prop()
  profileSyncedAt?: Date;

  @Prop()
  lastSyncedProvider?: string;

  // Timestamp fields (automatically managed by Mongoose with timestamps: true)
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema: MongooseSchema<User> =
  SchemaFactory.createForClass(User);

// Indexes
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isDeleted: 1 });
UserSchema.index({ linkedProviders: 1 });
UserSchema.index({ role: 1 });
