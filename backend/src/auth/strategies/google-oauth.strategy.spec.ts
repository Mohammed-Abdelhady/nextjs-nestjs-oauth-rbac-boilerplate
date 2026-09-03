import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleOAuthStrategy } from './google-oauth.strategy';

describe('GoogleOAuthStrategy', () => {
  let strategy: GoogleOAuthStrategy;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig: Record<string, string | boolean> = {
    'oauth.google.enabled': true,
    'oauth.google.clientId': 'test-client-id',
    'oauth.google.clientSecret': 'test-client-secret',
    'oauth.google.callbackUrl':
      'http://localhost:3000/api/auth/oauth/callback/google',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn(
        <T = unknown>(key: string, defaultValue?: T): T =>
          (mockConfig[key] as T) ?? (defaultValue as T),
      ),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<GoogleOAuthStrategy>(GoogleOAuthStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('provider', () => {
    it('should return google as provider name', () => {
      expect(strategy.provider).toBe('google');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state', () => {
      const url = strategy.getAuthorizationUrl('test-state');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Foauth%2Fcallback%2Fgoogle',
      );
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(url).toContain('state=test-state');
    });

    it('should generate authorization URL without state', () => {
      const url = strategy.getAuthorizationUrl();

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).not.toContain('state=');
    });
  });

  describe('getUserProfile', () => {
    beforeEach(() => {
      // Mock fetch globally
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should exchange code for user profile', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      const mockUserProfile = {
        id: 'google-123',
        email: 'test@example.com',
        verified_email: true,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/picture.jpg',
        locale: 'en',
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
        providerId: 'google-123',
        email: 'test@example.com',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        picture: 'https://example.com/picture.jpg',
        emailVerified: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });

    it('should throw error if email is not verified', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      const mockUserProfile = {
        id: 'google-123',
        email: 'test@example.com',
        verified_email: false,
        name: 'Test User',
        given_name: 'Test',
        family_name: 'User',
        picture: 'https://example.com/picture.jpg',
        locale: 'en',
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
      ).rejects.toThrow('Google email is not verified');
    });

    it('should throw error on token exchange failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid code'),
      } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow();
    });

    it('should throw error on user profile fetch failure', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow();
    });
  });

  describe('getScopes', () => {
    it('should return correct OAuth scopes', () => {
      // Access protected method for testing
      const scopes = (
        strategy as unknown as { getScopes: () => string[] }
      ).getScopes();

      expect(scopes).toEqual(['openid', 'email', 'profile']);
    });
  });
});
