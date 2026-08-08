import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FacebookOAuthStrategy } from './facebook-oauth.strategy';

describe('FacebookOAuthStrategy', () => {
  let strategy: FacebookOAuthStrategy;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig: Record<string, string | boolean> = {
    'oauth.facebook.enabled': true,
    'oauth.facebook.clientId': 'test-app-id',
    'oauth.facebook.clientSecret': 'test-app-secret',
    'oauth.facebook.callbackUrl':
      'http://localhost:3000/api/auth/oauth/callback/facebook',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => mockConfig[key]),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacebookOAuthStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<FacebookOAuthStrategy>(FacebookOAuthStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('provider', () => {
    it('should return facebook as provider name', () => {
      expect(strategy.provider).toBe('facebook');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state', () => {
      const url = strategy.getAuthorizationUrl('test-state');

      expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(url).toContain('client_id=test-app-id');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Foauth%2Fcallback%2Ffacebook',
      );
      expect(url).toContain('scope=email%2Cpublic_profile');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=test-state');
    });

    it('should generate authorization URL without state', () => {
      const url = strategy.getAuthorizationUrl();

      expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(url).toContain('client_id=test-app-id');
      expect(url).not.toContain('state=');
    });
  });

  describe('getUserProfile', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should exchange code for user profile', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 5183944,
      };

      const mockUserProfile = {
        id: '123456789',
        email: 'test@example.com',
        name: 'Test User',
        picture: {
          data: {
            url: 'https://platform-lookaside.fbsbx.com/picture.jpg',
          },
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response);

      const profile = await strategy.getUserProfile('test-code', 'test-state');

      expect(profile).toEqual({
        providerId: '123456789',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://platform-lookaside.fbsbx.com/picture.jpg',
        emailVerified: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://graph.facebook.com/v18.0/oauth/access_token',
        ),
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        }),
      );
    });

    it('should handle profile without picture', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 5183944,
      };

      const mockUserProfile = {
        id: '123456789',
        email: 'test@example.com',
        name: 'Test User',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response);

      const profile = await strategy.getUserProfile('test-code', 'test-state');

      expect(profile.picture).toBeUndefined();
    });

    it('should throw error if no email in profile', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 5183944,
      };

      const mockUserProfile = {
        id: '123456789',
        name: 'Test User',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow('No email found on Facebook account');
    });

    it('should throw error on token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid code'),
      } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow();
    });

    it('should throw error on Facebook OAuth error response', async () => {
      const mockErrorResponse = {
        error: {
          message: 'Invalid verification code',
          type: 'OAuthException',
          code: 100,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow('Facebook OAuth error: Invalid verification code');
    });

    it('should throw error on Graph API failure', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 5183944,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: () => Promise.resolve('Invalid access token'),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow();
    });

    it('should throw error on Graph API error response', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        expires_in: 5183944,
      };

      const mockErrorResponse = {
        error: {
          message: 'Session has expired',
          type: 'OAuthException',
          code: 190,
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockErrorResponse),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow('Facebook API error: Session has expired');
    });
  });

  describe('getScopes', () => {
    it('should return correct OAuth scopes', () => {
      const scopes = (
        strategy as unknown as { getScopes: () => string[] }
      ).getScopes();

      expect(scopes).toEqual(['email', 'public_profile']);
    });
  });
});
