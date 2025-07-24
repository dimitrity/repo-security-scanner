import { Injectable } from '@nestjs/common';

export interface ScanRecord {
  repoUrl: string;
  lastCommitHash: string;
  lastScanTimestamp: string;
  scanCount: number;
}

@Injectable()
export class ScanStorageService {
  private scanRecords: Map<string, ScanRecord> = new Map();

  /**
   * Get the last scan record for a repository
   */
  getLastScanRecord(repoUrl: string): ScanRecord | null {
    return this.scanRecords.get(repoUrl) || null;
  }

  /**
   * Update the scan record for a repository
   */
  updateScanRecord(repoUrl: string, lastCommitHash: string): void {
    const existing = this.scanRecords.get(repoUrl);
    const now = new Date().toISOString();

    this.scanRecords.set(repoUrl, {
      repoUrl,
      lastCommitHash,
      lastScanTimestamp: now,
      scanCount: (existing?.scanCount || 0) + 1,
    });
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
  }

  /**
   * Get scan statistics
   */
  getScanStatistics(): {
    totalRepositories: number;
    totalScans: number;
    lastScanTimestamp?: string;
  } {
    const records = this.getAllScanRecords();
    const totalScans = records.reduce(
      (sum, record) => sum + record.scanCount,
      0,
    );
    const lastScanTimestamp =
      records.length > 0
        ? records.reduce(
            (latest, record) =>
              record.lastScanTimestamp > latest
                ? record.lastScanTimestamp
                : latest,
            records[0].lastScanTimestamp,
          )
        : undefined;

    return {
      totalRepositories: records.length,
      totalScans,
      lastScanTimestamp,
    };
  }
}
