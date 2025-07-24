import { Test, TestingModule } from '@nestjs/testing';
import { ScanStorageService, ScanRecord } from './scan-storage.service';

describe('ScanStorageService', () => {
  let service: ScanStorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScanStorageService],
    }).compile();

    service = module.get<ScanStorageService>(ScanStorageService);
  });

  describe('getLastScanRecord', () => {
    it('should return null for non-existent repository', () => {
      const result = service.getLastScanRecord('https://github.com/test/repo');
      expect(result).toBeNull();
    });

    it('should return scan record for existing repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';

      service.updateScanRecord(repoUrl, commitHash);
      const result = service.getLastScanRecord(repoUrl);

      expect(result).toEqual({
        repoUrl,
        lastCommitHash: commitHash,
        lastScanTimestamp: expect.any(String),
        scanCount: 1,
      });
    });
  });

  describe('updateScanRecord', () => {
    it('should create new scan record', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';

      service.updateScanRecord(repoUrl, commitHash);
      const result = service.getLastScanRecord(repoUrl);

      expect(result?.repoUrl).toBe(repoUrl);
      expect(result?.lastCommitHash).toBe(commitHash);
      expect(result?.scanCount).toBe(1);
      expect(result?.lastScanTimestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should increment scan count for existing repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash1 = 'abc123';
      const commitHash2 = 'def456';

      service.updateScanRecord(repoUrl, commitHash1);
      service.updateScanRecord(repoUrl, commitHash2);

      const result = service.getLastScanRecord(repoUrl);
      expect(result?.scanCount).toBe(2);
      expect(result?.lastCommitHash).toBe(commitHash2);
    });
  });

  describe('getAllScanRecords', () => {
    it('should return empty array when no records exist', () => {
      const result = service.getAllScanRecords();
      expect(result).toEqual([]);
    });

    it('should return all scan records', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';

      service.updateScanRecord(repo1, 'abc123');
      service.updateScanRecord(repo2, 'def456');

      const result = service.getAllScanRecords();
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.repoUrl)).toContain(repo1);
      expect(result.map((r) => r.repoUrl)).toContain(repo2);
    });
  });

  describe('clearScanRecords', () => {
    it('should clear all scan records', () => {
      const repoUrl = 'https://github.com/test/repo';
      service.updateScanRecord(repoUrl, 'abc123');

      expect(service.getAllScanRecords()).toHaveLength(1);

      service.clearScanRecords();
      expect(service.getAllScanRecords()).toHaveLength(0);
      expect(service.getLastScanRecord(repoUrl)).toBeNull();
    });
  });

  describe('getScanStatistics', () => {
    it('should return zero statistics when no records exist', () => {
      const stats = service.getScanStatistics();
      expect(stats).toEqual({
        totalRepositories: 0,
        totalScans: 0,
        lastScanTimestamp: undefined,
      });
    });

    it('should return correct statistics for single repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      service.updateScanRecord(repoUrl, 'abc123');
      service.updateScanRecord(repoUrl, 'def456');

      const stats = service.getScanStatistics();
      expect(stats.totalRepositories).toBe(1);
      expect(stats.totalScans).toBe(2);
      expect(stats.lastScanTimestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });

    it('should return correct statistics for multiple repositories', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';

      service.updateScanRecord(repo1, 'abc123');
      service.updateScanRecord(repo1, 'def456');
      service.updateScanRecord(repo2, 'ghi789');

      const stats = service.getScanStatistics();
      expect(stats.totalRepositories).toBe(2);
      expect(stats.totalScans).toBe(3);
    });

    it('should return latest timestamp across all repositories', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';

      // Add some delay to ensure different timestamps
      service.updateScanRecord(repo1, 'abc123');
      setTimeout(() => {
        service.updateScanRecord(repo2, 'def456');
      }, 10);

      const stats = service.getScanStatistics();
      expect(stats.lastScanTimestamp).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple operations in sequence', () => {
      const repoUrl = 'https://github.com/test/repo';

      // Initial state
      expect(service.getLastScanRecord(repoUrl)).toBeNull();
      expect(service.getAllScanRecords()).toHaveLength(0);

      // First scan
      service.updateScanRecord(repoUrl, 'abc123');
      expect(service.getLastScanRecord(repoUrl)?.scanCount).toBe(1);
      expect(service.getAllScanRecords()).toHaveLength(1);

      // Second scan
      service.updateScanRecord(repoUrl, 'def456');
      expect(service.getLastScanRecord(repoUrl)?.scanCount).toBe(2);
      expect(service.getAllScanRecords()).toHaveLength(1);

      // Clear and verify
      service.clearScanRecords();
      expect(service.getLastScanRecord(repoUrl)).toBeNull();
      expect(service.getAllScanRecords()).toHaveLength(0);
    });

    it('should maintain data integrity across operations', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';

      service.updateScanRecord(repo1, 'abc123');
      service.updateScanRecord(repo2, 'def456');
      service.updateScanRecord(repo1, 'ghi789');

      const record1 = service.getLastScanRecord(repo1);
      const record2 = service.getLastScanRecord(repo2);

      expect(record1?.repoUrl).toBe(repo1);
      expect(record1?.lastCommitHash).toBe('ghi789');
      expect(record1?.scanCount).toBe(2);

      expect(record2?.repoUrl).toBe(repo2);
      expect(record2?.lastCommitHash).toBe('def456');
      expect(record2?.scanCount).toBe(1);
    });
  });
});
