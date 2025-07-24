import { Test, TestingModule } from '@nestjs/testing';
import { SecurityScanService } from './security-scan.service';
import { ScmManagerService } from './providers/scm-manager.service';
import { ScanStorageService } from './providers/scan-storage.service';
import { SemgrepScanner } from './providers/scanner-semgrep.service';

// Mock dependencies
jest.mock('tmp-promise');
jest.mock('fs');

const mockTmpDir = {
  path: '/tmp/test-repo',
  cleanup: jest.fn().mockResolvedValue(undefined),
};

const mockScmManager = {
  cloneRepository: jest.fn(),
  fetchRepositoryMetadata: jest.fn(),
  getLastCommitHash: jest.fn(),
  hasChangesSince: jest.fn(),
};

const mockSemgrepScanner = {
  getName: jest.fn().mockReturnValue('Semgrep'),
  getVersion: jest.fn().mockReturnValue('latest'),
  scan: jest.fn(),
};

const mockScanStorage = {
  getLastScanRecord: jest.fn(),
  updateScanRecord: jest.fn(),
  getScanStatistics: jest.fn(),
  getAllScanRecords: jest.fn(),
};

describe('SecurityScanService', () => {
  let service: SecurityScanService;
  let scmManager: jest.Mocked<ScmManagerService>;
  let scanStorage: jest.Mocked<ScanStorageService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityScanService,
        {
          provide: ScmManagerService,
          useValue: mockScmManager,
        },
        {
          provide: 'SCANNERS',
          useValue: [mockSemgrepScanner],
        },
        {
          provide: ScanStorageService,
          useValue: mockScanStorage,
        },
      ],
    }).compile();

    service = module.get<SecurityScanService>(SecurityScanService);
    scmManager = module.get(ScmManagerService);
    scanStorage = module.get(ScanStorageService);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup tmp-promise mock
    const tmp = require('tmp-promise');
    tmp.dir.mockResolvedValue(mockTmpDir);
  });

  describe('scanRepository', () => {
    const testRepoUrl = 'https://github.com/test/repo';
    const testMetadata = {
      name: 'test-repo',
      description: 'Test repository',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'abc123',
        timestamp: '2024-01-01T12:00:00Z',
      },
    };

    beforeEach(() => {
      scmManager.cloneRepository.mockResolvedValue({
        success: true,
        provider: 'Enhanced Git Provider',
      });
      scmManager.fetchRepositoryMetadata.mockResolvedValue({
        metadata: testMetadata,
        provider: 'Enhanced Git Provider',
      });
      scmManager.getLastCommitHash.mockResolvedValue({
        hash: 'abc123',
        provider: 'Enhanced Git Provider',
      });
      mockSemgrepScanner.scan.mockResolvedValue([]);
    });

    describe('when no previous scan record exists', () => {
      beforeEach(() => {
        scanStorage.getLastScanRecord.mockReturnValue(null);
      });

      it('should perform full scan and store commit hash', async () => {
        const result = await service.scanRepository(testRepoUrl);

        expect(scmManager.cloneRepository).toHaveBeenCalledWith(
          testRepoUrl,
          mockTmpDir.path,
        );
        expect(scmManager.fetchRepositoryMetadata).toHaveBeenCalledWith(
          testRepoUrl,
        );
        expect(scmManager.getLastCommitHash).toHaveBeenCalledWith(testRepoUrl);
        expect(scanStorage.updateScanRecord).toHaveBeenCalledWith(
          testRepoUrl,
          'abc123',
        );
        expect(mockSemgrepScanner.scan).toHaveBeenCalledWith(mockTmpDir.path);

        expect(result).toEqual({
          repository: testMetadata,
          scanner: { name: 'Semgrep', version: 'latest', findings: [] },
                      findings: [],
            allFindings: { Semgrep: [] },
          summary: {
            totalSecurityIssues: 0,
            scanners: [
              {
                name: 'Semgrep',
                version: 'latest',
                securityIssuesFound: 0,
                summary: 'Semgrep found 0 security issues',
              },
            ],
          },
          details: {
            scanners: [
              {
                name: 'Semgrep',
                version: 'latest',
                totalSecurityIssues: 0,
                severityBreakdown: {
                  high: 0,
                  medium: 0,
                  low: 0,
                  info: 0,
                },
                securityIssues: {
                  high: [],
                  medium: [],
                  low: [],
                  info: [],
                },
              },
            ],
          },
          changeDetection: {
            hasChanges: true,
            lastCommitHash: 'abc123',
            scanSkipped: false,
            reason: undefined,
          },
        });
      });

      it('should handle scanner findings', async () => {
        const mockFindings = [
          {
            ruleId: 'test-rule',
            message: 'Test finding',
            filePath: 'test.js',
            line: 10,
            severity: 'warning',
          },
        ];
        mockSemgrepScanner.scan.mockResolvedValue(mockFindings);

        const result = await service.scanRepository(testRepoUrl);

        expect(result.findings).toEqual([
          {
            ruleId: 'test-rule',
            message: 'Test finding',
            filePath: 'test.js',
            line: 10,
            severity: 'warning',
            scanner: 'Semgrep',
            codeContext: null,
          },
        ]);
      });
    });

    describe('when previous scan record exists', () => {
      const previousScanRecord = {
        repoUrl: testRepoUrl,
        lastCommitHash: 'abc123',
        lastScanTimestamp: '2024-01-01T10:00:00Z',
        scanCount: 1,
      };

      beforeEach(() => {
        scanStorage.getLastScanRecord.mockReturnValue(previousScanRecord);
      });

      describe('when no changes detected', () => {
        beforeEach(() => {
          scmManager.hasChangesSince.mockResolvedValue({
            result: {
              hasChanges: false,
              lastCommitHash: 'abc123',
            },
            provider: 'Enhanced Git Provider',
          });
        });

        it('should skip scan and return no-change finding', async () => {
          const result = await service.scanRepository(testRepoUrl);

          expect(scmManager.hasChangesSince).toHaveBeenCalledWith(
            testRepoUrl,
            'abc123',
          );
          expect(scmManager.cloneRepository).not.toHaveBeenCalled();
          expect(mockSemgrepScanner.scan).not.toHaveBeenCalled();
          expect(scanStorage.updateScanRecord).not.toHaveBeenCalled();

          expect(result).toEqual({
            repository: testMetadata,
            scanner: { name: 'Change Detection', version: '1.0' },
            findings: [
              {
                ruleId: 'CHANGE-DETECTION-001',
                message: 'No changes detected for the repo',
                filePath: 'N/A',
                line: 0,
                severity: 'info',
              },
            ],
            securityIssues: [
              {
                ruleId: 'CHANGE-DETECTION-001',
                message: 'No changes detected for the repo',
                filePath: 'N/A',
                line: 0,
                severity: 'info',
              },
            ],
            allSecurityIssues: {
              'Change Detection': [
                {
                  ruleId: 'CHANGE-DETECTION-001',
                  message: 'No changes detected for the repo',
                  filePath: 'N/A',
                  line: 0,
                  severity: 'info',
                },
              ],
            },

            changeDetection: {
              hasChanges: false,
              lastCommitHash: 'abc123',
              scanSkipped: true,
              reason: 'No changes detected since last scan',
            },
          });
        });
      });

      describe('when changes detected', () => {
        beforeEach(() => {
          scmManager.hasChangesSince.mockResolvedValue({
            result: {
              hasChanges: true,
              lastCommitHash: 'def456',
              changeSummary: {
                filesChanged: 5,
                additions: 120,
                deletions: 45,
                commits: 3,
              },
            },
            provider: 'Enhanced Git Provider',
          });
          scmManager.getLastCommitHash.mockResolvedValue({
            hash: 'def456',
            provider: 'Enhanced Git Provider',
          });
        });

        it('should perform full scan and update commit hash', async () => {
          const result = await service.scanRepository(testRepoUrl);

          expect(scmManager.hasChangesSince).toHaveBeenCalledWith(
            testRepoUrl,
            'abc123',
          );
          expect(scmManager.cloneRepository).toHaveBeenCalledWith(
            testRepoUrl,
            mockTmpDir.path,
          );
          expect(scmManager.getLastCommitHash).toHaveBeenCalledWith(
            testRepoUrl,
          );
          expect(scanStorage.updateScanRecord).toHaveBeenCalledWith(
            testRepoUrl,
            'def456',
          );
          expect(mockSemgrepScanner.scan).toHaveBeenCalledWith(mockTmpDir.path);

          expect(result.changeDetection).toEqual({
            hasChanges: true,
            lastCommitHash: 'def456',
            scanSkipped: false,
            reason: undefined,
          });
        });
      });

      describe('when change detection fails', () => {
        beforeEach(() => {
          scmManager.hasChangesSince.mockResolvedValue({
            result: {
              hasChanges: true,
              lastCommitHash: 'unknown',
            },
            provider: 'Enhanced Git Provider',
          });
        });

        it('should assume changes and perform scan', async () => {
          const result = await service.scanRepository(testRepoUrl);

          expect(scmManager.cloneRepository).toHaveBeenCalled();
          expect(mockSemgrepScanner.scan).toHaveBeenCalled();
          expect(result.changeDetection?.hasChanges).toBe(true);
        });
      });
    });

    describe('force scan', () => {
      const previousScanRecord = {
        repoUrl: testRepoUrl,
        lastCommitHash: 'abc123',
        lastScanTimestamp: '2024-01-01T10:00:00Z',
        scanCount: 1,
      };

      beforeEach(() => {
        scanStorage.getLastScanRecord.mockReturnValue(previousScanRecord);
        scmManager.hasChangesSince.mockResolvedValue({
          result: {
            hasChanges: false,
            lastCommitHash: 'abc123',
          },
          provider: 'Enhanced Git Provider',
        });
      });

      it('should bypass change detection and perform scan', async () => {
        const result = await service.scanRepository(testRepoUrl, true);

        expect(scmManager.hasChangesSince).not.toHaveBeenCalled();
        expect(scmManager.cloneRepository).toHaveBeenCalled();
        expect(mockSemgrepScanner.scan).toHaveBeenCalled();
        expect(scanStorage.updateScanRecord).toHaveBeenCalled();
      });
    });
  });

  describe('getScanStatistics', () => {
    it('should return scan statistics', () => {
      const mockStats = {
        totalRepositories: 5,
        totalScans: 15,
        lastScanTimestamp: '2024-01-01T12:00:00Z',
      };
      scanStorage.getScanStatistics.mockReturnValue(mockStats);

      const result = service.getScanStatistics();

      expect(scanStorage.getScanStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('getAllScanRecords', () => {
    it('should return all scan records', () => {
      const mockRecords = [
        {
          repoUrl: 'https://github.com/test/repo1',
          lastCommitHash: 'abc123',
          lastScanTimestamp: '2024-01-01T12:00:00Z',
          scanCount: 2,
        },
      ];
      scanStorage.getAllScanRecords.mockReturnValue(mockRecords);

      const result = service.getAllScanRecords();

      expect(scanStorage.getAllScanRecords).toHaveBeenCalled();
      expect(result).toEqual(mockRecords);
    });
  });

  describe('forceScanRepository', () => {
    it('should call scanRepository with force flag', async () => {
      const testRepoUrl = 'https://github.com/test/repo';
      const mockResult = {
        repository: {
          name: 'test',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: { hash: 'abc123', timestamp: '2023-01-01T00:00:00Z' },
        },
        scanner: { name: 'Semgrep', version: 'latest' },
        findings: [],
        allFindings: {},
        changeDetection: { hasChanges: true, lastCommitHash: 'abc123' },
      };

      jest.spyOn(service, 'scanRepository').mockResolvedValue(mockResult);

      const result = await service.forceScanRepository(testRepoUrl);

      expect(service.scanRepository).toHaveBeenCalledWith(testRepoUrl, true);
      expect(result).toEqual(mockResult);
    });
  });

  describe('error handling', () => {
    it('should handle clone repository errors', async () => {
      // Reset mocks for this specific test
      jest.clearAllMocks();
      scanStorage.getLastScanRecord.mockReturnValue(null);
      scmManager.cloneRepository.mockRejectedValue(new Error('Clone failed'));

      await expect(
        service.scanRepository('https://github.com/test/repo'),
      ).rejects.toThrow('Clone failed');
    });

    it('should handle scanner errors gracefully', async () => {
      // Reset mocks for this specific test
      jest.resetAllMocks();
      scanStorage.getLastScanRecord.mockReturnValue(null);
      const tmp = require('tmp-promise');
      tmp.dir.mockResolvedValue(mockTmpDir);
      scmManager.cloneRepository.mockResolvedValue({
        success: true,
        provider: 'Enhanced Git Provider',
      });
      scmManager.fetchRepositoryMetadata.mockResolvedValue({
        metadata: {
          name: 'test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: {
            hash: 'abc123',
            timestamp: '2024-01-01T12:00:00Z',
          },
        },
        provider: 'Enhanced Git Provider',
      });
      scmManager.getLastCommitHash.mockResolvedValue({
        hash: 'abc123',
        provider: 'Enhanced Git Provider',
      });
      mockSemgrepScanner.getName.mockReturnValue('Semgrep');
      mockSemgrepScanner.getVersion.mockReturnValue('latest');
      mockSemgrepScanner.scan.mockRejectedValue(new Error('Scanner failed'));

      // Scanner errors should not cause the entire scan to fail
      const result = await service.scanRepository(
        'https://github.com/test/repo',
      );

      expect(result.allFindings['Semgrep']).toEqual([]);
      expect(result.summary?.totalFindings).toBe(0);
    });

    it('should handle metadata fetch errors gracefully', async () => {
      // Reset mocks for this specific test
      jest.resetAllMocks();
      scanStorage.getLastScanRecord.mockReturnValue(null);
      const tmp = require('tmp-promise');
      tmp.dir.mockResolvedValue(mockTmpDir);
      scmManager.cloneRepository.mockResolvedValue({
        success: true,
        provider: 'Enhanced Git Provider',
      });
      scmManager.fetchRepositoryMetadata.mockRejectedValue(
        new Error('Metadata fetch failed'),
      );
      scmManager.getLastCommitHash.mockResolvedValue({
        hash: 'abc123',
        provider: 'Enhanced Git Provider',
      });
      mockSemgrepScanner.getName.mockReturnValue('Semgrep');
      mockSemgrepScanner.getVersion.mockReturnValue('latest');
      mockSemgrepScanner.scan.mockResolvedValue([]);

      // Metadata fetch errors should cause the scan to fail
      await expect(
        service.scanRepository('https://github.com/test/repo'),
      ).rejects.toThrow('Metadata fetch failed');
    });
  });

  describe('cleanup', () => {
    it('should cleanup temporary directory after scan', async () => {
      // Reset mocks for this specific test
      jest.resetAllMocks();
      scanStorage.getLastScanRecord.mockReturnValue(null);
      const tmp = require('tmp-promise');
      tmp.dir.mockResolvedValue(mockTmpDir);
      scmManager.cloneRepository.mockResolvedValue({
        success: true,
        provider: 'Enhanced Git Provider',
      });
      scmManager.fetchRepositoryMetadata.mockResolvedValue({
        metadata: {
          name: 'test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: {
            hash: 'abc123',
            timestamp: '2024-01-01T12:00:00Z',
          },
        },
        provider: 'Enhanced Git Provider',
      });

      scmManager.getLastCommitHash.mockResolvedValue({
        hash: 'abc123',
        provider: 'Enhanced Git Provider',
      });
      mockSemgrepScanner.getName.mockReturnValue('Semgrep');
      mockSemgrepScanner.getVersion.mockReturnValue('latest');
      mockSemgrepScanner.scan.mockResolvedValue([]);

      await service.scanRepository('https://github.com/test/repo');

      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });

    it('should cleanup temporary directory even if scan fails', async () => {
      // Reset mocks for this specific test
      jest.resetAllMocks();
      scanStorage.getLastScanRecord.mockReturnValue(null);
      const tmp = require('tmp-promise');
      tmp.dir.mockResolvedValue(mockTmpDir);
      scmManager.cloneRepository.mockRejectedValue(new Error('Clone failed'));

      await expect(
        service.scanRepository('https://github.com/test/repo'),
      ).rejects.toThrow('Clone failed');
      expect(mockTmpDir.cleanup).toHaveBeenCalled();
    });
  });
});
