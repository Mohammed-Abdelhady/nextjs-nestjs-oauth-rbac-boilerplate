import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_AUTH_EPOCH } from '../../session/constants/session-policy';

@Injectable()
export class AuthEpochService {
  constructor(private readonly configService: ConfigService) {}

  current(): number {
    return this.configService.get<number>('auth.epoch', DEFAULT_AUTH_EPOCH);
  }

  nativeEnabled(): boolean {
    return this.configService.get<boolean>('auth.nativeEnabled', false);
  }

  environment(): string {
    return this.configService.get<string>('server.nodeEnv', 'development');
  }

  clientUrl(): string {
    return this.configService.get<string>(
      'cors.clientUrl',
      'http://localhost:3000',
    );
  }
}
