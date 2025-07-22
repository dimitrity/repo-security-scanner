import { Test, TestingModule } from '@nestjs/testing';
import { SecurityScanService } from './security-scan.service';
import { ScmProvider } from './scm.interface';
import { SecurityScanner } from './scanners.interface';
import { Logger } from '@nestjs/common';

// Mock tmp-promise
jest.mock('tmp-promise', () => ({
  dir: jest.fn().mockResolvedValue({
    path: '/tmp/test-repo',
    cleanup: jest.fn(),
  }),
}));

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock dependencies
const mockScmProvider = {
  cloneRepository: jest.fn(),
  fetchRepoMetadata: jest.fn(),
};

const mockScanner = {
  scan: jest.fn(),
  getName: jest.fn(),
  getVersion: jest.fn(),
};

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('SecurityScanService', () => {
  let service: SecurityScanService;
  let module: TestingModule;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [SecurityScanService],
    })
      .overrideProvider(SecurityScanService)
      .useClass(SecurityScanService)
      .compile();

    service = moduleFixture.get<SecurityScanService>(SecurityScanService);
    module = moduleFixture;

    // Reset mocks
    jest.clearAllMocks();
    
    // Mock the private properties
    (service as any).scmProvider = mockScmProvider;
    (service as any).scanners = [mockScanner];
  });

  afterEach(async () => {
    await module.close();
  });

  describe('scanRepository', () => {
    const testRepoUrl = 'https://github.com/test/repo';
    const mockMetadata = {
      name: 'test-repo',
      description: 'Test repository',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'abc123',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    };

    const mockFindings = [
      {
        ruleId: 'SEC-001',
        message: 'Hardcoded secret found',
        filePath: 'src/config.ts',
        line: 10,
        severity: 'HIGH',
      },
    ];

    beforeEach(() => {
      mockScmProvider.cloneRepository.mockResolvedValue(undefined);
      mockScmProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);
      mockScanner.scan.mockResolvedValue(mockFindings);
      mockScanner.getName.mockReturnValue('TestScanner');
      mockScanner.getVersion.mockReturnValue('1.0.0');
    });

    it('should successfully scan a repository', async () => {
      const result = await service.scanRepository(testRepoUrl);

      expect(mockScmProvider.cloneRepository).toHaveBeenCalledWith(testRepoUrl, '/tmp/test-repo');
      expect(mockScanner.scan).toHaveBeenCalledWith('/tmp/test-repo');
      expect(mockScmProvider.fetchRepoMetadata).toHaveBeenCalledWith(testRepoUrl);
      expect(require('tmp-promise').dir().cleanup).toHaveBeenCalled();

      expect(result).toEqual({
        repository: mockMetadata,
        scanner: {
          name: 'TestScanner',
          version: '1.0.0',
        },
        findings: mockFindings,
      });
    });

    it('should handle multiple scanners', async () => {
      const mockScanner2: SecurityScanner = {
        scan: jest.fn().mockResolvedValue([
          {
            ruleId: 'SEC-002',
            message: 'Another finding',
            filePath: 'src/auth.ts',
            line: 5,
            severity: 'MEDIUM',
          },
        ]),
        getName: jest.fn().mockReturnValue('TestScanner2'),
        getVersion: jest.fn().mockReturnValue('2.0.0'),
      };

      (service as any).scanners = [mockScanner, mockScanner2];

      const result = await service.scanRepository(testRepoUrl);

      expect(result.findings).toHaveLength(2);
      expect(result.scanner.name).toBe('TestScanner2'); // Last scanner's info
      expect(result.scanner.version).toBe('2.0.0');
    });

    it('should handle scanner errors gracefully', async () => {
      const scanError = new Error('Scanner failed');
      mockScanner.scan.mockRejectedValue(scanError);

      await expect(service.scanRepository(testRepoUrl)).rejects.toThrow('Scanner failed');
      expect(require('tmp-promise').dir().cleanup).toHaveBeenCalled();
    });

    it('should handle repository cloning errors', async () => {
      const cloneError = new Error('Clone failed');
      mockScmProvider.cloneRepository.mockRejectedValue(cloneError);

      await expect(service.scanRepository(testRepoUrl)).rejects.toThrow('Clone failed');
      expect(require('tmp-promise').dir().cleanup).toHaveBeenCalled();
    });

    it('should handle metadata fetch errors', async () => {
      const metadataError = new Error('Metadata fetch failed');
      mockScmProvider.fetchRepoMetadata.mockRejectedValue(metadataError);

      await expect(service.scanRepository(testRepoUrl)).rejects.toThrow('Metadata fetch failed');
      expect(require('tmp-promise').dir().cleanup).toHaveBeenCalled();
    });

    it('should ensure cleanup happens even if scan fails', async () => {
      mockScanner.scan.mockRejectedValue(new Error('Scan failed'));

      try {
        await service.scanRepository(testRepoUrl);
      } catch (error) {
        // Expected to fail
      }

      expect(require('tmp-promise').dir().cleanup).toHaveBeenCalled();
    });
  });

  describe('getCodeContext', () => {
    const mockFs = require('fs');

    beforeEach(() => {
      (service as any).lastScanPath = '/tmp/last-scan';
    });

    it('should return empty array when lastScanPath is not set', () => {
      (service as any).lastScanPath = null;
      const result = service.getCodeContext('src/test.ts', 10);
      expect(result).toEqual([]);
    });

    it('should return empty array when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      const result = service.getCodeContext('src/test.ts', 10);
      expect(result).toEqual([]);
    });

    it('should return code context when file exists', () => {
      const mockLines = ['line1', 'line2', 'line3', 'line4', 'line5', 'line6', 'line7'];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLines.join('\n'));

      const result = service.getCodeContext('src/test.ts', 4, 2);

      expect(result).toEqual(['line2', 'line3', 'line4', 'line5', 'line6']);
      expect(mockFs.readFileSync).toHaveBeenCalledWith('/tmp/last-scan/src/test.ts', 'utf-8');
    });

    it('should handle edge cases for line numbers', () => {
      const mockLines = ['line1', 'line2', 'line3'];
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(mockLines.join('\n'));

      // Test line 1 (should not go below 0)
      const result1 = service.getCodeContext('src/test.ts', 1, 2);
      expect(result1).toEqual(['line1', 'line2', 'line3']);

      // Test line 3 (should not exceed array length)
      const result2 = service.getCodeContext('src/test.ts', 3, 2);
      expect(result2).toEqual(['line1', 'line2', 'line3']);
    });
  });
}); 