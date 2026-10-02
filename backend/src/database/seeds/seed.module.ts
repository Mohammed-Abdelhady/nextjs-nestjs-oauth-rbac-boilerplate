import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { UserSchema } from '../../user/schemas/user.schema';
import { RoleSchema } from '../../role/schemas/role.schema';
import { SeedService } from './seed.service';
import { RoleSeedService } from './role.seed';
import { SessionModule } from '../../session/session.module';

/**
 * Seed Module
 *
 * This module provides database seeding functionality.
 * It imports the UserModule to access the UserModel and provides
 * the SeedService for seeding operations.
 */
@Module({
  imports: [
    ConfigModule,
    // Import models for seeding operations
    MongooseModule.forFeature([
      {
        name: 'User',
        schema: UserSchema,
      },
      {
        name: 'Role',
        schema: RoleSchema,
      },
    ]),
    SessionModule,
  ],
  providers: [SeedService, RoleSeedService],
  exports: [SeedService],
})
export class SeedModule {}
