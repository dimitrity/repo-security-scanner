import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { SecurityScanService } from '../../src/security-scan/security-scan.service';
import { EnhancedGitScmProvider } from '../../src/security-scan/providers/scm-git-enhanced.provider';
import { SemgrepScanner } from '../../src/security-scan/providers/scanner-semgrep.service';
import { ScmManagerService } from '../../src/security-scan/providers/scm-manager.service';
import { ScanStorageService } from '../../src/security-scan/providers/scan-storage.service';
import * as tmp from 'tmp-promise';
import simpleGit from 'simple-git';

// Mock external dependencies
jest.mock('tmp-promise');
jest.mock('simple-git');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

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
      imports: [AppModule],
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

    it('should complete full scan workflow successfully', async () => {
      // Execute full scan (first time, so no change detection)
      const result = await scanService.scanRepository(testRepoUrl);

      // Verify git clone was called
      expect(mockGit.clone).toHaveBeenCalledWith(testRepoUrl, mockTmpDir.path, []);

      // Verify semgrep was called
      expect(mockExec).toHaveBeenCalledWith(
        `semgrep --config=auto --json --quiet ${mockTmpDir.path}`,
        { maxBuffer: 1024 * 1024 * 10 },
        expect.any(Function)
      );

      // Verify cleanup was called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();

      // Verify result structure
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('scanner');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('changeDetection');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('SEC-001');
    }, 10000);

    it('should handle git clone failure gracefully', async () => {
      // Mock git clone failure
      mockGit.clone.mockRejectedValue(new Error('Repository not found'));

      // Execute scan and expect failure
      await expect(scanService.scanRepository(testRepoUrl)).rejects.toThrow('Failed to clone repository');

      // Verify cleanup was still called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);

    it('should handle semgrep failure gracefully', async () => {
      // Mock semgrep failure
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          if (callback) {
            callback(new Error('Semgrep command failed'), '', '');
          }
        }
        return {} as any;
      });

      // Execute scan - should handle gracefully and return empty results
      const result = await scanService.scanRepository(testRepoUrl);

      // Should return successful result with empty findings
      expect(result).toHaveProperty('findings');
      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);

    it('should handle empty semgrep results', async () => {
      // Mock empty semgrep results
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          const mockOutput = { results: [] };
          if (callback) {
            callback(null, JSON.stringify(mockOutput), '');
          }
        }
        return {} as any;
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);

    it('should handle multiple findings from semgrep', async () => {
      // Mock multiple semgrep findings
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          const mockOutput = {
            results: [
              {
                check_id: 'SEC-001',
                extra: { message: 'Secret 1', severity: 'HIGH' },
                path: 'src/config.ts',
                start: { line: 10 },
              },
              {
                check_id: 'SEC-002',
                extra: { message: 'Secret 2', severity: 'MEDIUM' },
                path: 'src/database.ts',
                start: { line: 25 },
              },
              {
                check_id: 'SEC-003',
                extra: { message: 'Secret 3', severity: 'LOW' },
                path: 'src/auth.ts',
                start: { line: 15 },
              },
            ],
          };
          if (callback) {
            callback(null, JSON.stringify(mockOutput), '');
          }
        }
        return {} as any;
      });

      const result = await scanService.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(3);
      expect(result.findings[0].ruleId).toBe('SEC-001');
      expect(result.findings[1].ruleId).toBe('SEC-002');
      expect(result.findings[2].ruleId).toBe('SEC-003');
    }, 10000);
  });

  describe('Change Detection Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should return change detection result on second scan', async () => {
      // First scan - should perform actual scan
      const firstResult = await scanService.scanRepository(testRepoUrl);
      expect(firstResult.scanner.name).toBe('Multiple Scanners');
      expect(firstResult.findings.length).toBeGreaterThan(0);

      // Second scan - should return change detection result
      const secondResult = await scanService.scanRepository(testRepoUrl);
      expect(secondResult.scanner.name).toBe('Change Detection');
      expect(secondResult.findings).toHaveLength(1);
      expect(secondResult.findings[0].ruleId).toBe('CHANGE-DETECTION-001');
      expect(secondResult.changeDetection?.scanSkipped).toBe(true);
    }, 10000);

    it('should force scan bypass change detection', async () => {
      // First scan
      await scanService.scanRepository(testRepoUrl);

      // Force scan - should perform actual scan
      const forceResult = await scanService.scanRepository(testRepoUrl, true);
      expect(forceResult.scanner.name).toBe('Multiple Scanners');
      expect(forceResult.changeDetection?.scanSkipped).toBe(false);
    }, 10000);
  });

  describe('Component Integration', () => {
    const repoUrl = 'https://github.com/test/repo';
    const targetPath = '/tmp/test-repo';

    it('should integrate GitScmProvider with SemgrepScanner', async () => {
      // Test git provider
      await scmManager.cloneRepository(repoUrl, targetPath);
      expect(mockGit.clone).toHaveBeenCalledWith(repoUrl, targetPath, []);

      // Test semgrep scanner directly
      const findings = await semgrepScanner.scan(targetPath);
      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('SEC-001');
    }, 10000);

    it('should handle component failures in sequence', async () => {
      // Mock git failure
      mockGit.clone.mockRejectedValue(new Error('Git clone failed'));

      // Test that git failure is caught
      await expect(scmManager.cloneRepository(repoUrl, targetPath)).rejects.toThrow('Git clone failed');

      // Mock successful git clone but semgrep failure
      mockGit.clone.mockResolvedValue(undefined);
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          if (callback) {
            callback(new Error('Semgrep failed'), '', '');
          }
        }
        return {} as any;
      });

      // Test semgrep failure handling
      const findings = await semgrepScanner.scan(targetPath);
      expect(findings).toHaveLength(0);
    }, 10000);
  });

  describe('Error Handling Integration', () => {
    it('should ensure cleanup happens on any error', async () => {
      // Mock git failure
      mockGit.clone.mockRejectedValue(new Error('Random error'));

      try {
        await scanService.scanRepository('https://github.com/test/repo');
      } catch (error) {
        // Expected to fail
      }

      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);

    it('should handle malformed semgrep output', async () => {
      // Mock malformed semgrep output
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          if (callback) {
            callback(null, 'invalid json', '');
          }
        }
        return {} as any;
      });

      // Execute scan - should handle gracefully
      const result = await scanService.scanRepository('https://github.com/test/repo');

      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);

    it('should handle semgrep output without results property', async () => {
      // Mock semgrep output without results
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          const mockOutput = { otherProperty: 'value' };
          if (callback) {
            callback(null, JSON.stringify(mockOutput), '');
          }
        }
        return {} as any;
      });

      const result = await scanService.scanRepository('https://github.com/test/repo');

      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 10000);
  });

  describe('Performance Integration', () => {
    it('should handle large repositories efficiently', async () => {
      // Mock large number of findings
      mockExec.mockImplementation((command, options, callback) => {
        if (command.includes('semgrep')) {
          const results = Array.from({ length: 1000 }, (_, i) => ({
            check_id: `SEC-${i.toString().padStart(3, '0')}`,
            extra: { message: `Finding ${i}`, severity: 'HIGH' },
            path: `src/file${i}.ts`,
            start: { line: i + 1 },
          }));
          const mockOutput = { results };
          if (callback) {
            callback(null, JSON.stringify(mockOutput), '');
          }
        }
        return {} as any;
      });

      const result = await scanService.scanRepository('https://github.com/test/repo');

      expect(result.findings).toHaveLength(1000);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    }, 15000);

    it('should handle concurrent scans', async () => {
      const scanPromises = Array.from({ length: 5 }, (_, i) =>
        scanService.scanRepository(`https://github.com/test/repo${i}`)
      );

      const results = await Promise.all(scanPromises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('findings');
        expect(result).toHaveProperty('repository');
      });

      // Verify cleanup was called for each scan
      expect(mockTmpDir.cleanup).toHaveBeenCalledTimes(5);
    }, 20000);
  });
}); 