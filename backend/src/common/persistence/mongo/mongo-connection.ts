import { DynamicModule, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export const MONGOOSE_CONNECTION_OPTIONS = {
  w: 'majority' as const,
  retryWrites: true,
  readPreference: 'primary' as const,
};

export function buildMongooseOptions(configService: ConfigService): {
  uri: string | undefined;
  w: 'majority';
  retryWrites: boolean;
  readPreference: 'primary';
  connectionFactory: (connection: Connection) => Connection;
} {
  return {
    uri: configService.get<string>('MONGO_URI'),
    ...MONGOOSE_CONNECTION_OPTIONS,
    connectionFactory: (connection: Connection) => {
      const logger = new Logger('Mongoose');
      connection.on('connected', () => {
        logger.log('Connected to MongoDB');
      });
      connection.on('error', (err: Error) => {
        logger.error(`MongoDB connection error: ${err.message}`, err.stack);
      });
      connection.on('disconnected', () => {
        logger.warn('Disconnected from MongoDB');
      });
      return connection;
    },
  };
}

/** The one connection every MongoDB adapter of the application shares. */
export const MONGO_CONNECTION: DynamicModule = MongooseModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: buildMongooseOptions,
  inject: [ConfigService],
});
