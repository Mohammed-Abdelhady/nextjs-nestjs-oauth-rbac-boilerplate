import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GitHubOAuthStrategy } from './github-oauth.strategy';

describe('GitHubOAuthStrategy', () => {
  let strategy: GitHubOAuthStrategy;
  let configService: jest.Mocked<ConfigService>;

  const mockConfig: Record<string, string | boolean> = {
    'oauth.github.enabled': true,
    'oauth.github.clientId': 'test-client-id',
    'oauth.github.clientSecret': 'test-client-secret',
    'oauth.github.callbackUrl':
      'http://localhost:3000/api/auth/oauth/callback/github',
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => mockConfig[key]),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GitHubOAuthStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<GitHubOAuthStrategy>(GitHubOAuthStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('provider', () => {
    it('should return github as provider name', () => {
      expect(strategy.provider).toBe('github');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with state', () => {
      const url = strategy.getAuthorizationUrl('test-state');

      expect(url).toContain('https://github.com/login/oauth/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Foauth%2Fcallback%2Fgithub',
      );
      expect(url).toContain('scope=user%3Aemail+read%3Auser');
      expect(url).toContain('state=test-state');
    });

    it('should generate authorization URL without state', () => {
      const url = strategy.getAuthorizationUrl();

      expect(url).toContain('https://github.com/login/oauth/authorize');
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
        token_type: 'bearer',
        scope: 'user:email,read:user',
      };

      const mockUserProfile = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };

      const mockEmails = [
        {
          email: 'other@example.com',
          primary: false,
          verified: true,
          visibility: null,
        },
        {
          email: 'test@example.com',
          primary: true,
          verified: true,
          visibility: 'public',
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmails),
        } as Response);

      const profile = await strategy.getUserProfile('test-code', 'test-state');

      expect(profile).toEqual({
        providerId: '12345',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://avatars.githubusercontent.com/u/12345',
        emailVerified: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://github.com/login/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }),
      );
    });

    it('should use login as name if name is null', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        scope: 'user:email,read:user',
      };

      const mockUserProfile = {
        id: 12345,
        login: 'testuser',
        name: null,
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };

      const mockEmails = [
        {
          email: 'test@example.com',
          primary: true,
          verified: true,
          visibility: 'public',
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmails),
        } as Response);

      const profile = await strategy.getUserProfile('test-code', 'test-state');

      expect(profile.name).toBe('testuser');
    });

    it('should throw error if no verified email found', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        scope: 'user:email,read:user',
      };

      const mockUserProfile = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };

      const mockEmails = [
        {
          email: 'test@example.com',
          primary: true,
          verified: false,
          visibility: null,
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmails),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow('No verified email found on GitHub account');
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

    it('should throw error on GitHub OAuth error response', async () => {
      const mockErrorResponse = {
        error: 'bad_verification_code',
        error_description: 'The code passed is incorrect or expired',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow('GitHub OAuth error: bad_verification_code');
    });

    it('should throw error on user profile fetch failure', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        scope: 'user:email,read:user',
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
          text: () => Promise.resolve('Unauthorized'),
        } as Response);

      await expect(
        strategy.getUserProfile('test-code', 'test-state'),
      ).rejects.toThrow();
    });

    it('should fall back to any verified email if no primary email', async () => {
      const mockTokenResponse = {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        scope: 'user:email,read:user',
      };

      const mockUserProfile = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
      };

      const mockEmails = [
        {
          email: 'backup@example.com',
          primary: false,
          verified: true,
          visibility: null,
        },
      ];

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUserProfile),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockEmails),
        } as Response);

      const profile = await strategy.getUserProfile('test-code', 'test-state');

      expect(profile.email).toBe('backup@example.com');
    });
  });

  describe('getScopes', () => {
    it('should return correct OAuth scopes', () => {
      // Access protected method for testing
      const scopes = (
        strategy as unknown as { getScopes: () => string[] }
      ).getScopes();

      expect(scopes).toEqual(['user:email', 'read:user']);
    });
  });
});
