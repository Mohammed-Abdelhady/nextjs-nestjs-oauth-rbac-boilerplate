import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

@Schema({ timestamps: true })
export class AuthorizationTransaction {
  @Prop({ required: true, unique: true })
  transactionId!: string;

  @Prop()
  browserBinding?: string;

  @Prop({ required: true })
  clientId!: string;

  @Prop({ required: true })
  redirectUri!: string;

  @Prop({ required: true })
  codeChallenge!: string;

  @Prop({ required: true })
  state!: string;

  @Prop({ type: [String], default: [] })
  requestedScopes!: string[];

  @Prop()
  audience?: string;

  @Prop({ required: true })
  intent!: string;

  @Prop({ required: true })
  expiresAt!: Date;

  @Prop({ default: false })
  consumed!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ type: Number })
  capturedUserVersion?: number;

  @Prop({ type: Number })
  capturedClientVersion?: number;

  @Prop({ type: Number })
  capturedGrantVersion?: number;

  @Prop({ required: true })
  authEpoch!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export type AuthorizationTransactionDocument =
  HydratedDocument<AuthorizationTransaction>;

export const AuthorizationTransactionSchema: MongooseSchema<AuthorizationTransaction> =
  SchemaFactory.createForClass(AuthorizationTransaction);

AuthorizationTransactionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);
