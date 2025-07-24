import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { SecurityScanService } from '../../src/security-scan/security-scan.service';
import { EnhancedGitScmProvider } from '../../src/security-scan/providers/scm-git-enhanced.provider';
import { SemgrepScanner } from '../../src/security-scan/providers/scanner-semgrep.service';
import { ScmManagerService } from '../../src/security-scan/providers/scm-manager.service';
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

  const mockTmpDir = {
    path: '/tmp/test-repo',
    cleanup: jest.fn(),
  };

  const mockGit = {
    clone: jest.fn(),
  };

  const mockExec = require('child_process').exec;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    scanService = moduleFixture.get<SecurityScanService>(SecurityScanService);
    scmManager = moduleFixture.get<ScmManagerService>(ScmManagerService);
    semgrepScanner = new SemgrepScanner();

    // Setup mocks
    (tmp.dir as jest.Mock).mockResolvedValue(mockTmpDir);
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Full Scan Integration', () => {
    const testRepoUrl = 'https://github.com/test/repo';

    it('should complete full scan workflow successfully', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock successful semgrep scan
      const mockSemgrepOutput = {
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

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      // Execute full scan
      const result = await scanService.scanRepository(testRepoUrl);

      // Verify git clone was called
      expect(mockGit.clone).toHaveBeenCalledWith(testRepoUrl, mockTmpDir.path);

      // Verify semgrep was called with correct parameters
      expect(mockExec).toHaveBeenCalledWith(
        `semgrep --config=auto --json --quiet ${mockTmpDir.path}`,
        { maxBuffer: 1024 * 1024 * 10 },
        expect.any(Function),
      );

      // Verify cleanup was called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();

      // Verify result structure
      expect(result).toHaveProperty('repository');
      expect(result).toHaveProperty('scanner');
      expect(result).toHaveProperty('findings');
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].ruleId).toBe('SEC-001');
    });

    it('should handle git clone failure gracefully', async () => {
      // Mock git clone failure
      mockGit.clone.mockRejectedValue(new Error('Repository not found'));

      // Execute scan and expect failure
      await expect(scanService.scanRepository(testRepoUrl)).rejects.toThrow(
        'Repository not found',
      );

      // Verify cleanup was still called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle semgrep failure gracefully', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock semgrep failure
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(new Error('Semgrep command failed'), '', 'stderr');
        }
        return {} as any;
      });

      // Execute scan and expect failure
      await expect(scanService.scanRepository(testRepoUrl)).rejects.toThrow(
        'Semgrep command failed',
      );

      // Verify cleanup was still called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle empty semgrep results', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock empty semgrep results
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify({ results: [] }), '');
        }
        return {} as any;
      });

      // Execute scan
      const result = await scanService.scanRepository(testRepoUrl);

      // Verify result has empty findings
      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle multiple findings from semgrep', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock multiple semgrep findings
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'SEC-001',
            extra: { message: 'Finding 1', severity: 'HIGH' },
            path: 'src/file1.ts',
            start: { line: 10 },
          },
          {
            check_id: 'SEC-002',
            extra: { message: 'Finding 2', severity: 'MEDIUM' },
            path: 'src/file2.ts',
            start: { line: 20 },
          },
          {
            check_id: 'SEC-003',
            extra: { message: 'Finding 3', severity: 'LOW' },
            path: 'src/file3.ts',
            start: { line: 30 },
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      // Execute scan
      const result = await scanService.scanRepository(testRepoUrl);

      // Verify all findings are returned
      expect(result.findings).toHaveLength(3);
      expect(result.findings[0].ruleId).toBe('SEC-001');
      expect(result.findings[1].ruleId).toBe('SEC-002');
      expect(result.findings[2].ruleId).toBe('SEC-003');
    });
  });

  describe('Component Integration', () => {
    it('should integrate GitScmProvider with SemgrepScanner', async () => {
      // Test that components work together
      const repoUrl = 'https://github.com/test/repo';
      const targetPath = '/tmp/test-repo';

      // Mock git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock semgrep scan
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify({ results: [] }), '');
        }
        return {} as any;
      });

      // Test git provider
      await scmManager.cloneRepository(repoUrl, targetPath);
      expect(mockGit.clone).toHaveBeenCalledWith(repoUrl, targetPath);

      // Test semgrep scanner
      const findings = await semgrepScanner.scan(targetPath);
      expect(Array.isArray(findings)).toBe(true);
    });

    it('should handle component failures in sequence', async () => {
      // Test that failures are properly propagated
      const repoUrl = 'https://github.com/test/repo';
      const targetPath = '/tmp/test-repo';

      // Mock git clone failure
      mockGit.clone.mockRejectedValue(new Error('Git clone failed'));

      // Test that git failure is caught
      await expect(
        scmManager.cloneRepository(repoUrl, targetPath),
      ).rejects.toThrow('Git clone failed');

      // Mock successful git clone but semgrep failure
      mockGit.clone.mockResolvedValue(undefined);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(new Error('Semgrep failed'), '', '');
        }
        return {} as any;
      });

      // Test that semgrep failure is caught
      await expect(semgrepScanner.scan(targetPath)).rejects.toThrow(
        'Semgrep failed',
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should ensure cleanup happens on any error', async () => {
      // Mock git clone failure
      mockGit.clone.mockRejectedValue(new Error('Random error'));

      try {
        await scanService.scanRepository('https://github.com/test/repo');
      } catch (error) {
        // Expected to fail
      }

      // Verify cleanup was called despite error
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle malformed semgrep output', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock malformed semgrep output
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, 'invalid json', '');
        }
        return {} as any;
      });

      // Execute scan and expect failure
      await expect(
        scanService.scanRepository('https://github.com/test/repo'),
      ).rejects.toThrow();

      // Verify cleanup was called
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle semgrep output without results property', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock semgrep output without results
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify({ otherProperty: 'value' }), '');
        }
        return {} as any;
      });

      // Execute scan
      const result = await scanService.scanRepository(
        'https://github.com/test/repo',
      );

      // Should return empty findings
      expect(result.findings).toHaveLength(0);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large repositories efficiently', async () => {
      // Mock successful git clone
      mockGit.clone.mockResolvedValue(undefined);

      // Mock large semgrep output
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        check_id: `SEC-${i.toString().padStart(3, '0')}`,
        extra: { message: `Finding ${i}`, severity: 'LOW' },
        path: `src/file${i}.ts`,
        start: { line: i + 1 },
      }));

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify({ results: largeResults }), '');
        }
        return {} as any;
      });

      // Execute scan
      const result = await scanService.scanRepository(
        'https://github.com/test/repo',
      );

      // Verify all findings are processed
      expect(result.findings).toHaveLength(1000);
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should handle concurrent scans', async () => {
      // Mock successful operations
      mockGit.clone.mockResolvedValue(undefined);
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify({ results: [] }), '');
        }
        return {} as any;
      });

      // Execute multiple concurrent scans
      const scanPromises = Array.from({ length: 5 }, (_, i) =>
        scanService.scanRepository(`https://github.com/test/repo${i}`),
      );

      const results = await Promise.all(scanPromises);

      // Verify all scans completed successfully
      results.forEach((result) => {
        expect(result).toHaveProperty('repository');
        expect(result).toHaveProperty('scanner');
        expect(result).toHaveProperty('findings');
      });

      // Verify cleanup was called for each scan
      expect(mockTmpDir.cleanup).toHaveBeenCalledTimes(5);
    });
  });
});
