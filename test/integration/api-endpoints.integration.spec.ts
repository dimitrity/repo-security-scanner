import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '../../src/config/config.service';
import * as request from 'supertest';

describe('API Basic Integration Tests', () => {
  let app: INestApplication;
  let configService: ConfigService;

  // Test API key
  const TEST_API_KEY = 'test-api-key-2025';

  beforeAll(async () => {
    // Set test environment variables with very high limits to avoid rate limiting
    process.env.API_KEYS = TEST_API_KEY;
    process.env.THROTTLE_TTL = '60';
    process.env.THROTTLE_LIMIT = '10000'; // Very high limit for testing
    process.env.SCAN_THROTTLE_TTL = '60';
    process.env.SCAN_THROTTLE_LIMIT = '10000';
    process.env.METADATA_THROTTLE_TTL = '60';
    process.env.METADATA_THROTTLE_LIMIT = '10000';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    configService = moduleFixture.get<ConfigService>(ConfigService);
  }, 30000); // Increase timeout for setup

  afterAll(async () => {
    await app.close();
  }, 10000); // Increase timeout for cleanup

  describe('Authentication & Authorization', () => {
    it('should require API key for protected endpoints', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .send({ repoUrl: 'https://github.com/test/repo' })
        .expect(401);
    });

    it('should reject invalid API key', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', 'invalid-key')
        .send({ repoUrl: 'https://github.com/test/repo' })
        .expect(401);
    });
  });

  describe('Input Validation', () => {
    it('should validate repository URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid.com/repo',
        'http://',
        '',
      ];

      for (const invalidUrl of invalidUrls) {
        await request(app.getHttpServer())
          .post('/scan')
          .set('x-api-key', TEST_API_KEY)
          .send({ repoUrl: invalidUrl })
          .expect(400);
      }
    });

    it('should reject requests with extra properties', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', TEST_API_KEY)
        .send({ 
          repoUrl: 'https://github.com/test/repo',
          extraProperty: 'should-be-rejected'
        })
        .expect(400);
    });

    it('should validate code context request parameters', async () => {
      // Test missing required fields
      await request(app.getHttpServer())
        .post('/scan/context')
        .set('x-api-key', TEST_API_KEY)
        .send({ repoUrl: 'https://github.com/test/repo' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/scan/context')
        .set('x-api-key', TEST_API_KEY)
        .send({ 
          repoUrl: 'https://github.com/test/repo',
          filePath: 'src/main.ts'
        })
        .expect(400);

      // Test invalid line number
      await request(app.getHttpServer())
        .post('/scan/context')
        .set('x-api-key', TEST_API_KEY)
        .send({ 
          repoUrl: 'https://github.com/test/repo',
          filePath: 'src/main.ts',
          line: -1
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/scan/context')
        .set('x-api-key', TEST_API_KEY)
        .send({ 
          repoUrl: 'https://github.com/test/repo',
          filePath: 'src/main.ts',
          line: 0
        })
        .expect(400);
    });
  });

  describe('Statistics Endpoint', () => {
    it('should return scan statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/scan/statistics')
        .set('x-api-key', TEST_API_KEY)
        .expect(200);

      expect(response.body).toHaveProperty('totalScans');
      expect(response.body).toHaveProperty('totalRepositories');
      expect(typeof response.body.totalScans).toBe('number');
      expect(typeof response.body.totalRepositories).toBe('number');
    });
  });

  describe('Records Endpoint', () => {
    it('should return scan records', async () => {
      const response = await request(app.getHttpServer())
        .get('/scan/records')
        .set('x-api-key', TEST_API_KEY)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', TEST_API_KEY)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle unsupported HTTP methods', async () => {
      await request(app.getHttpServer())
        .put('/scan')
        .set('x-api-key', TEST_API_KEY)
        .expect(404);

      await request(app.getHttpServer())
        .delete('/scan')
        .set('x-api-key', TEST_API_KEY)
        .expect(404);
    });
  });

  describe('Throttler Configuration Integration', () => {
    it('should respect throttler configuration from environment', () => {
      const throttlerConfig = configService.getThrottlerConfig();
      expect(throttlerConfig).toHaveProperty('ttl');
      expect(throttlerConfig).toHaveProperty('limit');
      expect(typeof throttlerConfig.ttl).toBe('number');
      expect(typeof throttlerConfig.limit).toBe('number');
      expect(throttlerConfig.ttl).toBe(60);
      expect(throttlerConfig.limit).toBe(10000);
    });

    it('should provide endpoint-specific throttler configuration', () => {
      const endpointConfig = configService.getEndpointThrottlerConfig();
      expect(endpointConfig).toHaveProperty('default');
      expect(endpointConfig).toHaveProperty('scan');
      expect(endpointConfig).toHaveProperty('metadata');
      
      expect(endpointConfig.default.ttl).toBe(60);
      expect(endpointConfig.default.limit).toBe(10000);
      expect(endpointConfig.scan.ttl).toBe(60);
      expect(endpointConfig.scan.limit).toBe(10000);
      expect(endpointConfig.metadata.ttl).toBe(60);
      expect(endpointConfig.metadata.limit).toBe(10000);
    });

    it('should handle environment variable overrides', () => {
      // Temporarily set different values
      const originalTtl = process.env.THROTTLE_TTL;
      const originalLimit = process.env.THROTTLE_LIMIT;
      
      process.env.THROTTLE_TTL = '120';
      process.env.THROTTLE_LIMIT = '50';

      try {
        const config = configService.getThrottlerConfig();
        expect(config.ttl).toBe(120);
        expect(config.limit).toBe(50);
      } finally {
        // Restore original values
        process.env.THROTTLE_TTL = originalTtl;
        process.env.THROTTLE_LIMIT = originalLimit;
      }
    });

    it('should handle invalid environment variables gracefully', () => {
      // Temporarily set invalid values
      const originalTtl = process.env.THROTTLE_TTL;
      const originalLimit = process.env.THROTTLE_LIMIT;
      
      process.env.THROTTLE_TTL = 'invalid';
      process.env.THROTTLE_LIMIT = 'invalid';

      try {
        const config = configService.getThrottlerConfig();
        expect(config.ttl).toBe(60); // Should fall back to default
        expect(config.limit).toBe(10); // Should fall back to default
      } finally {
        // Restore original values
        process.env.THROTTLE_TTL = originalTtl;
        process.env.THROTTLE_LIMIT = originalLimit;
      }
    });
  });

  describe('API Response Headers', () => {
    it('should include appropriate headers in responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/scan/statistics')
        .set('x-api-key', TEST_API_KEY)
        .expect(200);

      expect(response.headers).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });
  });
}); 