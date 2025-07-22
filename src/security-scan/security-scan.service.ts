import { Injectable, Logger, Inject } from '@nestjs/common';
import { ScanResultDto } from './dto/scan-result.dto';
import * as tmp from 'tmp-promise';
import { ScmProvider } from './interfaces/scm.interface';
import { SecurityScanner } from './interfaces/scanners.interface';
import { GitScmProvider } from './providers/scm-git.provider';
import { SemgrepScanner } from './providers/scanner-semgrep.service';
import * as fs from 'fs';

@Injectable()
export class SecurityScanService {
  private readonly logger = new Logger(SecurityScanService.name);
  private lastScanPath: string | null = null; // For demo: store last scan path

  constructor(
    private readonly scmProvider: GitScmProvider,
    @Inject('SCANNERS') private readonly scanners: SecurityScanner[],
  ) {}

  async scanRepository(repoUrl: string): Promise<ScanResultDto> {
    // 1. Clone the repository to a temp directory
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const repoPath = tmpDir.path;
    try {
      this.logger.log(`Cloning repo ${repoUrl} to ${repoPath}`);
      await this.scmProvider.cloneRepository(repoUrl, repoPath);

      // 2. Run all scanners
      let allFindings: any[] = [];
      let scannerInfo = { name: '', version: '' };
      for (const scanner of this.scanners) {
        scannerInfo = { name: scanner.getName(), version: scanner.getVersion() };
        const findings = await scanner.scan(repoPath);
        allFindings = allFindings.concat(findings);
      }

      // 3. Fetch repository metadata
      const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);

      // 4. Log raw scan output
      this.logger.log(`Raw scan output for ${repoUrl}: ${JSON.stringify(allFindings)}`);

      // 5. Return structured result
      return {
        repository: metadata,
        scanner: scannerInfo,
        findings: allFindings,
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
} 