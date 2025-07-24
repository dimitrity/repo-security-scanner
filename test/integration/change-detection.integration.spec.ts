import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ScanStorageService } from '../../src/security-scan/providers/scan-storage.service';
import * as tmp from 'tmp-promise';
import simpleGit from 'simple-git';

// Mock external dependencies
jest.mock('tmp-promise');
jest.mock('simple-git');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('Change Detection Integration', () => {
  let app: INestApplication;
  let scanStorage: ScanStorageService;

  const mockTmpDir = {
    path: '/tmp/test-repo',
    cleanup: jest.fn(),
  };

  const mockGit = {
    clone: jest.fn(),
    branch: jest.fn(),
    log: jest.fn(),
    raw: jest.fn(),
  };

  const mockExec = require('child_process').exec;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    scanStorage = moduleFixture.get<ScanStorageService>(ScanStorageService);

    // Setup mocks
    (tmp.dir as jest.Mock).mockResolvedValue(mockTmpDir);
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear scan records before each test
    scanStorage.clearScanRecords();
    
    // Default successful git clone
    mockGit.clone.mockResolvedValue(undefined);
    mockGit.branch.mockResolvedValue({ current: 'main' });
    mockGit.log.mockResolvedValue({ latest: { hash: 'test-commit-hash' } });
    mockGit.raw.mockResolvedValue('main');
    
    // Default successful semgrep scan
    mockExec.mockImplementation((command, options, callback) => {
      if (command.includes('semgrep')) {
        const mockOutput = {
          results: [
            {
              check_id: 'SEC-001',
              extra: {
                message: 'Hardcoded secret found',
                severity: 'HIGH',
              },
              path: 'src/config.ts',
              start: { line: 10 },
            },
          ],
        };
        if (callback) {
          callback(null, JSON.stringify(mockOutput), '');
        }
      } else if (command.includes('gitleaks')) {
        if (callback) {
          callback(null, '', '');
        }
      }
      return {} as any;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /scan', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should perform full scan on first request', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('scanner');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('changeDetection');
      expect(response.body.changeDetection.hasChanges).toBe(true);
      expect(response.body.changeDetection.scanSkipped).toBe(false);
      expect(response.body.changeDetection.lastCommitHash).toBeTruthy();
    }, 10000);

    it('should skip scan on second request if no changes', async () => {
      // First scan
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      // Second scan - should be skipped
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      expect(response.body.changeDetection.scanSkipped).toBe(true);
      expect(response.body.changeDetection.hasChanges).toBe(false);
      expect(response.body.changeDetection.reason).toBe('No changes detected since last scan');
      expect(response.body.scanner.name).toBe('Change Detection');
      expect(response.body.findings).toEqual([
        {
          ruleId: 'CHANGE-DETECTION-001',
          message: 'No changes detected for the repo',
          filePath: 'N/A',
          line: 0,
          severity: 'info',
        },
      ]);
    }, 10000);

    it('should perform scan when changes are detected', async () => {
      // First scan
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      // Simulate changes by updating the scan record with a different commit hash
      const records = scanStorage.getAllScanRecords();
      const record = records.find(r => r.repoUrl === testRepoUrl);
      if (record) {
        scanStorage.updateScanRecord(testRepoUrl, 'different-commit-hash');
      }

      // Second scan - should detect changes and perform scan
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      expect(response.body.changeDetection.scanSkipped).toBe(false);
      expect(response.body.changeDetection.hasChanges).toBe(true);
      expect(response.body.scanner.name).toBe('Multiple Scanners');
    }, 10000);
  });

  describe('POST /scan/force', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should bypass change detection and perform scan', async () => {
      // First scan
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      // Force scan - should perform scan regardless of changes
      const response = await request(app.getHttpServer())
        .post('/scan/force')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      expect(response.body.changeDetection.scanSkipped).toBe(false);
      expect(response.body.changeDetection.hasChanges).toBe(true);
      expect(response.body.scanner.name).toBe('Multiple Scanners');
    }, 10000);
  });

  describe('GET /scan/statistics', () => {
    it('should return scan statistics', async () => {
      const testRepoUrl = 'https://github.com/test/repo';

      // Perform a scan
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      // Get statistics
      const response = await request(app.getHttpServer())
        .get('/scan/statistics')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body).toHaveProperty('totalScans');
      expect(response.body).toHaveProperty('totalRepositories');
      expect(response.body).toHaveProperty('lastScanTimestamp');
      expect(response.body.totalScans).toBeGreaterThan(0);
    }, 10000);
  });

  describe('GET /scan/records', () => {
    it('should return scan records', async () => {
      const testRepoUrl = 'https://github.com/test/repo';

      // Perform a scan
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: testRepoUrl })
        .expect(201);

      // Get records
      const response = await request(app.getHttpServer())
        .get('/scan/records')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const record = response.body[0];
      expect(record).toHaveProperty('repoUrl');
      expect(record).toHaveProperty('lastCommitHash');
      expect(record).toHaveProperty('lastScanTimestamp');
    }, 10000);
  });

  describe('Error handling', () => {
    it('should handle invalid repository URLs', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: 'https://invalid-repo-url.com' })
        .expect(500); // Should return 500 for invalid URLs

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Internal server error');
    }, 10000);

    it('should handle missing API key', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .send({ repoUrl: 'https://github.com/test/repo' })
        .expect(401);
    }, 10000);

    it('should handle invalid request body', async () => {
      await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ invalidField: 'value' })
        .expect(400);
    }, 10000);
  });
}); 