import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

/**
 * Root controller
 * Provides the default endpoint for the application
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Root endpoint
   * Returns API information
   * @returns API status message
   */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
