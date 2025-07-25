import { Injectable, Logger } from '@nestjs/common';

export interface CachedScanResult {
  repoUrl: string;
  commitHash: string;
  scanResult: any;
  timestamp: string;
  ttl: number; // Time to live in milliseconds
  scanCount: number;
}

export interface CacheConfig {
  defaultTtl: number; // Default TTL in milliseconds (e.g., 1 hour = 3600000)
  maxCacheSize: number; // Maximum number of cached entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

@Injectable()
export class ScanCacheService {
  private readonly logger = new Logger(ScanCacheService.name);
  private cache: Map<string, CachedScanResult> = new Map();
  private cleanupTimer?: NodeJS.Timeout;

  private readonly defaultConfig: CacheConfig = {
    defaultTtl: 3600000, // 1 hour
    maxCacheSize: 100,
    cleanupInterval: 300000, // 5 minutes
  };

  constructor() {
    this.startCleanupTimer();
  }

  /**
   * Get cached scan result for a repository and commit hash
   */
  getCachedResult(repoUrl: string, commitHash: string): any | null {
    const cacheKey = this.generateCacheKey(repoUrl, commitHash);
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      this.logger.debug(`Cache miss for ${repoUrl} at commit ${commitHash}`);
      return null;
    }

    // Check if cache entry has expired
    const now = Date.now();
    const expiryTime = new Date(cached.timestamp).getTime() + cached.ttl;

    if (now > expiryTime) {
      this.logger.debug(`Cache expired for ${repoUrl} at commit ${commitHash}`);
      this.cache.delete(cacheKey);
      return null;
    }

    this.logger.debug(`Cache hit for ${repoUrl} at commit ${commitHash}`);
    return cached.scanResult;
  }

  /**
   * Cache a scan result
   */
  cacheResult(repoUrl: string, commitHash: string, scanResult: any, ttl?: number): void {
    const cacheKey = this.generateCacheKey(repoUrl, commitHash);
    const now = new Date().toISOString();
    const effectiveTtl = ttl || this.defaultConfig.defaultTtl;

    // Check if we need to evict entries due to size limit
    if (this.cache.size >= this.defaultConfig.maxCacheSize) {
      this.evictOldestEntries();
    }

    const cachedEntry: CachedScanResult = {
      repoUrl,
      commitHash,
      scanResult,
      timestamp: now,
      ttl: effectiveTtl,
      scanCount: 1,
    };

    this.cache.set(cacheKey, cachedEntry);
    this.logger.debug(`Cached scan result for ${repoUrl} at commit ${commitHash}`);
  }

  /**
   * Invalidate cache for a specific repository
   */
  invalidateRepository(repoUrl: string): void {
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (value.repoUrl === repoUrl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    this.logger.debug(`Invalidated cache for repository: ${repoUrl} (${keysToDelete.length} entries)`);
  }

  /**
   * Invalidate cache for a specific repository and commit hash
   */
  invalidateCommit(repoUrl: string, commitHash: string): void {
    const cacheKey = this.generateCacheKey(repoUrl, commitHash);
    const deleted = this.cache.delete(cacheKey);
    
    if (deleted) {
      this.logger.debug(`Invalidated cache for ${repoUrl} at commit ${commitHash}`);
    }
  }

  /**
   * Clear all cached results
   */
  clearCache(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.debug(`Cleared entire cache (${size} entries)`);
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): {
    totalEntries: number;
    totalSize: number;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const entries = Array.from(this.cache.values());
    
    if (entries.length === 0) {
      return {
        totalEntries: 0,
        totalSize: 0,
      };
    }

    const timestamps = entries.map(e => e.timestamp).sort();
    
    return {
      totalEntries: entries.length,
      totalSize: entries.length,
      oldestEntry: timestamps[0],
      newestEntry: timestamps[timestamps.length - 1],
    };
  }

  /**
   * Get all cached repositories
   */
  getCachedRepositories(): string[] {
    const repositories = new Set<string>();
    
    for (const entry of this.cache.values()) {
      repositories.add(entry.repoUrl);
    }

    return Array.from(repositories);
  }

  /**
   * Check if a repository has any cached results
   */
  hasCachedResults(repoUrl: string): boolean {
    for (const entry of this.cache.values()) {
      if (entry.repoUrl === repoUrl) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the most recent cached result for a repository
   */
  getMostRecentCachedResult(repoUrl: string): any | null {
    let mostRecent: CachedScanResult | null = null;
    
    for (const entry of this.cache.values()) {
      if (entry.repoUrl === repoUrl) {
        if (!mostRecent || new Date(entry.timestamp) > new Date(mostRecent.timestamp)) {
          mostRecent = entry;
        }
      }
    }
    
    if (mostRecent) {
      this.logger.debug(`Found most recent cached result for ${repoUrl} at commit ${mostRecent.commitHash}`);
      return mostRecent.scanResult;
    }
    
    return null;
  }

  /**
   * Get all cached results for a repository
   */
  getCachedResultsForRepository(repoUrl: string): CachedScanResult[] {
    const results: CachedScanResult[] = [];
    
    for (const entry of this.cache.values()) {
      if (entry.repoUrl === repoUrl) {
        results.push(entry);
      }
    }
    
    // Sort by timestamp (most recent first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return results;
  }

  /**
   * Generate cache key from repository URL and commit hash
   */
  private generateCacheKey(repoUrl: string, commitHash: string): string {
    return `${repoUrl}:${commitHash}`;
  }

  /**
   * Evict oldest cache entries when size limit is reached
   */
  private evictOldestEntries(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort(([, a], [, b]) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Remove oldest 10% of entries
    const entriesToRemove = Math.max(1, Math.floor(entries.length * 0.1));
    
    for (let i = 0; i < entriesToRemove; i++) {
      this.cache.delete(entries[i][0]);
    }

    this.logger.debug(`Evicted ${entriesToRemove} oldest cache entries`);
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.defaultConfig.cleanupInterval);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiryTime = new Date(entry.timestamp).getTime() + entry.ttl;
      
      if (now > expiryTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  /**
   * Stop cleanup timer (for testing)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
} 