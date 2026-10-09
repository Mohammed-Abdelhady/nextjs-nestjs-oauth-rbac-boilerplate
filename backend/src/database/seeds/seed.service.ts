import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as fs from 'fs';

import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';

import { getSeedUsers, printSeedCredentials } from './user.seed';
import { RoleSeedService } from './role.seed';
import { ApplicationRegistryService } from '../../session/services/application-registry.service';
import { describeDriverError } from '../../common/utils/mongo-error.util';

function getChangelogCollectionName(): string {
  const possiblePaths = [
    path.resolve(process.cwd(), 'migrate-mongo-config.js'),
    path.resolve(process.cwd(), 'backend/migrate-mongo-config.js'),
    path.resolve(__dirname, '../../../migrate-mongo-config.js'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        const match = content.match(
          /changelogCollectionName:\s*['"]([^'"]+)['"]/,
        );
        if (match && match[1]) {
          return match[1];
        }
      } catch {
        // Fall back to next candidate path
      }
    }
  }

  return 'migrations';
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
    private readonly roleSeedService: RoleSeedService,
    private readonly applications: ApplicationRegistryService,
  ) {}

  async seedAll(): Promise<{
    roles: string;
    users: number;
    total: number;
  }> {
    this.logger.log('Starting database seeding...');

    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new Error(
        'Database seeding is only allowed when NODE_ENV is "development" or "test".',
      );
    }

    await this.roleSeedService.seed();
    await this.applications.seedFirstPartyApplications();

    const usersCount = await this.seedUsers();

    const summary = {
      roles: 'seeded',
      users: usersCount,
      total: usersCount,
    };

    this.logger.log(`Database seeding completed: ${JSON.stringify(summary)}`);
    return summary;
  }

  async seedUsers(): Promise<number> {
    this.logger.log('Seeding users...');
    let createdCount = 0;

    const seedUsers = getSeedUsers();
    printSeedCredentials(seedUsers);

    for (const userData of seedUsers) {
      try {
        const existingUser = await this.userModel.findOne({
          email: userData.email,
        });

        if (existingUser) {
          this.logger.log(
            `Seed user already exists (role: ${userData.role}) userId=${existingUser._id.toString()}`,
          );
          continue;
        }

        const hashedPassword = await bcrypt.hash(
          userData.password,
          this.configService.get<number>('bcrypt.rounds', 10),
        );

        const created = await this.userModel.create({
          _id: new Types.ObjectId(),
          ...userData,
          password: hashedPassword,
          isVerified: true,
          authProvider: AuthProvider.EMAIL,
          permissions: userData.permissions || [],
        });

        this.logger.log(
          `Created seed user (role: ${userData.role}) userId=${created._id.toString()}`,
        );
        createdCount++;
      } catch (error) {
        // The message quotes input; the error's name and code identify it.
        this.logger.error(
          `Failed to create a seed user (role: ${userData.role}): error ${describeDriverError(error)}`,
        );
      }
    }

    this.logger.log(`Seeding users completed: ${createdCount} users created`);
    return createdCount;
  }

  async resetDatabase(): Promise<void> {
    this.logger.warn('Resetting database...');

    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      throw new Error(
        'Database reset is only allowed when NODE_ENV is "development" or "test".',
      );
    }

    const changelogCollection = getChangelogCollectionName();
    const skippedCollections = new Set<string>([
      changelogCollection,
      `${changelogCollection}_lock`,
      'changelog_lock',
      'migrations_lock',
    ]);

    const collections = Object.values(this.userModel.db.collections);
    for (const collection of collections) {
      if (skippedCollections.has(collection.collectionName)) {
        continue;
      }
      await collection.deleteMany({});
    }

    this.logger.warn('All application collections cleared');

    await this.seedAll();

    this.logger.warn('Database reset completed');
  }
}
