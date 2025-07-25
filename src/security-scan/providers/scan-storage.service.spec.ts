import { Test, TestingModule } from '@nestjs/testing';
import { ScanStorageService, ScanRecord, ScanHistoryEntry } from './scan-storage.service';

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
        lastScanDuration: undefined,
        lastScanStatus: 'success',
        lastScanFindings: undefined,
        cacheHitCount: 0,
      });
    });
  });

  describe('updateScanRecord', () => {
    it('should create new scan record with default options', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      
      service.updateScanRecord(repoUrl, commitHash);
      const result = service.getLastScanRecord(repoUrl);
      
      expect(result?.repoUrl).toBe(repoUrl);
      expect(result?.lastCommitHash).toBe(commitHash);
      expect(result?.scanCount).toBe(1);
      expect(result?.lastScanTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result?.lastScanStatus).toBe('success');
      expect(result?.cacheHitCount).toBe(0);
    });

    it('should create new scan record with custom options', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      
      service.updateScanRecord(repoUrl, commitHash, {
        duration: 5000,
        status: 'failed',
        findings: 10,
        cacheHit: false,
      });
      
      const result = service.getLastScanRecord(repoUrl);
      expect(result?.lastScanDuration).toBe(5000);
      expect(result?.lastScanStatus).toBe('failed');
      expect(result?.lastScanFindings).toBe(10);
      expect(result?.cacheHitCount).toBe(0);
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

    it('should increment cache hit count when cacheHit is true', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      
      service.updateScanRecord(repoUrl, commitHash, { cacheHit: true });
      service.updateScanRecord(repoUrl, commitHash, { cacheHit: true });
      
      const result = service.getLastScanRecord(repoUrl);
      expect(result?.cacheHitCount).toBe(2);
    });
  });

  describe('getScanHistory', () => {
    it('should return empty array for repository with no history', () => {
      const history = service.getScanHistory('https://github.com/test/repo');
      expect(history).toEqual([]);
    });

    it('should return scan history for repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      service.updateScanRecord(repoUrl, 'hash1', { duration: 1000, findings: 5 });
      service.updateScanRecord(repoUrl, 'hash2', { duration: 2000, findings: 10 });
      
      const history = service.getScanHistory(repoUrl);
      
      expect(history).toHaveLength(2);
      expect(history[0].commitHash).toBe('hash2'); // Most recent first
      expect(history[0].duration).toBe(2000);
      expect(history[0].findings).toBe(10);
      expect(history[1].commitHash).toBe('hash1');
      expect(history[1].duration).toBe(1000);
      expect(history[1].findings).toBe(5);
    });

    it('should limit history entries', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      // Add more than 50 entries
      for (let i = 0; i < 60; i++) {
        service.updateScanRecord(repoUrl, `hash${i}`, { duration: i * 100 });
      }
      
      const history = service.getScanHistory(repoUrl, 50); // Explicitly request 50
      expect(history).toHaveLength(50); // Should be limited to 50
      expect(history[0].commitHash).toBe('hash59'); // Most recent
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
      expect(result.map(r => r.repoUrl)).toContain(repo1);
      expect(result.map(r => r.repoUrl)).toContain(repo2);
    });
  });

  describe('clearScanRecords', () => {
    it('should clear all scan records and history', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      service.updateScanRecord(repoUrl, 'hash1');
      service.updateScanRecord(repoUrl, 'hash2');
      
      service.clearScanRecords();
      
      expect(service.getLastScanRecord(repoUrl)).toBeNull();
      expect(service.getScanHistory(repoUrl)).toEqual([]);
      expect(service.getAllScanRecords()).toEqual([]);
    });
  });

  describe('getScanStatistics', () => {
    it('should return empty statistics when no records exist', () => {
      const stats = service.getScanStatistics();
      
      expect(stats).toEqual({
        totalRepositories: 0,
        totalScans: 0,
        totalCacheHits: 0,
        averageScanDuration: 0,
        repositoriesWithHistory: 0,
      });
    });

    it('should return correct statistics for multiple repositories', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      
      service.updateScanRecord(repo1, 'hash1', { duration: 1000, findings: 5, cacheHit: true });
      service.updateScanRecord(repo1, 'hash2', { duration: 2000, findings: 10 });
      service.updateScanRecord(repo2, 'hash3', { duration: 1500, findings: 3, cacheHit: true });
      
      const stats = service.getScanStatistics();
      
      expect(stats.totalRepositories).toBe(2);
      expect(stats.totalScans).toBe(3);
      expect(stats.totalCacheHits).toBe(2);
      expect(stats.averageScanDuration).toBe(1750); // (2000 + 1500) / 2 = 1750 (only last durations)
      expect(stats.repositoriesWithHistory).toBe(2);
    });
  });

  describe('getStaleRepositories', () => {
    it('should return repositories that haven\'t been scanned recently', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      
      // Add a recent scan
      service.updateScanRecord(repo1, 'hash1');
      
      // Add an old scan (simulate by setting timestamp in the past)
      const oldRecord = {
        repoUrl: repo2,
        lastCommitHash: 'hash2',
        lastScanTimestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
        scanCount: 1,
      };
      
      // Manually set the old record
      (service as any).scanRecords.set(repo2, oldRecord);
      
      const staleRepos = service.getStaleRepositories(24); // 24 hours
      
      expect(staleRepos).toHaveLength(1);
      expect(staleRepos[0].repoUrl).toBe(repo2);
    });
  });

  describe('getMostScannedRepositories', () => {
    it('should return repositories sorted by scan count', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      const repo3 = 'https://github.com/test/repo3';
      
      service.updateScanRecord(repo1, 'hash1');
      service.updateScanRecord(repo1, 'hash2');
      service.updateScanRecord(repo1, 'hash3');
      
      service.updateScanRecord(repo2, 'hash4');
      service.updateScanRecord(repo2, 'hash5');
      
      service.updateScanRecord(repo3, 'hash6');
      
      const mostScanned = service.getMostScannedRepositories(2);
      
      expect(mostScanned).toHaveLength(2);
      expect(mostScanned[0].repoUrl).toBe(repo1);
      expect(mostScanned[0].scanCount).toBe(3);
      expect(mostScanned[1].repoUrl).toBe(repo2);
      expect(mostScanned[1].scanCount).toBe(2);
    });
  });

  describe('getMostCachedRepositories', () => {
    it('should return repositories sorted by cache hit count', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      const repo3 = 'https://github.com/test/repo3';
      
      service.updateScanRecord(repo1, 'hash1', { cacheHit: true });
      service.updateScanRecord(repo1, 'hash2', { cacheHit: true });
      service.updateScanRecord(repo1, 'hash3', { cacheHit: true });
      
      service.updateScanRecord(repo2, 'hash4', { cacheHit: true });
      service.updateScanRecord(repo2, 'hash5');
      
      service.updateScanRecord(repo3, 'hash6');
      
      const mostCached = service.getMostCachedRepositories(2);
      
      expect(mostCached).toHaveLength(2);
      expect(mostCached[0].repoUrl).toBe(repo1);
      expect(mostCached[0].cacheHitCount).toBe(3);
      expect(mostCached[1].repoUrl).toBe(repo2);
      expect(mostCached[1].cacheHitCount).toBe(1);
    });
  });

  describe('isRecentlyScanned', () => {
    it('should return false for repository with no scan record', () => {
      const isRecent = service.isRecentlyScanned('https://github.com/test/repo');
      expect(isRecent).toBe(false);
    });

    it('should return true for recently scanned repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      service.updateScanRecord(repoUrl, 'hash1');
      
      const isRecent = service.isRecentlyScanned(repoUrl, 60); // 60 minutes
      expect(isRecent).toBe(true);
    });

    it('should return false for old scan', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      // Create an old scan record
      const oldRecord = {
        repoUrl,
        lastCommitHash: 'hash1',
        lastScanTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        scanCount: 1,
      };
      
      (service as any).scanRecords.set(repoUrl, oldRecord);
      
      const isRecent = service.isRecentlyScanned(repoUrl, 60); // 60 minutes
      expect(isRecent).toBe(false);
    });
  });

  describe('getLastCommitHash', () => {
    it('should return null for repository with no scan record', () => {
      const hash = service.getLastCommitHash('https://github.com/test/repo');
      expect(hash).toBeNull();
    });

    it('should return last commit hash for repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      
      service.updateScanRecord(repoUrl, commitHash);
      
      const hash = service.getLastCommitHash(repoUrl);
      expect(hash).toBe(commitHash);
    });
  });
}); 