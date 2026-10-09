import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { NATIVE_ACCESS_TOKEN_TYPE } from '../../constants/session-policy';
import { LeanSession } from '../../schemas/session.schema';
import { leanValidatedSession } from '../../services/session-authority.service';
import { NativeAccessValidator } from './native-access-validator';

const BEARER_MAX_LENGTH = 256;

export function readBearerToken(request: Request): string | null {
  const header = request.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const separator = header.indexOf(' ');
  if (separator <= 0) {
    return null;
  }
  const scheme = header.slice(0, separator);
  const token = header.slice(separator + 1).trim();
  if (
    scheme !== NATIVE_ACCESS_TOKEN_TYPE ||
    token.length === 0 ||
    token.length > BEARER_MAX_LENGTH
  ) {
    return null;
  }
  return token;
}

/**
 * The MongoDB face of access token validation, for the guard that still reads
 * a session document. It goes away when the guard reads the validated session.
 */
@Injectable()
export class NativeAccessService {
  constructor(private readonly validator: NativeAccessValidator) {}

  async validate(rawToken: string): Promise<LeanSession | null> {
    return leanValidatedSession(await this.validator.validate(rawToken));
  }
}
