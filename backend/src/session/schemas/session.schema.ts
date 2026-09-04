import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Parsed device information from user agent
 */
export class DeviceInfo {
  @Prop({
    type: String,
    enum: ['mobile', 'tablet', 'desktop', 'unknown'],
    default: 'unknown',
  })
  type!: 'mobile' | 'tablet' | 'desktop' | 'unknown';

  @Prop()
  browser?: string; // e.g., "Chrome 120.0"

  @Prop()
  os?: string; // e.g., "Windows 10"

  @Prop()
  name?: string; // Human-readable: "Chrome on Windows"
}

/**
 * Session schema for managing user authentication sessions
 */
@Schema({ timestamps: true })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  userAgent!: string;

  @Prop({ type: DeviceInfo })
  device?: DeviceInfo;

  @Prop({ required: true })
  ip!: string;

  @Prop()
  deviceName?: string; // Optional custom device name

  @Prop({ default: true })
  isValid!: boolean;

  @Prop()
  lastUsedAt?: Date;

  @Prop({ required: true })
  expiresAt!: Date;

  // Timestamp fields (automatically managed by Mongoose with timestamps: true)
  createdAt!: Date;
  updatedAt!: Date;
}

export type SessionDocument = HydratedDocument<Session>;

export interface LeanSession extends Omit<Session, 'user'> {
  _id: Types.ObjectId;
  user: Types.ObjectId | Record<string, unknown>;
}

export const SessionSchema: MongooseSchema<Session> =
  SchemaFactory.createForClass(Session);

// Indexes
SessionSchema.index({ user: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
SessionSchema.index({ user: 1, userAgent: 1 });
