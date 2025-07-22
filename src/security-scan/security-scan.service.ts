import { Injectable, Logger, Inject } from '@nestjs/common';
import { ScanResultDto } from './dto/scan-result.dto';
import * as tmp from 'tmp-promise';
import { ScmProvider } from './interfaces/scm.interface';
import { SecurityScanner } from './interfaces/scanners.interface';
import { GitScmProvider } from './providers/scm-git.provider';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import { ScanStorageService } from './providers/scan-storage.service';
import * as fs from 'fs';

@Injectable()
export class SecurityScanService {
  private readonly logger = new Logger(SecurityScanService.name);
  private lastScanPath: string | null = null; // For demo: store last scan path

  constructor(
    private readonly scmProvider: GitScmProvider,
    @Inject('SCANNERS') private readonly scanners: SecurityScanner[],
    private readonly scanStorage: ScanStorageService,
  ) {}

  async scanRepository(repoUrl: string, forceScan: boolean = false): Promise<ScanResultDto> {
    // 1. Check for changes since last scan
    const lastScanRecord = this.scanStorage.getLastScanRecord(repoUrl);
    let changeDetection = {
      hasChanges: true,
      lastCommitHash: 'unknown',
      scanSkipped: false,
      reason: undefined as string | undefined,
    };

    if (!forceScan && lastScanRecord) {
      this.logger.log(`Checking for changes since last scan of ${repoUrl}`);
      const changeInfo = await this.scmProvider.hasChangesSince(repoUrl, lastScanRecord.lastCommitHash);
      
      if (!changeInfo.hasChanges) {
        this.logger.log(`No changes detected for ${repoUrl}, skipping scan`);
        const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);
        
        return {
          repository: metadata,
          scanner: { name: 'Change Detection', version: '1.0' },
          findings: [],
          changeDetection: {
            ...changeInfo,
            scanSkipped: true,
            reason: 'No changes detected since last scan',
          },
        };
      }
      
      changeDetection = {
        ...changeInfo,
        scanSkipped: false,
        reason: undefined,
      };
    }

    // 2. Clone the repository to a temp directory
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const repoPath = tmpDir.path;
    try {
      this.logger.log(`Cloning repo ${repoUrl} to ${repoPath}`);
      await this.scmProvider.cloneRepository(repoUrl, repoPath);

      // 3. Run all scanners
      let allFindings: any[] = [];
      let scannerInfo = { name: '', version: '' };
      for (const scanner of this.scanners) {
        scannerInfo = { name: scanner.getName(), version: scanner.getVersion() };
        const findings = await scanner.scan(repoPath);
        allFindings = allFindings.concat(findings);
      }

      // 4. Fetch repository metadata
      const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);

      // 5. Update scan record with current commit hash
      const currentCommitHash = await this.scmProvider.getLastCommitHash(repoUrl);
      this.scanStorage.updateScanRecord(repoUrl, currentCommitHash);

      // 6. Log raw scan output
      this.logger.log(`Raw scan output for ${repoUrl}: ${JSON.stringify(allFindings)}`);

      // 7. Return structured result
      return {
        repository: metadata,
        scanner: scannerInfo,
        findings: allFindings,
        changeDetection: {
          ...changeDetection,
          lastCommitHash: currentCommitHash,
        },
      };
    } finally {
      // Cleanup temp directory
      await tmpDir.cleanup();
    }
  }

  getCodeContext(filePath: string, line: number, context: number = 3): string[] {
    if (!this.lastScanPath) return [];
    const absPath = require('path').join(this.lastScanPath, filePath);
    if (!fs.existsSync(absPath)) return [];
    const lines = fs.readFileSync(absPath, 'utf-8').split('\n');
    const start = Math.max(0, line - 1 - context);
    const end = Math.min(lines.length, line + context);
    return lines.slice(start, end);
  }

  /**
   * Get scan statistics
   */
  getScanStatistics() {
    return this.scanStorage.getScanStatistics();
  }

  /**
   * Get all scan records
   */
  getAllScanRecords() {
    return this.scanStorage.getAllScanRecords();
  }

  /**
   * Force a scan regardless of changes
   */
  async forceScanRepository(repoUrl: string): Promise<ScanResultDto> {
    return this.scanRepository(repoUrl, true);
  }
} 