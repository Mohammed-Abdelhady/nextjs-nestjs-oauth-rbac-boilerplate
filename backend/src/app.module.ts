import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { SessionModule } from './session/session.module';
import { AuthModule } from './auth/auth.module';
import { OAuthModule } from './auth/oauth/oauth.module';
import { GoogleOAuthStrategy } from './auth/oauth/strategies/google-oauth.strategy';
import { GitHubOAuthStrategy } from './auth/oauth/strategies/github-oauth.strategy';
import { FacebookOAuthStrategy } from './auth/oauth/strategies/facebook-oauth.strategy';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { MailModule } from './mail/mail.module';
import { DatabaseModule } from './database/database.module';
import { RoleModule } from './role/role.module';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { Connection } from 'mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validationOptions: {
        allowUnknown: true,
        abortOnError: true,
      },
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGO_URI'),
        connectionFactory: (connection: Connection) => {
          connection.on('connected', () => {
            console.log('✅ MongoDB connected successfully');
          });
          connection.on('error', (err: Error) => {
            console.error('❌ MongoDB connection error:', err);
          });
          connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB disconnected');
          });
          return connection;
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('THROTTLE_TTL', 60) * 1000,
          limit: configService.get<number>('THROTTLE_LIMIT', 60),
        },
      ],
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    CommonModule,
    MailModule,
    DatabaseModule,
    UserModule,
    SessionModule,
    RoleModule,
    AuthModule,
    OAuthModule.register([
      GoogleOAuthStrategy,
      GitHubOAuthStrategy,
      FacebookOAuthStrategy,
    ]),
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
