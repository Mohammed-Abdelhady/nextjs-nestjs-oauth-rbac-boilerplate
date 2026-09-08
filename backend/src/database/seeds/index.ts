import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { SeedService } from './seed.service';

/**
 * Seed CLI Entry Point
 *
 * This script provides a command-line interface for database seeding.
 * It can be run directly with ts-node or via npm scripts.
 *
 * Usage:
 * - Seed database: `npm run seed`
 * - Reset database: `npm run seed:reset`
 *
 * @example
 * ```bash
 * # Run seed directly
 * npx ts-node -r tsconfig-paths/register src/database/seeds/index.ts
 *
 * # Run with reset flag
 * npx ts-node -r tsconfig-paths/register src/database/seeds/index.ts --reset
 * ```
 */
async function bootstrap() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldReset = args.includes('--reset');

  console.log('Starting database seeding...');
  console.log('Environment:', process.env.NODE_ENV || 'development');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    // Get SeedService from DI container
    const seedService = app.get(SeedService);

    // Execute seeding or reset
    if (shouldReset) {
      console.log('Reset mode enabled - clearing all data...');
      await seedService.resetDatabase();
    } else {
      const result = await seedService.seedAll();
      console.log('Seeding completed successfully');
      console.log('Summary:', JSON.stringify(result, null, 2));
    }

    // Close application
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error(
      'Seeding failed:',
      error instanceof Error ? error.message : String(error),
    );
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the bootstrap function
void bootstrap();
