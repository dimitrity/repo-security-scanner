import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

// Mock external dependencies like in integration tests
jest.mock('tmp-promise');
jest.mock('simple-git');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('SecurityScanController (e2e)', () => {
  let app: INestApplication;

  const mockTmpDir = {
    path: '/tmp/test-repo',
    cleanup: jest.fn(),
  };

  const mockGit = {
    clone: jest.fn(),
    branch: jest.fn(),
    log: jest.fn(),
    show: jest.fn(),
  };

  const mockExec = require('child_process').exec;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    
    // Enable CORS for testing (same as main.ts)
    const isProduction = process.env.NODE_ENV === 'production';
    app.enableCors({
      origin: isProduction ? ['http://localhost:8080', 'http://localhost:3000'] : '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'x-api-key'],
    });
    
    await app.init();

    // Setup mocks
    (require('tmp-promise').dir as jest.Mock).mockResolvedValue(mockTmpDir);
    (require('simple-git') as jest.Mock).mockReturnValue(mockGit);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default successful mocks
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.branch.mockResolvedValue({ current: 'main' });
    mockGit.log.mockResolvedValue({
      latest: {
        hash: 'abc123456',
        date: new Date().toISOString(),
        message: 'Test commit',
        author_name: 'Test Author',
        author_email: 'test@example.com'
      }
    });
    mockGit.show.mockResolvedValue('commit details');
    
    // Mock successful scanner commands
    mockExec.mockImplementation((command, options, callback) => {
      if (callback) {
        if (command.includes('semgrep')) {
          callback(null, JSON.stringify({ results: [] }), '');
        } else if (command.includes('gitleaks')) {
          callback(null, JSON.stringify([]), '');
        } else {
          callback(null, '', '');
        }
      }
      return {} as any;
    });
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
          extraProperty: 'should-be-rejected'
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

      expect(res.status).toBe(201); // Should succeed because HTTP headers are trimmed
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
          .send({ repoUrl: validRepoUrl })
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(res => {
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

      expect(res.status).toBe(204); // OPTIONS requests return 204 No Content
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('POST');
      expect(res.headers['access-control-allow-headers']).toContain('x-api-key');
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
