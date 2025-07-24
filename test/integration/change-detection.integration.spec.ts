import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SecurityScanController } from '../../src/security-scan/security-scan.controller';
import { SecurityScanService } from '../../src/security-scan/security-scan.service';
import { SemgrepScanner } from '../../src/security-scan/providers/scanner-semgrep.service';
import { GitleaksScanner } from '../../src/security-scan/providers/scanner-gitleaks.service';
import { ScmManagerService } from '../../src/security-scan/providers/scm-manager.service';
import { ScanStorageService } from '../../src/security-scan/providers/scan-storage.service';
import { ScmProviderRegistryService } from '../../src/security-scan/providers/scm-provider.registry';
import { ApiKeyGuard } from '../../src/security-scan/guards/api-key.guard';
import { ConfigModule } from '../../src/config/config.module';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn().mockImplementation((command, args, options) => {
    // Create a mock process object that mimics the real spawn behavior
    const mockProcess = {
      stdout: {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            // Simulate stdout data based on the command
            if (command === 'semgrep') {
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
                  {
                    check_id: 'SEC-002',
                    extra: {
                      message: 'Weak encryption detected',
                      severity: 'MEDIUM',
                    },
                    path: 'src/auth.ts',
                    start: { line: 25 },
                  },
                  {
                    check_id: 'SEC-003',
                    extra: {
                      message: 'SQL injection vulnerability',
                      severity: 'HIGH',
                    },
                    path: 'src/database.ts',
                    start: { line: 15 },
                  }
                ],
              };
              callback(Buffer.from(JSON.stringify(mockOutput)));
            } else if (command === 'gitleaks') {
              // Gitleaks typically returns empty output for clean repos
              callback(Buffer.from(''));
            }
          }
          return mockProcess.stdout;
        }),
      },
      stderr: {
        on: jest.fn().mockImplementation((event, callback) => {
          if (event === 'data') {
            // Simulate stderr data
            callback(Buffer.from(''));
          }
          return mockProcess.stderr;
        }),
      },
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
          // Simulate successful process completion
          setTimeout(() => callback(0), 10);
        } else if (event === 'error') {
          // Don't trigger error by default
        }
        return mockProcess;
      }),
      kill: jest.fn(),
    };
    
    return mockProcess;
  }),
}));

