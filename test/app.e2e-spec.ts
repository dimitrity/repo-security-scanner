import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('SecurityScanController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  describe('POST /scan', () => {
    const validApiKey = 'test-for-arnika-987';
    const validRepoUrl = 'https://github.com/example/repo';

    it('should successfully scan a repository', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('repository');
      expect(res.body).toHaveProperty('scanner');
      expect(res.body).toHaveProperty('findings');

      // Validate repository structure
      expect(res.body.repository).toHaveProperty('name');
      expect(res.body.repository).toHaveProperty('description');
      expect(res.body.repository).toHaveProperty('defaultBranch');
      expect(res.body.repository).toHaveProperty('lastCommit');
      expect(res.body.repository.lastCommit).toHaveProperty('hash');
      expect(res.body.repository.lastCommit).toHaveProperty('timestamp');

      // Validate scanner structure
      expect(res.body.scanner).toHaveProperty('name');
      expect(res.body.scanner).toHaveProperty('version');

      // Validate findings structure
      expect(Array.isArray(res.body.findings)).toBe(true);
    });

    it('should return 401 when API key is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or missing API key');
    });

    it('should return 401 when API key is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', 'invalid-key')
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or missing API key');
    });

    it('should return 401 when API key is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', '')
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Invalid or missing API key');
    });

    it('should return 400 when repoUrl is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: 'not-a-url' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when repoUrl is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when repoUrl is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: '' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when repoUrl is not a string', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: 123 });

      expect(res.status).toBe(400);
    });

    it('should reject requests with extra properties', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({
          repoUrl: validRepoUrl,
          extraProperty: 'should-be-rejected',
        });

      expect(res.status).toBe(400);
    });

    it('should handle different valid URL formats', async () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user/repo/tree/main',
      ];

      for (const url of validUrls) {
        const res = await request(app.getHttpServer())
          .post('/scan')
          .set('x-api-key', validApiKey)
          .send({ repoUrl: url });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('repository');
        expect(res.body).toHaveProperty('scanner');
        expect(res.body).toHaveProperty('findings');
      }
    });

    it('should handle case-sensitive API key', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', 'TEST-FOR-ARNIKA-987')
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(401);
    });

    it('should handle API key with whitespace', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', ' test-for-arnika-987 ')
        .send({ repoUrl: validRepoUrl });

      expect(res.status).toBe(401);
    });

    it('should return consistent response structure', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: validRepoUrl });

      const res2 = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', validApiKey)
        .send({ repoUrl: validRepoUrl });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      // Both responses should have the same structure
      expect(Object.keys(res1.body)).toEqual(Object.keys(res2.body));
      expect(res1.body).toHaveProperty('repository');
      expect(res1.body).toHaveProperty('scanner');
      expect(res1.body).toHaveProperty('findings');
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app.getHttpServer())
          .post('/scan')
          .set('x-api-key', validApiKey)
          .send({ repoUrl: validRepoUrl }),
      );

      const responses = await Promise.all(requests);

      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('repository');
        expect(res.body).toHaveProperty('scanner');
        expect(res.body).toHaveProperty('findings');
      });
    });
  });

  describe('CORS', () => {
    it('should allow requests from any origin', async () => {
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('x-api-key', 'test-for-arnika-987')
        .set('Origin', 'https://example.com')
        .send({ repoUrl: 'https://github.com/example/repo' });

      expect(res.status).toBe(201);
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('should allow OPTIONS requests', async () => {
      const res = await request(app.getHttpServer())
        .options('/scan')
        .set('Origin', 'https://example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'x-api-key');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-headers']).toContain(
        'x-api-key',
      );
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
