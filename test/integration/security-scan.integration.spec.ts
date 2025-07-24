import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { SecurityScanController } from '../../src/security-scan/security-scan.controller';
import { SecurityScanService } from '../../src/security-scan/security-scan.service';
import { EnhancedGitScmProvider } from '../../src/security-scan/providers/scm-git-enhanced.provider';
import { SemgrepScanner } from '../../src/security-scan/providers/scanner-semgrep.service';
import { GitleaksScanner } from '../../src/security-scan/providers/scanner-gitleaks.service';
import { ScmManagerService } from '../../src/security-scan/providers/scm-manager.service';
import { ScanStorageService } from '../../src/security-scan/providers/scan-storage.service';
import { ScmProviderRegistryService } from '../../src/security-scan/providers/scm-provider.registry';
import { ApiKeyGuard } from '../../src/security-scan/guards/api-key.guard';
import { ConfigModule } from '../../src/config/config.module';
import * as tmp from 'tmp-promise';
import simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';

// Mock external dependencies
jest.mock('tmp-promise');
jest.mock('simple-git');
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
      gitlab: {
        id: 123,
        name: 'test-repo',
        visibility: 'public'
      }
    },
    common: {
      visibility: 'public',
      forksCount: 0,
      starsCount: 0,
      webUrl: 'https://gitlab.com/test/repo'
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
    hostname: 'gitlab.com',
    owner: 'test',
    repository: 'repo',
    fullName: 'test/repo',
    originalUrl: 'https://gitlab.com/test/repo'
  }),
  normalizeRepositoryUrl: jest.fn().mockReturnValue('https://gitlab.com/test/repo'),
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

describe('SecurityScan Integration Tests', () => {
  let app: INestApplication;
  let scanService: SecurityScanService;
  let scmManager: ScmManagerService;
  let semgrepScanner: SemgrepScanner;
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    scanService = moduleFixture.get<SecurityScanService>(SecurityScanService);
    scmManager = moduleFixture.get<ScmManagerService>(ScmManagerService);
    semgrepScanner = new SemgrepScanner();
    scanStorage = moduleFixture.get<ScanStorageService>(ScanStorageService);

    // Setup mocks
    (tmp.dir as jest.Mock).mockResolvedValue(mockTmpDir);
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
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
        gitlab: {
          id: 123,
          name: 'test-repo',
          visibility: 'public'
        }
      },
      common: {
        visibility: 'public',
        forksCount: 0,
        starsCount: 0,
        webUrl: 'https://gitlab.com/test/repo'
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

  describe('Full Scan Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should handle semgrep failure gracefully', async () => {
      // Mock semgrep to fail
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(new Error('Semgrep failed'), null, 'Error output');
        } else {
          callback(null, 'Success', '');
        }
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle empty semgrep results', async () => {
      // Mock semgrep to return empty results
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(null, JSON.stringify({ results: [] }), '');
        } else {
          callback(null, 'Success', '');
        }
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });

  describe('Change Detection Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should force scan bypass change detection', async () => {
      // Mock successful scan
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(null, JSON.stringify({ results: [] }), '');
        } else {
          callback(null, 'Success', '');
        }
      });

      const result = await scanService.scanRepository(testRepoUrl, true);

      expect(result.changeDetection?.scanSkipped).toBe(false);
      expect(result.changeDetection?.hasChanges).toBe(true);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should handle malformed semgrep output', async () => {
      // Mock semgrep to return malformed JSON
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(null, 'Invalid JSON', '');
        } else {
          callback(null, 'Success', '');
        }
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle semgrep output without results property', async () => {
      // Mock semgrep to return output without results property
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(null, JSON.stringify({ other: 'data' }), '');
        } else {
          callback(null, 'Success', '');
        }
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(0);
      expect(result.securityIssues).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should handle concurrent scans', async () => {
      // Mock successful scans
      mockExec.mockImplementation((command, callback) => {
        if (command.includes('semgrep')) {
          callback(null, JSON.stringify({ results: [] }), '');
        } else {
          callback(null, 'Success', '');
        }
      });

      const promises = [
        scanService.scanRepository(testRepoUrl),
        scanService.scanRepository(testRepoUrl),
        scanService.scanRepository(testRepoUrl)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.findings).toHaveLength(0);
        expect(result.securityIssues).toHaveLength(0);
      });
    });
  });
}); 