import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  const baseEnv: Record<string, unknown> = {
    NODE_ENV: 'test',
    MONGO_URI: 'mongodb://localhost:27017/authboiler',
    CLIENT_URL: 'http://localhost:3000',
  };

  it('valid env passes', () => {
    const result = validateEnvironment(baseEnv);

    expect(result.MONGO_URI).toBe('mongodb://localhost:27017/authboiler');
    expect(result.NODE_ENV).toBe('test');
    expect(result.CLIENT_URL).toBe('http://localhost:3000');
    expect(result.PORT).toBe(3000);
  });

  it('missing MONGO_URI fails with its name in the message', () => {
    const envWithoutMongo: Record<string, unknown> = {
      NODE_ENV: 'test',
      CLIENT_URL: 'http://localhost:3000',
    };

    expect(() => validateEnvironment(envWithoutMongo)).toThrow(/MONGO_URI/);
  });

  it("SWAGGER_ENABLED='false' yields false", () => {
    const envWithSwaggerFalse: Record<string, unknown> = {
      ...baseEnv,
      SWAGGER_ENABLED: 'false',
    };

    const result = validateEnvironment(envWithSwaggerFalse);

    expect(result.SWAGGER_ENABLED).toBe(false);
  });

  it("SWAGGER_ENABLED='true' yields true", () => {
    const envWithSwaggerTrue: Record<string, unknown> = {
      ...baseEnv,
      SWAGGER_ENABLED: 'true',
    };

    const result = validateEnvironment(envWithSwaggerTrue);

    expect(result.SWAGGER_ENABLED).toBe(true);
  });

  it('mongodb+srv URI accepted', () => {
    const envWithAtlas: Record<string, unknown> = {
      ...baseEnv,
      MONGO_URI:
        'mongodb+srv://user:password@cluster0.mongodb.net/testdb?retryWrites=true&w=majority',
    };

    const result = validateEnvironment(envWithAtlas);

    expect(result.MONGO_URI).toBe(
      'mongodb+srv://user:password@cluster0.mongodb.net/testdb?retryWrites=true&w=majority',
    );
  });

  it('rejects invalid MONGO_URI protocol', () => {
    const envWithInvalidMongo: Record<string, unknown> = {
      ...baseEnv,
      MONGO_URI: 'http://localhost:27017/authboiler',
    };

    expect(() => validateEnvironment(envWithInvalidMongo)).toThrow(/MONGO_URI/);
  });

  it('parses numeric environment variables via Type transformer', () => {
    const envWithNumbers: Record<string, unknown> = {
      ...baseEnv,
      PORT: '5050',
      THROTTLE_TTL: '120',
      THROTTLE_LIMIT: '200',
    };

    const result = validateEnvironment(envWithNumbers);

    expect(result.PORT).toBe(5050);
    expect(result.THROTTLE_TTL).toBe(120);
    expect(result.THROTTLE_LIMIT).toBe(200);
  });

  it("PROFILE_SYNC_ENABLED='false' yields false", () => {
    const envWithProfileSyncFalse: Record<string, unknown> = {
      ...baseEnv,
      PROFILE_SYNC_ENABLED: 'false',
    };

    const result = validateEnvironment(envWithProfileSyncFalse);

    expect(result.PROFILE_SYNC_ENABLED).toBe(false);
  });
});
