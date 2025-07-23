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
      this.logger.log(`Last scan commit hash: ${lastScanRecord.lastCommitHash}`);
      
      const changeInfo = await this.scmProvider.hasChangesSince(repoUrl, lastScanRecord.lastCommitHash);
      this.logger.log(`Change detection result:`, changeInfo);
      
      if (!changeInfo.hasChanges) {
        this.logger.log(`No changes detected for ${repoUrl}, returning no-change finding instead of performing scan`);
        const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);
        
        return {
          repository: metadata,
          scanner: { name: 'Change Detection', version: '1.0' },
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
            ...changeInfo,
            scanSkipped: true,
            reason: 'No changes detected since last scan',
          },
          // Legacy compatibility
          findings: [
            {
              ruleId: 'CHANGE-DETECTION-001',
              message: 'No changes detected for the repo',
              filePath: 'N/A',
              line: 0,
              severity: 'info',
            },
          ],
        };
      }
      
      this.logger.log(`Changes detected for ${repoUrl}, proceeding with scan`);
      changeDetection = {
        ...changeInfo,
        scanSkipped: false,
        reason: undefined,
      };
    } else {
      this.logger.log(`No previous scan record found for ${repoUrl} or force scan requested`);
    }

    // 2. Clone the repository to a temp directory
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const repoPath = tmpDir.path;
    try {
      this.logger.log(`Cloning repo ${repoUrl} to ${repoPath}`);
      await this.scmProvider.cloneRepository(repoUrl, repoPath);

      // 3. Fetch repository metadata (moved before scanner execution)
      const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);

      // 4. Run all scanners
      let allFindings: { [scannerName: string]: any[] } = {};
      let scannerInfos: Array<{ name: string; version: string; findings: any[] }> = [];
      
      for (const scanner of this.scanners) {
        try {
          const scannerInfo = { name: scanner.getName(), version: scanner.getVersion() };
          
          this.logger.log(`Running ${scannerInfo.name} scanner...`);
          const findings = await scanner.scan(repoPath);
          
          // Add scanner information and convert to absolute web URLs
          const findingsWithScanner = findings.map(finding => ({
            ...finding,
            scanner: scannerInfo.name,
            filePath: this.convertToAbsoluteWebPath(finding.filePath, repoUrl, metadata),
          }));
          
          // Store findings by scanner name
          allFindings[scannerInfo.name] = findingsWithScanner;
          scannerInfos.push({ ...scannerInfo, findings: findingsWithScanner });
          this.logger.log(`${scannerInfo.name} found ${findings.length} issues`);
          
        } catch (error) {
          this.logger.error(`Scanner ${scanner.getName()} failed: ${error.message}`);
          // Continue with other scanners even if one fails
          // Store empty array for failed scanners
          allFindings[scanner.getName()] = [];
        }
      }
      
      // Use the first scanner's info for backward compatibility, or combine them
      const scannerInfo = scannerInfos.length > 0 ? scannerInfos[0] : { name: 'Multiple Scanners', version: 'latest' };

      // 5. Update scan record with current commit hash
      const currentCommitHash = await this.scmProvider.getLastCommitHash(repoUrl);
      this.scanStorage.updateScanRecord(repoUrl, currentCommitHash);

      // 6. Log raw scan output
      this.logger.log(`Raw scan output for ${repoUrl}: ${JSON.stringify(allFindings)}`);

      // 7. Create structured output with summary and details
      const structuredOutput = this.createStructuredOutput(
        metadata,
        scannerInfos,
        allFindings,
        changeDetection,
        currentCommitHash,
        repoPath,
        repoUrl
      );

      // 8. Return structured result
      return structuredOutput;
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
   * Get enhanced code context for a finding with line numbers and highlighting
   */
  private getEnhancedCodeContext(filePath: string, line: number, repoPath: string, repoUrl?: string, metadata?: any, contextLines: number = 3): any {
    if (!filePath || filePath === 'N/A' || !line || line === 0) {
      return null;
    }

    try {
      // Extract relative path from absolute web URL if needed
      const relativePath = this.extractRelativePathFromWebUrl(filePath, repoUrl, metadata);
      const fullPath = require('path').join(repoPath, relativePath);
      
      if (!fs.existsSync(fullPath)) {
        return null;
      }

      const fileContent = fs.readFileSync(fullPath, 'utf-8').split('\n');
      const startLine = Math.max(0, line - 1 - contextLines);
      const endLine = Math.min(fileContent.length, line + contextLines);
      
      // Use the absolute web URL in the response
      return {
        filePath: filePath, // This is now the absolute web URL
        line,
        startLine: startLine + 1,
        endLine: endLine,
        context: fileContent.slice(startLine, endLine).map((content, index) => ({
          lineNumber: startLine + index + 1,
          content: content,
          isTargetLine: startLine + index + 1 === line
        }))
      };
    } catch (error) {
      this.logger.warn(`Failed to get code context for ${filePath}:${line}: ${error.message}`);
      return null;
    }
  }

  /**
   * Extract relative file path from absolute web URL
   */
  private extractRelativePathFromWebUrl(filePath: string, repoUrl?: string, metadata?: any): string {
    // If it's already a relative path, return as-is
    if (!filePath.startsWith('http')) {
      return filePath;
    }

    try {
      const url = new URL(filePath);
      const pathParts = url.pathname.split('/');
      
      // For GitHub: /owner/repo/blob/branch/path/to/file.js
      // For GitLab: /owner/repo/-/blob/branch/path/to/file.js  
      // For Bitbucket: /owner/repo/src/branch/path/to/file.js
      
      let startIndex = -1;
      if (url.hostname.includes('github.com')) {
        // Find 'blob' and take everything after the branch
        const blobIndex = pathParts.findIndex(part => part === 'blob');
        if (blobIndex >= 0 && blobIndex + 2 < pathParts.length) {
          startIndex = blobIndex + 2; // Skip 'blob' and branch name
        }
      } else if (url.hostname.includes('gitlab')) {
        // Find 'blob' and take everything after the branch  
        const blobIndex = pathParts.findIndex(part => part === 'blob');
        if (blobIndex >= 0 && blobIndex + 2 < pathParts.length) {
          startIndex = blobIndex + 2; // Skip 'blob' and branch name
        }
      } else if (url.hostname.includes('bitbucket')) {
        // Find 'src' and take everything after the branch
        const srcIndex = pathParts.findIndex(part => part === 'src');
        if (srcIndex >= 0 && srcIndex + 2 < pathParts.length) {
          startIndex = srcIndex + 2; // Skip 'src' and branch name
        }
      }
      
      if (startIndex >= 0) {
        return pathParts.slice(startIndex).join('/');
      }
      
      // Fallback: return the original path
      return filePath;
    } catch (error) {
      this.logger.warn(`Failed to extract relative path from web URL: ${error.message}`);
      return filePath;
    }
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

  /**
   * Convert relative file path to absolute web repository URL
   */
  private convertToAbsoluteWebPath(filePath: string, repoUrl: string, metadata: any): string {
    // If filePath is N/A or empty, return as-is
    if (!filePath || filePath === 'N/A' || filePath === 'unknown') {
      return filePath;
    }

    try {
      // Parse repository URL to determine platform
      const url = new URL(repoUrl);
      const hostname = url.hostname.toLowerCase();
      
      // Remove .git suffix if present
      let cleanPath = url.pathname.replace(/\.git$/, '');
      if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }

      // Get default branch from metadata
      const defaultBranch = metadata?.defaultBranch || 'main';

      // Construct absolute web URL based on platform
      if (hostname.includes('github.com')) {
        return `https://github.com/${cleanPath}/blob/${defaultBranch}/${filePath}`;
      } else if (hostname.includes('gitlab.com') || hostname.includes('gitlab.')) {
        return `https://${hostname}/${cleanPath}/-/blob/${defaultBranch}/${filePath}`;
      } else if (hostname.includes('bitbucket.org')) {
        return `https://bitbucket.org/${cleanPath}/src/${defaultBranch}/${filePath}`;
      } else {
        // For unknown platforms, try a generic format or fallback to relative path
        return `${repoUrl.replace(/\.git$/, '')}/blob/${defaultBranch}/${filePath}`;
      }
    } catch (error) {
      this.logger.warn(`Failed to convert file path to absolute web URL: ${error.message}`);
      // Fallback to relative path if conversion fails
      return filePath;
    }
  }

  /**
   * Create structured output with summary and detailed findings
   */
  private createStructuredOutput(
    metadata: any,
    scannerInfos: Array<{ name: string; version: string; findings: any[] }>,
    allFindings: { [scannerName: string]: any[] },
    changeDetection: any,
    currentCommitHash: string,
    repoPath: string,
    repoUrl: string
  ): any {
    // Calculate total issues from dictionary
    const totalIssues = Object.values(allFindings).reduce((total, findings) => total + findings.length, 0);
    
    // Create summary section
    const summary = {
      totalSecurityIssues: totalIssues,
      scanners: scannerInfos.map(scanner => ({
        name: scanner.name,
        version: scanner.version,
        securityIssuesFound: scanner.findings.length,
        summary: `${scanner.name} found ${scanner.findings.length} security issue${scanner.findings.length !== 1 ? 's' : ''}`
      }))
    };

    // Create details section organized by scanner and severity
    const details = {
      scanners: scannerInfos.map(scanner => {
        const securityIssuesBySeverity = this.groupSecurityIssuesBySeverity(scanner.findings, repoPath, repoUrl, metadata);
        
        return {
          name: scanner.name,
          version: scanner.version,
          totalSecurityIssues: scanner.findings.length,
          severityBreakdown: {
            high: securityIssuesBySeverity.high.length,
            medium: securityIssuesBySeverity.medium.length,
            low: securityIssuesBySeverity.low.length,
            info: securityIssuesBySeverity.info.length
          },
          securityIssues: securityIssuesBySeverity
        };
      })
    };

    // Create flat findings array for backward compatibility
    const flatFindings = Object.values(allFindings).flat();
    
    return {
      repository: metadata,
      summary,
      details,
      changeDetection: {
        ...changeDetection,
        lastCommitHash: currentCommitHash,
      },
      // New structured security issues by scanner
      allSecurityIssues: allFindings,
      // Keep backward compatibility
      scanner: scannerInfos.length > 0 ? scannerInfos[0] : { name: 'Multiple Scanners', version: 'latest' },
      securityIssues: flatFindings,
      // Legacy compatibility
      allFindings,
      findings: flatFindings,
    };
  }

  /**
   * Group security issues by severity
   */
  private groupSecurityIssuesBySeverity(findings: any[], repoPath: string, repoUrl: string, metadata: any): any {
    const grouped = {
      high: [] as any[],
      medium: [] as any[],
      low: [] as any[],
      info: [] as any[]
    };

    findings.forEach(finding => {
      const severity = finding.severity?.toLowerCase() || 'low';
      if (grouped[severity as keyof typeof grouped]) {
        // Add code context to each finding  
        const findingWithContext = {
          ...finding,
          codeContext: this.getEnhancedCodeContext(finding.filePath, finding.line, repoPath, repoUrl, metadata)
        };
        grouped[severity as keyof typeof grouped].push(findingWithContext);
      } else {
        grouped.low.push(finding);
      }
    });

    return grouped;
  }
} 