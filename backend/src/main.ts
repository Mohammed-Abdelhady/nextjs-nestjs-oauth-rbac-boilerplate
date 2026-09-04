import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Express } from 'express';
import { useContainer } from 'class-validator';
import { AppModule } from './app.module';
import { ErrorResponse, ErrorDetails } from './common/dto/api-response.dto';

/**
 * Bootstrap the NestJS application
 * Configures security middleware, CORS, validation, and starts the server
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
  const configService = app.get<ConfigService>(ConfigService);

  // Let custom class-validator constraints resolve providers, such as the OAuth registry
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Set global prefix for all routes except health check
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // 1. Security Headers - Apply first for all requests
  app.use(
    helmet({
      contentSecurityPolicy:
        configService.get('NODE_ENV') === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. Cookie Parser Middleware - Parse cookies from requests
  app.use(cookieParser());

  // 3. CORS Configuration - Apply before routing
  const clientUrl = configService.get<string>(
    'CLIENT_URL',
    'http://localhost:3000',
  );
  app.enableCors({
    origin: clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 3. Global Validation Pipe - Validate all incoming DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true, // Throw error if unknown properties
      transform: true, // Transform to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 5. Rate Limiting - Applied via ThrottlerGuard in AppModule

  // 6. Get port and environment for logging
  const port = configService.get<number>('PORT', 3000);
  const environment = configService.get<string>('NODE_ENV', 'development');

  // 7. Swagger/OpenAPI Documentation
  const swaggerEnabled = configService.get<boolean>('swagger.enabled', false);
  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('FULL-MERN-AUTH-Boilerplate API')
      .setDescription(
        'Comprehensive authentication and user management API with OAuth support',
      )
      .setVersion('1.0')
      .addTag('auth', 'Authentication endpoints (register, login, logout)')
      .addTag('oauth', 'OAuth login through the configured providers')
      .addTag('user', 'User profile and session management')
      .addTag('admin', 'Admin user management endpoints')
      .addTag('health', 'Health check endpoint')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT-auth',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addCookieAuth(
        'sid',
        {
          type: 'apiKey',
          in: 'cookie',
          name: 'sid',
          description: 'Session cookie for authentication',
        },
        'session-auth',
      )
      .build();

    const document = SwaggerModule.createDocument(app, config, {
      extraModels: [ErrorResponse, ErrorDetails],
    });
    SwaggerModule.setup('api/docs', app, document);

    console.log('='.repeat(50));
    console.log('📚 Swagger Documentation Enabled');
    console.log(`📖 Swagger UI: http://localhost:${port}/api/docs`);
    console.log(`📄 OpenAPI Spec: http://localhost:${port}/api/docs-json`);
    console.log('='.repeat(50));
  }

  // 8. Startup Logging
  console.log('='.repeat(50));
  console.log('🚀 Backend Server Starting...');
  console.log('='.repeat(50));
  console.log(`📝 Environment: ${environment}`);
  console.log(`🌐 Server URL: http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
  console.log(`🔒 CORS Origin: ${clientUrl}`);
  console.log('='.repeat(50));

  // 9. Graceful Shutdown
  app.enableShutdownHooks();

  // 10. Start Server
  await app.listen(port);

  console.log('✅ Server started successfully');
  console.log('='.repeat(50));
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
