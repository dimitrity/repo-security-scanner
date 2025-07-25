import { Injectable, Logger } from '@nestjs/common';

export interface ScanRecord {
  repoUrl: string;
  lastCommitHash: string;
  lastScanTimestamp: string;
  scanCount: number;
  lastScanDuration?: number; // Duration in milliseconds
  lastScanStatus?: 'success' | 'failed' | 'cached';
  lastScanFindings?: number; // Number of findings in last scan
  cacheHitCount?: number; // Number of times this scan was served from cache
}

export interface ScanHistoryEntry {
  commitHash: string;
  timestamp: string;
  duration: number;
  status: 'success' | 'failed' | 'cached';
  findings: number;
  cacheHit: boolean;
}

@Injectable()
export class ScanStorageService {
  private readonly logger = new Logger(ScanStorageService.name);
  private scanRecords: Map<string, ScanRecord> = new Map();
  private scanHistory: Map<string, ScanHistoryEntry[]> = new Map(); // repoUrl -> history entries

  /**
   * Get the last scan record for a repository
   */
  getLastScanRecord(repoUrl: string): ScanRecord | null {
    return this.scanRecords.get(repoUrl) || null;
  }

  /**
   * Update the scan record for a repository
   */
  updateScanRecord(
    repoUrl: string, 
    lastCommitHash: string, 
    options?: {
      duration?: number;
      status?: 'success' | 'failed' | 'cached';
      findings?: number;
      cacheHit?: boolean;
    }
  ): void {
    const existing = this.scanRecords.get(repoUrl);
    const now = new Date().toISOString();
    
    const updatedRecord: ScanRecord = {
      repoUrl,
      lastCommitHash,
      lastScanTimestamp: now,
      scanCount: (existing?.scanCount || 0) + 1,
      lastScanDuration: options?.duration,
      lastScanStatus: options?.status || 'success',
      lastScanFindings: options?.findings,
      cacheHitCount: existing?.cacheHitCount || 0,
    };

    // Increment cache hit count if this was a cache hit
    if (options?.cacheHit) {
      updatedRecord.cacheHitCount = (existing?.cacheHitCount || 0) + 1;
    }

    this.scanRecords.set(repoUrl, updatedRecord);

    // Add to history
    this.addToHistory(repoUrl, {
      commitHash: lastCommitHash,
      timestamp: now,
      duration: options?.duration || 0,
      status: options?.status || 'success',
      findings: options?.findings || 0,
      cacheHit: options?.cacheHit || false,
    });

    this.logger.debug(`Updated scan record for ${repoUrl}: commit ${lastCommitHash}, status ${options?.status || 'success'}`);
  }

  /**
   * Get scan history for a repository
   */
  getScanHistory(repoUrl: string, limit: number = 10): ScanHistoryEntry[] {
    const history = this.scanHistory.get(repoUrl) || [];
    return history.slice(-limit).reverse(); // Return most recent first
  }

  /**
   * Get all scan records
   */
  getAllScanRecords(): ScanRecord[] {
    return Array.from(this.scanRecords.values());
  }

  /**
   * Clear scan records (useful for testing)
   */
  clearScanRecords(): void {
    this.scanRecords.clear();
    this.scanHistory.clear();
    this.logger.debug('Cleared all scan records and history');
  }

  /**
   * Get scan statistics with enhanced metrics
   */
  getScanStatistics(): {
    totalRepositories: number;
    totalScans: number;
    totalCacheHits: number;
    averageScanDuration: number;
    lastScanTimestamp?: string;
    repositoriesWithHistory: number;
  } {
    const records = this.getAllScanRecords();
    const totalScans = records.reduce((sum, record) => sum + record.scanCount, 0);
    const totalCacheHits = records.reduce((sum, record) => sum + (record.cacheHitCount || 0), 0);
    
    // Calculate average scan duration
    const recordsWithDuration = records.filter(r => r.lastScanDuration !== undefined);
    const averageScanDuration = recordsWithDuration.length > 0
      ? recordsWithDuration.reduce((sum, record) => sum + (record.lastScanDuration || 0), 0) / recordsWithDuration.length
      : 0;

    const lastScanTimestamp = records.length > 0 
      ? records.reduce((latest, record) => 
          record.lastScanTimestamp > latest ? record.lastScanTimestamp : latest, 
          records[0].lastScanTimestamp
        )
      : undefined;

    const repositoriesWithHistory = Array.from(this.scanHistory.keys()).length;

    return {
      totalRepositories: records.length,
      totalScans,
      totalCacheHits,
      averageScanDuration: Math.round(averageScanDuration),
      lastScanTimestamp,
      repositoriesWithHistory,
    };
  }

  /**
   * Get repositories that haven't been scanned recently
   */
  getStaleRepositories(maxAgeHours: number = 24): ScanRecord[] {
    const now = new Date();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    
    return this.getAllScanRecords().filter(record => {
      const lastScanTime = new Date(record.lastScanTimestamp);
      return (now.getTime() - lastScanTime.getTime()) > maxAgeMs;
    });
  }

  /**
   * Get repositories with the most scans
   */
  getMostScannedRepositories(limit: number = 10): ScanRecord[] {
    return this.getAllScanRecords()
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, limit);
  }

  /**
   * Get repositories with the most cache hits
   */
  getMostCachedRepositories(limit: number = 10): ScanRecord[] {
    return this.getAllScanRecords()
      .filter(r => (r.cacheHitCount || 0) > 0)
      .sort((a, b) => (b.cacheHitCount || 0) - (a.cacheHitCount || 0))
      .slice(0, limit);
  }

  /**
   * Check if a repository has been scanned recently
   */
  isRecentlyScanned(repoUrl: string, maxAgeMinutes: number = 60): boolean {
    const record = this.getLastScanRecord(repoUrl);
    if (!record) return false;

    const now = new Date();
    const lastScanTime = new Date(record.lastScanTimestamp);
    const maxAgeMs = maxAgeMinutes * 60 * 1000;

    return (now.getTime() - lastScanTime.getTime()) < maxAgeMs;
  }

  /**
   * Get the commit hash for a repository
   */
  getLastCommitHash(repoUrl: string): string | null {
    const record = this.getLastScanRecord(repoUrl);
    return record?.lastCommitHash || null;
  }

  /**
   * Add entry to scan history
   */
  private addToHistory(repoUrl: string, entry: ScanHistoryEntry): void {
    if (!this.scanHistory.has(repoUrl)) {
      this.scanHistory.set(repoUrl, []);
    }

    const history = this.scanHistory.get(repoUrl)!;
    history.push(entry);

    // Keep only last 50 entries per repository
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }
} 