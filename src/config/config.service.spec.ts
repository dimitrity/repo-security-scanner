import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Store original environment variables
    originalEnv = { ...process.env };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigService],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('isValidApiKey', () => {
    it('should return true for valid API key from environment', () => {
      process.env.API_KEYS = 'test-api-key-123';

      const result = service.isValidApiKey('test-api-key-123');

      expect(result).toBe(true);
    });

    it('should return true for default API key when no environment variable is set', () => {
      delete process.env.API_KEYS;

      const result = service.isValidApiKey('your-secure-production-key-2025');

      expect(result).toBe(true);
    });

    it('should return false for invalid API key', () => {
      process.env.API_KEYS = 'test-api-key-123';

      const result = service.isValidApiKey('invalid-key');

      expect(result).toBe(false);
    });

    it('should return false for empty API key', () => {
      process.env.API_KEYS = 'test-api-key-123';

      const result = service.isValidApiKey('');

      expect(result).toBe(false);
    });

    it('should return false for null/undefined API key', () => {
      process.env.API_KEYS = 'test-api-key-123';

      const result1 = service.isValidApiKey(null as any);
      const result2 = service.isValidApiKey(undefined as any);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it('should handle single API key from environment (current implementation)', () => {
      process.env.API_KEYS = 'key1,key2,key3';

      // Current implementation treats the entire string as one key
      const result1 = service.isValidApiKey('key1,key2,key3');
      const result2 = service.isValidApiKey('key1');
      const result3 = service.isValidApiKey('key2');
      const result4 = service.isValidApiKey('invalid-key');

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(result4).toBe(false);
    });

    it('should handle whitespace in API keys (exact match required)', () => {
      process.env.API_KEYS = ' key1 , key2 ';

      // Current implementation requires exact match including whitespace
      const result1 = service.isValidApiKey(' key1 , key2 ');
      const result2 = service.isValidApiKey('key1');
      const result3 = service.isValidApiKey('key2');

      expect(result1).toBe(true);
      expect(result2).toBe(false); // Exact match required
      expect(result3).toBe(false);
    });
  });

  describe('getApiKeyCount', () => {
    it('should return 1 for single API key', () => {
      process.env.API_KEYS = 'single-key';

      const result = service.getApiKeyCount();

      expect(result).toBe(1);
    });

    it('should return 1 for multiple API keys (current implementation limitation)', () => {
      process.env.API_KEYS = 'key1,key2,key3';

      const result = service.getApiKeyCount();

      expect(result).toBe(1);
    });

    it('should return 1 when no API keys are configured', () => {
      delete process.env.API_KEYS;

      const result = service.getApiKeyCount();

      expect(result).toBe(1);
    });

    it('should return 1 for empty API keys string', () => {
      process.env.API_KEYS = '';

      const result = service.getApiKeyCount();

      expect(result).toBe(1);
    });
  });

  describe('getPort', () => {
    it('should return port from environment variable', () => {
      process.env.PORT = '8080';

      const result = service.getPort();

      expect(result).toBe(8080);
    });

    it('should return default port 3000 when PORT is not set', () => {
      delete process.env.PORT;

      const result = service.getPort();

      expect(result).toBe(3000);
    });

    it('should return default port 3000 when PORT is empty string', () => {
      process.env.PORT = '';

      const result = service.getPort();

      expect(result).toBe(3000);
    });

    it('should return default port 3000 when PORT is invalid number', () => {
      process.env.PORT = 'invalid-port';

      const result = service.getPort();

      expect(result).toBe(3000);
    });

    it('should return default port 3000 when PORT is NaN', () => {
      process.env.PORT = 'NaN';

      const result = service.getPort();

      expect(result).toBe(3000);
    });

    it('should handle zero port', () => {
      process.env.PORT = '0';

      const result = service.getPort();

      expect(result).toBe(0);
    });

    it('should handle negative port', () => {
      process.env.PORT = '-1';

      const result = service.getPort();

      expect(result).toBe(-1);
    });

    it('should handle very large port numbers', () => {
      process.env.PORT = '65535';

      const result = service.getPort();

      expect(result).toBe(65535);
    });

    it('should handle decimal port numbers (truncates)', () => {
      process.env.PORT = '8080.5';

      const result = service.getPort();

      expect(result).toBe(8080);
    });
  });

  describe('getEnvironment', () => {
    it('should return environment from NODE_ENV', () => {
      process.env.NODE_ENV = 'production';

      const result = service.getEnvironment();

      expect(result).toBe('production');
    });

    it('should return development when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const result = service.getEnvironment();

      expect(result).toBe('development');
    });

    it('should return development when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = '';

      const result = service.getEnvironment();

      expect(result).toBe('development');
    });

    it('should handle various environment names', () => {
      const environments = [
        'development',
        'production',
        'staging',
        'test',
        'qa',
      ];

      environments.forEach((env) => {
        process.env.NODE_ENV = env;
        const result = service.getEnvironment();
        expect(result).toBe(env);
      });
    });

    it('should handle case-sensitive environment names', () => {
      process.env.NODE_ENV = 'PRODUCTION';

      const result = service.getEnvironment();

      expect(result).toBe('PRODUCTION');
    });
  });

  describe('isProduction', () => {
    it('should return true when environment is production', () => {
      process.env.NODE_ENV = 'production';

      const result = service.isProduction();

      expect(result).toBe(true);
    });

    it('should return false when environment is not production', () => {
      const nonProductionEnvs = ['development', 'staging', 'test', 'qa'];

      nonProductionEnvs.forEach((env) => {
        process.env.NODE_ENV = env;
        const result = service.isProduction();
        expect(result).toBe(false);
      });
    });

    it('should return false when NODE_ENV is not set', () => {
      delete process.env.NODE_ENV;

      const result = service.isProduction();

      expect(result).toBe(false);
    });

    it('should return false when NODE_ENV is empty string', () => {
      process.env.NODE_ENV = '';

      const result = service.isProduction();

      expect(result).toBe(false);
    });

    it('should be case-sensitive for production check', () => {
      process.env.NODE_ENV = 'PRODUCTION';

      const result = service.isProduction();

      expect(result).toBe(false); // Should be false because it's not exactly 'production'
    });
  });

  describe('integration scenarios', () => {
    it('should work correctly with typical production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.API_KEYS = 'prod-api-key-123';

      expect(service.getEnvironment()).toBe('production');
      expect(service.isProduction()).toBe(true);
      expect(service.getPort()).toBe(8080);
      expect(service.isValidApiKey('prod-api-key-123')).toBe(true);
      expect(service.getApiKeyCount()).toBe(1);
    });

    it('should work correctly with typical development configuration', () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.API_KEYS;

      expect(service.getEnvironment()).toBe('development');
      expect(service.isProduction()).toBe(false);
      expect(service.getPort()).toBe(3000);
      expect(service.isValidApiKey('your-secure-production-key-2025')).toBe(
        true,
      );
      expect(service.getApiKeyCount()).toBe(1);
    });

    it('should handle mixed configuration scenarios', () => {
      process.env.NODE_ENV = 'staging';
      process.env.PORT = '4000';
      process.env.API_KEYS = 'staging-key-1,staging-key-2';

      expect(service.getEnvironment()).toBe('staging');
      expect(service.isProduction()).toBe(false);
      expect(service.getPort()).toBe(4000);
      expect(service.isValidApiKey('staging-key-1,staging-key-2')).toBe(true);
      expect(service.isValidApiKey('staging-key-1')).toBe(false);
      expect(service.isValidApiKey('staging-key-2')).toBe(false);
      expect(service.isValidApiKey('invalid-key')).toBe(false);
      expect(service.getApiKeyCount()).toBe(1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long API keys', () => {
      const longKey = 'a'.repeat(1000);
      process.env.API_KEYS = longKey;

      const result = service.isValidApiKey(longKey);

      expect(result).toBe(true);
    });

    it('should handle special characters in API keys', () => {
      const specialKey = 'key-with-special-chars!@#$%^&*()_+-=[]{}|;:,.<>?';
      process.env.API_KEYS = specialKey;

      const result = service.isValidApiKey(specialKey);

      expect(result).toBe(true);
    });

    it('should handle unicode characters in API keys', () => {
      const unicodeKey = 'key-with-unicode-🚀-🌟-🎉';
      process.env.API_KEYS = unicodeKey;

      const result = service.isValidApiKey(unicodeKey);

      expect(result).toBe(true);
    });

    it('should handle extremely large port numbers', () => {
      process.env.PORT = '999999999';

      const result = service.getPort();

      expect(result).toBe(999999999);
    });

    it('should handle floating point port numbers', () => {
      process.env.PORT = '8080.999';

      const result = service.getPort();

      expect(result).toBe(8080);
    });

        it('should handle whitespace in environment variables', () => {
      process.env.NODE_ENV = ' production ';
      process.env.PORT = ' 8080 ';
      process.env.API_KEYS = ' key-with-spaces ';
      
      expect(service.getEnvironment()).toBe(' production ');
      expect(service.getPort()).toBe(8080);
      expect(service.isValidApiKey(' key-with-spaces ')).toBe(true);
      expect(service.isValidApiKey('key-with-spaces')).toBe(false);
    });
  });

  describe('getThrottlerConfig', () => {
    it('should return default throttler configuration when no environment variables are set', () => {
      delete process.env.THROTTLE_TTL;
      delete process.env.THROTTLE_LIMIT;
      
      const result = service.getThrottlerConfig();
      
      expect(result).toEqual({
        ttl: 60,
        limit: 10,
      });
    });

    it('should return throttler configuration from environment variables', () => {
      process.env.THROTTLE_TTL = '120';
      process.env.THROTTLE_LIMIT = '20';
      
      const result = service.getThrottlerConfig();
      
      expect(result).toEqual({
        ttl: 120,
        limit: 20,
      });
    });

    it('should handle invalid environment variables gracefully', () => {
      process.env.THROTTLE_TTL = 'invalid';
      process.env.THROTTLE_LIMIT = 'invalid';
      
      const result = service.getThrottlerConfig();
      
      expect(result).toEqual({
        ttl: 60,
        limit: 10,
      });
    });
  });

  describe('getEndpointThrottlerConfig', () => {
    it('should return default endpoint throttler configuration when no environment variables are set', () => {
      delete process.env.THROTTLE_TTL;
      delete process.env.THROTTLE_LIMIT;
      delete process.env.SCAN_THROTTLE_TTL;
      delete process.env.SCAN_THROTTLE_LIMIT;
      delete process.env.METADATA_THROTTLE_TTL;
      delete process.env.METADATA_THROTTLE_LIMIT;
      
      const result = service.getEndpointThrottlerConfig();
      
      expect(result).toEqual({
        default: { ttl: 60, limit: 10 },
        scan: { ttl: 300, limit: 5 },
        metadata: { ttl: 60, limit: 20 },
      });
    });

    it('should return endpoint throttler configuration from environment variables', () => {
      process.env.THROTTLE_TTL = '120';
      process.env.THROTTLE_LIMIT = '20';
      process.env.SCAN_THROTTLE_TTL = '600';
      process.env.SCAN_THROTTLE_LIMIT = '10';
      process.env.METADATA_THROTTLE_TTL = '180';
      process.env.METADATA_THROTTLE_LIMIT = '30';
      
      const result = service.getEndpointThrottlerConfig();
      
      expect(result).toEqual({
        default: { ttl: 120, limit: 20 },
        scan: { ttl: 600, limit: 10 },
        metadata: { ttl: 180, limit: 30 },
      });
    });

    it('should handle mixed environment variable configuration', () => {
      process.env.THROTTLE_TTL = '90';
      process.env.SCAN_THROTTLE_LIMIT = '8';
      // Other variables not set, should use defaults
      
      const result = service.getEndpointThrottlerConfig();
      
      expect(result).toEqual({
        default: { ttl: 90, limit: 10 },
        scan: { ttl: 300, limit: 8 },
        metadata: { ttl: 60, limit: 20 },
      });
    });
  });
});