// Mock SCM Providers
const mockScmProvider = {
  getName: jest.fn().mockReturnValue('Mock SCM Provider'),
  getPlatform: jest.fn().mockReturnValue('git'),
  getSupportedHostnames: jest.fn().mockReturnValue(['*']),
  canHandle: jest.fn().mockReturnValue(true),
  cloneRepository: jest.fn().mockImplementation(async (url: string, targetPath: string) => {
    // Actually create the directory and some test files
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
    
    // Create some test files for the scanners to find
    const testFiles = [
      'package.json',
      'src/config.ts',
      'src/main.ts',
      'README.md'
    ];
    
    for (const file of testFiles) {
      const filePath = path.join(targetPath, file);
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create different content for different files
      let content = '';
      if (file === 'package.json') {
        content = JSON.stringify({ name: 'test-repo', version: '1.0.0' });
      } else if (file === 'src/config.ts') {
        content = 'const API_KEY = "sk-1234567890abcdef"; // This should be detected by scanners';
      } else if (file === 'src/main.ts') {
        content = 'console.log("Hello World");';
      } else {
        content = '# Test Repository\n\nThis is a test repository.';
      }
      
      fs.writeFileSync(filePath, content);
    }
    
    return targetPath;
  }),
  fetchRepoMetadata: jest.fn().mockResolvedValue({
    name: 'test-repo',
    description: 'Test repository',
    defaultBranch: 'main',
    lastCommit: {
      hash: 'test-commit-hash',
      timestamp: new Date().toISOString(),
      message: 'Test commit',
      author: 'Test Author'
    },
    platform: {
      github: {
        id: 123,
        name: 'test-repo',
        fullName: 'test/repo',
        visibility: 'public'
      }
    },
    common: {
      visibility: 'public',
      forksCount: 0,
      starsCount: 0,
      webUrl: 'https://github.com/test/repo'
    }
  }),
  getLastCommitHash: jest.fn().mockResolvedValue('test-commit-hash'),
  hasChangesSince: jest.fn().mockResolvedValue({
    hasChanges: false,
    lastCommitHash: 'test-commit-hash',
    changeCount: 0
  }),
  configureAuthentication: jest.fn(),
  getConfig: jest.fn().mockReturnValue({
    name: 'Mock SCM Provider',
    platform: 'git',
    hostnames: ['*'],
    supportsPrivateRepos: true,
    supportsApi: true
  }),
  parseRepositoryUrl: jest.fn().mockReturnValue({
    platform: 'git',
    hostname: 'github.com',
    owner: 'test',
    repository: 'repo',
    fullName: 'test/repo',
    originalUrl: 'https://github.com/test/repo'
  }),
  normalizeRepositoryUrl: jest.fn().mockReturnValue('https://github.com/test/repo'),
  isAuthenticated: jest.fn().mockReturnValue(false),
  validateAuthentication: jest.fn().mockResolvedValue(true),
  healthCheck: jest.fn().mockResolvedValue({
    isHealthy: true,
    responseTime: 100,
    lastChecked: new Date().toISOString(),
    apiAvailable: true,
    authenticationValid: false
  })
};

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
      imports: [ConfigModule],
      controllers: [SecurityScanController],
      providers: [
        SecurityScanService,
        ApiKeyGuard,
        ScanStorageService,
        SemgrepScanner,
        GitleaksScanner,
        ScmProviderRegistryService,
        ScmManagerService,
        {
          provide: 'SCANNERS',
          useFactory: (semgrepScanner: SemgrepScanner, gitleaksScanner: GitleaksScanner) => {
            return [semgrepScanner, gitleaksScanner];
          },
          inject: [SemgrepScanner, GitleaksScanner],
        },
        {
          provide: 'SCM_PROVIDERS_SETUP',
          useFactory: (registry: ScmProviderRegistryService) => {
            // Register mock provider instead of real providers
            registry.registerProvider(mockScmProvider as any);
            return registry;
          },
          inject: [ScmProviderRegistryService],
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    scanStorage = moduleFixture.get<ScanStorageService>(ScanStorageService);

    // Setup mocks
    // (tmp.dir as jest.Mock).mockResolvedValue(mockTmpDir); // This line is no longer needed
    // (simpleGit as jest.Mock).mockReturnValue(mockGit); // This line is no longer needed
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Clear scan records before each test
    scanStorage.clearScanRecords();
    
    // Reset mock SCM provider
    mockScmProvider.cloneRepository.mockResolvedValue(undefined);
    mockScmProvider.fetchRepoMetadata.mockResolvedValue({
      name: 'test-repo',
      description: 'Test repository',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'test-commit-hash',
        timestamp: new Date().toISOString(),
        message: 'Test commit',
        author: 'Test Author'
      },
      platform: {
        github: {
          id: 123,
          name: 'test-repo',
          fullName: 'test/repo',
          visibility: 'public'
        }
      },
      common: {
        visibility: 'public',
        forksCount: 0,
        starsCount: 0,
        webUrl: 'https://github.com/test/repo'
      }
    });
    mockScmProvider.getLastCommitHash.mockResolvedValue('test-commit-hash');
    mockScmProvider.hasChangesSince.mockResolvedValue({
      hasChanges: false,
      lastCommitHash: 'test-commit-hash',
      changeCount: 0
    });
    
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
    it('should perform full scan on first request', async () => {
      const response = await request(app.getHttpServer())
        .post('/scan')
        .set('X-API-Key', 'test-api-key')
        .send({ repoUrl: 'https://gitlab.com/test/repo' })
        .expect(201);

      expect(response.body).toHaveProperty('repository');
      expect(response.body).toHaveProperty('scanner');
      expect(response.body).toHaveProperty('findings');
      expect(response.body).toHaveProperty('changeDetection');
      expect(response.body.changeDetection.scanSkipped).toBe(false);
      expect(response.body.changeDetection.hasChanges).toBe(true);
    }, 10000);
  });

  describe('GET /scan/records', () => {
    it('should return scan records', async () => {
      const response = await request(app.getHttpServer())
        .get('/scan/records')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('repository');
        expect(response.body[0]).toHaveProperty('scanner');
        expect(response.body[0]).toHaveProperty('findings');
        expect(response.body[0]).toHaveProperty('timestamp');
      }
    }, 10000);
  });
}); 