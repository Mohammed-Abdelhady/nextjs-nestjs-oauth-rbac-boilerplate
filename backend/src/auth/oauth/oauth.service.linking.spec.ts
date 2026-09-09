import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Request, Response } from 'express';
import { OAuthService } from './oauth.service';
import { SignInService } from '../services/sign-in.service';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { ProfileSyncService } from '../../user/services/profile-sync.service';
import { AccountLinkingService } from '../../user/services/account-linking.service';
import { User } from '../../user/schemas/user.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { OAuthProviderStrategy } from './oauth-provider.interface';

const USER_ID = 'user-1';
const PROFILE = {
  providerId: 'google-42',
  email: 'user@example.com',
  emailVerified: true,
  name: 'Ada',
};

function strategy(): OAuthProviderStrategy {
  return {
    id: 'google',
    displayName: 'Google',
    supportsPkce: true,
    usesOidc: true,
    emailAlwaysVerified: true,
    callbackMethod: 'GET',
    isEnabled: () => true,
    getAuthorizationUrl: () => 'https://example.test',
    exchangeCode: jest.fn().mockResolvedValue({ accessToken: 'token' }),
    fetchProfile: jest.fn().mockResolvedValue(PROFILE),
  } as unknown as OAuthProviderStrategy;
}

describe('OAuthService linking', () => {
  let service: OAuthService;
  let accountLinking: { linkProvider: jest.Mock };
  let profileSync: { syncProfileFromProvider: jest.Mock };
  let signIn: { completeSignIn: jest.Mock };
  let sessions: { validateSession: jest.Mock };
  let cookies: { read: jest.Mock };

  beforeEach(async () => {
    accountLinking = { linkProvider: jest.fn().mockResolvedValue({}) };
    profileSync = {
      syncProfileFromProvider: jest.fn().mockResolvedValue(undefined),
    };
    signIn = { completeSignIn: jest.fn() };
    sessions = {
      validateSession: jest.fn().mockResolvedValue({
        user: { _id: { toString: () => USER_ID }, isDeleted: false },
      }),
    };
    cookies = { read: jest.fn().mockReturnValue('session-token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: getModelToken(User.name), useValue: { findOne: jest.fn() } },
        { provide: SignInService, useValue: signIn },
        { provide: ProfileSyncService, useValue: profileSync },
        { provide: AccountLinkingService, useValue: accountLinking },
        { provide: SessionService, useValue: sessions },
        { provide: SessionCookieService, useValue: cookies },
      ],
    }).compile();

    service = module.get(OAuthService);
  });

  function params(overrides: { linkUserId?: string } = {}) {
    return {
      strategy: strategy(),
      code: 'auth-code',
      redirectUri: 'https://api.example.com/callback',
      request: {} as Request,
      response: {} as Response,
      linkUserId: overrides.linkUserId ?? USER_ID,
    };
  }

  it('links the provider to the signed-in user without issuing a session', async () => {
    await service.link(params());

    expect(accountLinking.linkProvider).toHaveBeenCalledWith(
      USER_ID,
      'google',
      PROFILE,
    );
    expect(profileSync.syncProfileFromProvider).toHaveBeenCalledWith(
      USER_ID,
      'google',
      PROFILE,
    );
    expect(signIn.completeSignIn).not.toHaveBeenCalled();
  });

  it('rejects a logged-out start', async () => {
    cookies.read.mockReturnValue(undefined);

    await expect(
      service.requireSessionUserId({} as Request),
    ).rejects.toMatchObject({
      code: ErrorCode.SESSION_REQUIRED,
    });
  });

  it('rejects when the session user does not match the stored link user', async () => {
    await expect(
      service.link(params({ linkUserId: 'other-user' })),
    ).rejects.toBeInstanceOf(AppException);
    try {
      await service.link(params({ linkUserId: 'other-user' }));
    } catch (error) {
      const exception = error as AppException;
      expect(exception.getCode()).toBe(ErrorCode.OAUTH_STATE_INVALID);
      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    }
    expect(accountLinking.linkProvider).not.toHaveBeenCalled();
  });

  it('surfaces a provider identity that already belongs to another user', async () => {
    accountLinking.linkProvider.mockRejectedValue(
      new AppException(
        ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE,
        'already linked',
        HttpStatus.CONFLICT,
        { provider: 'google' },
      ),
    );

    await expect(service.link(params())).rejects.toMatchObject({
      code: ErrorCode.OAUTH_ACCOUNT_LINKED_ELSEWHERE,
    });
    expect(signIn.completeSignIn).not.toHaveBeenCalled();
  });
});
