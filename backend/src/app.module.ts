import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { HealthModule } from './health/health.module';
import { UserModule } from './user/user.module';
import { SessionModule } from './session/session.module';
import { AuthModule } from './auth/auth.module';
import { AuthMethodsController } from './auth/auth-methods.controller';
import { MagicLinkModule } from './auth/magic-link/magic-link.module';
import { TwoFactorModule } from './auth/two-factor/two-factor.module';
import { OAuthModule } from './auth/oauth/oauth.module';
import { GoogleOAuthStrategy } from './auth/oauth/strategies/google-oauth.strategy';
import { GitHubOAuthStrategy } from './auth/oauth/strategies/github-oauth.strategy';
import { FacebookOAuthStrategy } from './auth/oauth/strategies/facebook-oauth.strategy';
import { MicrosoftOAuthStrategy } from './auth/oauth/strategies/microsoft-oauth.strategy';
import { AppleOAuthStrategy } from './auth/oauth/strategies/apple-oauth.strategy';
import { DiscordOAuthStrategy } from './auth/oauth/strategies/discord-oauth.strategy';
import { LinkedInOAuthStrategy } from './auth/oauth/strategies/linkedin-oauth.strategy';
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
      MicrosoftOAuthStrategy,
      AppleOAuthStrategy,
      DiscordOAuthStrategy,
      LinkedInOAuthStrategy,
    ]),
    MagicLinkModule,
    TwoFactorModule,
    AdminModule,
  ],
  // AuthMethodsController sits here because this is the only context holding
  // both the auth configuration and the OAuth registry.
  controllers: [AppController, AuthMethodsController],
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
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Applied here rather than in main.ts so that tests booting AppModule get the
   * correlation id too.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
