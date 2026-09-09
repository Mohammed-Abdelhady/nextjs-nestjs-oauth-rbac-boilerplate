import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

@Schema({ timestamps: true })
export class PendingRegistration {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  /** Absent when the code verifies a new address for an existing account. */
  @Prop({ select: false })
  hashedPassword?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, select: false })
  hashedCode!: string;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop({ required: true, index: { expireAfterSeconds: 0 } })
  expiresAt!: Date;

  // Timestamp fields (automatically managed by Mongoose with timestamps: true)
  createdAt!: Date;
  updatedAt!: Date;
}

export type PendingRegistrationDocument = HydratedDocument<PendingRegistration>;

export const PendingRegistrationSchema: MongooseSchema<PendingRegistration> =
  SchemaFactory.createForClass(PendingRegistration);
