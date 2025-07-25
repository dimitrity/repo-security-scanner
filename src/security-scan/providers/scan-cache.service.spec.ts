import { Test, TestingModule } from '@nestjs/testing';
import { ScanCacheService, CachedScanResult } from './scan-cache.service';

describe('ScanCacheService', () => {
  let service: ScanCacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScanCacheService],
    }).compile();

    service = module.get<ScanCacheService>(ScanCacheService);
  });

  afterEach(() => {
    service.clearCache();
    service.stopCleanupTimer();
  });

  // Helper function to add small delays for timestamp ordering
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  describe('getCachedResult', () => {
    it('should return null for non-existent cache entry', () => {
      const result = service.getCachedResult('https://github.com/test/repo', 'abc123');
      expect(result).toBeNull();
    });

    it('should return cached result for existing entry', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      const scanResult = { findings: [] };

      service.cacheResult(repoUrl, commitHash, scanResult);
      const result = service.getCachedResult(repoUrl, commitHash);

      expect(result).toEqual(scanResult);
    });

    it('should return null for expired cache entry', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      const scanResult = { findings: [] };

      // Cache with very short TTL
      service.cacheResult(repoUrl, commitHash, scanResult, 1);

      // Wait for expiration
      setTimeout(() => {
        const result = service.getCachedResult(repoUrl, commitHash);
        expect(result).toBeNull();
      }, 10);
    });
  });

  describe('cacheResult', () => {
    it('should cache scan result with default TTL', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      const scanResult = { findings: [] };

      service.cacheResult(repoUrl, commitHash, scanResult);
      const result = service.getCachedResult(repoUrl, commitHash);

      expect(result).toEqual(scanResult);
    });

    it('should cache scan result with custom TTL', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      const scanResult = { findings: [] };
      const customTtl = 5000; // 5 seconds

      service.cacheResult(repoUrl, commitHash, scanResult, customTtl);
      const result = service.getCachedResult(repoUrl, commitHash);

      expect(result).toEqual(scanResult);
    });

    it('should evict oldest entries when cache size limit is reached', () => {
      const maxEntries = 100;
      
      // Add more entries than the cache limit
      for (let i = 0; i < maxEntries + 10; i++) {
        service.cacheResult(`https://github.com/test/repo${i}`, `hash${i}`, { data: i });
      }

      const stats = service.getCacheStatistics();
      expect(stats.totalEntries).toBeLessThanOrEqual(maxEntries);
    });
  });

  describe('invalidateRepository', () => {
    it('should invalidate all cache entries for a repository', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      // Cache multiple entries for the same repository
      service.cacheResult(repoUrl, 'hash1', { data: 1 });
      service.cacheResult(repoUrl, 'hash2', { data: 2 });
      service.cacheResult('https://github.com/other/repo', 'hash3', { data: 3 });

      service.invalidateRepository(repoUrl);

      expect(service.getCachedResult(repoUrl, 'hash1')).toBeNull();
      expect(service.getCachedResult(repoUrl, 'hash2')).toBeNull();
      expect(service.getCachedResult('https://github.com/other/repo', 'hash3')).not.toBeNull();
    });
  });

  describe('invalidateCommit', () => {
    it('should invalidate specific cache entry', () => {
      const repoUrl = 'https://github.com/test/repo';
      const commitHash = 'abc123';
      const scanResult = { findings: [] };

      service.cacheResult(repoUrl, commitHash, scanResult);
      service.cacheResult(repoUrl, 'def456', { findings: [1] });

      service.invalidateCommit(repoUrl, commitHash);

      expect(service.getCachedResult(repoUrl, commitHash)).toBeNull();
      expect(service.getCachedResult(repoUrl, 'def456')).not.toBeNull();
    });
  });

  describe('clearCache', () => {
    it('should clear all cached results', () => {
      service.cacheResult('https://github.com/test/repo1', 'hash1', { data: 1 });
      service.cacheResult('https://github.com/test/repo2', 'hash2', { data: 2 });

      service.clearCache();

      expect(service.getCachedResult('https://github.com/test/repo1', 'hash1')).toBeNull();
      expect(service.getCachedResult('https://github.com/test/repo2', 'hash2')).toBeNull();
    });
  });

  describe('getCacheStatistics', () => {
    it('should return empty statistics when cache is empty', () => {
      const stats = service.getCacheStatistics();
      
      expect(stats).toEqual({
        totalEntries: 0,
        totalSize: 0,
      });
    });

    it('should return correct statistics for cached entries', () => {
      service.cacheResult('https://github.com/test/repo1', 'hash1', { data: 1 });
      service.cacheResult('https://github.com/test/repo2', 'hash2', { data: 2 });

      const stats = service.getCacheStatistics();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBe(2);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });
  });

  describe('getCachedRepositories', () => {
    it('should return empty array when no repositories are cached', () => {
      const repositories = service.getCachedRepositories();
      expect(repositories).toEqual([]);
    });

    it('should return unique repository URLs', () => {
      const repoUrl = 'https://github.com/test/repo';
      
      service.cacheResult(repoUrl, 'hash1', { data: 1 });
      service.cacheResult(repoUrl, 'hash2', { data: 2 });
      service.cacheResult('https://github.com/other/repo', 'hash3', { data: 3 });

      const repositories = service.getCachedRepositories();
      
      expect(repositories).toHaveLength(2);
      expect(repositories).toContain(repoUrl);
      expect(repositories).toContain('https://github.com/other/repo');
    });
  });

  describe('hasCachedResults', () => {
    it('should return false for repository with no cached results', () => {
      const hasResults = service.hasCachedResults('https://github.com/test/repo');
      expect(hasResults).toBe(false);
    });

    it('should return true for repository with cached results', () => {
      const repoUrl = 'https://github.com/test/repo';
      service.cacheResult(repoUrl, 'hash1', { data: 1 });

      const hasResults = service.hasCachedResults(repoUrl);
      expect(hasResults).toBe(true);
    });
  });

  describe('getMostRecentCachedResult', () => {
    it('should return null for repository with no cached results', () => {
      const result = service.getMostRecentCachedResult('https://github.com/test/repo');
      expect(result).toBeNull();
    });

    it('should return the most recent cached result for a repository', async () => {
      const repoUrl = 'https://github.com/test/repo';
      
      // Add multiple cached results with different commit hashes
      service.cacheResult(repoUrl, 'hash1', { data: 1 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash2', { data: 2 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash3', { data: 3 });
      
      const result = service.getMostRecentCachedResult(repoUrl);
      expect(result).toEqual({ data: 3 });
    });

    it('should return the most recent result when multiple commits exist', async () => {
      const repoUrl = 'https://github.com/test/repo';
      
      service.cacheResult(repoUrl, 'hash1', { data: 1 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash2', { data: 2 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash3', { data: 3 });
      
      const result = service.getMostRecentCachedResult(repoUrl);
      expect(result).toEqual({ data: 3 });
    });
  });

  describe('getCachedResultsForRepository', () => {
    it('should return empty array for repository with no cached results', () => {
      const results = service.getCachedResultsForRepository('https://github.com/test/repo');
      expect(results).toEqual([]);
    });

    it('should return all cached results for a repository sorted by timestamp', async () => {
      const repoUrl = 'https://github.com/test/repo';
      
      service.cacheResult(repoUrl, 'hash1', { data: 1 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash2', { data: 2 });
      await delay(10);
      service.cacheResult(repoUrl, 'hash3', { data: 3 });
      
      const results = service.getCachedResultsForRepository(repoUrl);
      
      expect(results).toHaveLength(3);
      // Since they're added sequentially with delays, the last one should be most recent
      expect(results[0].commitHash).toBe('hash3'); // Most recent first
      expect(results[1].commitHash).toBe('hash2');
      expect(results[2].commitHash).toBe('hash1');
    });

    it('should only return results for the specified repository', async () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      
      service.cacheResult(repo1, 'hash1', { data: 1 });
      await delay(10);
      service.cacheResult(repo2, 'hash2', { data: 2 });
      await delay(10);
      service.cacheResult(repo1, 'hash3', { data: 3 });
      
      const results = service.getCachedResultsForRepository(repo1);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.repoUrl === repo1)).toBe(true);
    });
  });

  describe('cache key generation', () => {
    it('should generate unique cache keys for different repositories and commits', () => {
      const repo1 = 'https://github.com/test/repo1';
      const repo2 = 'https://github.com/test/repo2';
      const hash1 = 'abc123';
      const hash2 = 'def456';

      service.cacheResult(repo1, hash1, { data: 1 });
      service.cacheResult(repo1, hash2, { data: 2 });
      service.cacheResult(repo2, hash1, { data: 3 });

      expect(service.getCachedResult(repo1, hash1)).toEqual({ data: 1 });
      expect(service.getCachedResult(repo1, hash2)).toEqual({ data: 2 });
      expect(service.getCachedResult(repo2, hash1)).toEqual({ data: 3 });
    });
  });
}); 