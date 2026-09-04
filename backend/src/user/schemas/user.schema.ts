import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { EMAIL_PROVIDER } from '../../common/constants/oauth-providers';
import { TwoFactor, TwoFactorSchema } from './two-factor.schema';

/**
 * One OAuth account linked to a user, keyed by the provider id from the OAuth registry.
 */
@Schema({ _id: false })
export class LinkedAccount {
  @Prop({ required: true })
  provider!: string;

  @Prop({ required: true })
  providerId!: string;

  @Prop({ required: true, default: () => new Date() })
  linkedAt!: Date;
}

export const LinkedAccountSchema = SchemaFactory.createForClass(LinkedAccount);

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ select: false })
  password?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: String, default: 'user' })
  role!: string;

  @Prop({ type: [String], default: [] })
  permissions!: string[];

  /** Provider the account was created with: 'email' or an OAuth provider id. */
  @Prop({ type: String, default: EMAIL_PROVIDER })
  authProvider!: string;

  @Prop({ type: [LinkedAccountSchema], default: [] })
  linkedAccounts!: LinkedAccount[];

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  deletedAt?: Date;

  /** Provider id used as the source of truth for profile sync. */
  @Prop({ type: String })
  primaryProvider?: string;

  @Prop()
  profileSyncedAt?: Date;

  @Prop()
  lastSyncedProvider?: string;

  /**
   * Second factor state. Optional subdocument, so accounts written before it
   * existed read back with the defaults and need no migration.
   */
  @Prop({ type: TwoFactorSchema, default: () => ({}) })
  twoFactor!: TwoFactor;

  /** Virtual: 'email' when password sign-in applies, plus every linked OAuth provider. */
  linkedProviders!: string[];

  // Timestamp fields (automatically managed by Mongoose with timestamps: true)
  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

export const UserSchema: MongooseSchema<User> =
  SchemaFactory.createForClass(User);

UserSchema.virtual('linkedProviders').get(function (
  this: UserDocument,
): string[] {
  const oauthProviders = (this.linkedAccounts ?? []).map(
    (account) => account.provider,
  );
  if (this.authProvider === EMAIL_PROVIDER) {
    return [EMAIL_PROVIDER, ...oauthProviders];
  }
  return oauthProviders;
});

// Indexes
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isDeleted: 1 });
UserSchema.index({ role: 1 });
UserSchema.index(
  { 'linkedAccounts.provider': 1, 'linkedAccounts.providerId': 1 },
  { unique: true, sparse: true },
);
