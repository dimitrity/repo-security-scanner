import { Injectable, Logger, Inject } from '@nestjs/common';
import { ScanResultDto } from './dto/scan-result.dto';
import * as tmp from 'tmp-promise';
import { SecurityScanner } from './interfaces/scanners.interface';
import { ScmManagerService } from './providers/scm-manager.service';
import { ScanStorageService } from './providers/scan-storage.service';
import { ScanCacheService } from './providers/scan-cache.service';
import * as fs from 'fs';

@Injectable()
export class SecurityScanService {
  private readonly logger = new Logger(SecurityScanService.name);

  constructor(
    private readonly scmManager: ScmManagerService,
    @Inject('SCANNERS') private readonly scanners: SecurityScanner[],
    private readonly scanStorage: ScanStorageService,
    private readonly scanCache: ScanCacheService,
  ) {}

  async scanRepository(repoUrl: string, forceScan: boolean = false): Promise<ScanResultDto> {
    const startTime = Date.now();
    
    try {
      // 1. Get current commit hash first
      const commitHashResult = await this.scmManager.getLastCommitHash(repoUrl);
      const currentCommitHash = commitHashResult.hash || 'unknown';
      
      this.logger.log(`Current commit hash for ${repoUrl}: ${currentCommitHash}`);

      // 2. Check cache first (unless force scan is requested)
      if (!forceScan) {
        // Check for exact commit hash match first
        const cachedResult = this.scanCache.getCachedResult(repoUrl, currentCommitHash);
        if (cachedResult) {
          this.logger.log(`Cache hit for ${repoUrl} at commit ${currentCommitHash}`);
          
          // Update storage with cache hit
          this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
            status: 'cached',
            duration: Date.now() - startTime,
            cacheHit: true,
          });

          return {
            ...cachedResult,
            changeDetection: {
              hasChanges: false,
              lastCommitHash: currentCommitHash,
              scanSkipped: true,
              reason: 'Result served from cache',
            },
          };
        }

        // If no exact match, check if we have any cached results for this repository
        if (this.scanCache.hasCachedResults(repoUrl)) {
          this.logger.log(`Repository ${repoUrl} has cached results, checking if they're still valid`);
          
          // Get the last scan record to compare
          const lastScanRecord = this.scanStorage.getLastScanRecord(repoUrl);
          if (lastScanRecord && lastScanRecord.lastCommitHash !== currentCommitHash) {
            // Repository has been updated, check if the changes are significant enough to warrant a new scan
            const changeResult = await this.scmManager.hasChangesSince(repoUrl, lastScanRecord.lastCommitHash);
            
            if (changeResult.result && !changeResult.result.hasChanges) {
              this.logger.log(`No significant changes detected for ${repoUrl}, serving cached result`);
              
              // Get the most recent cached result for this repository
              const mostRecentCachedResult = this.scanCache.getMostRecentCachedResult(repoUrl);
              if (mostRecentCachedResult) {
                // Update storage with cache hit
                this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
                  status: 'cached',
                  duration: Date.now() - startTime,
                  cacheHit: true,
                });

                return {
                  ...mostRecentCachedResult,
                  changeDetection: {
                    hasChanges: false,
                    lastCommitHash: currentCommitHash,
                    scanSkipped: true,
                    reason: 'No significant changes detected, serving cached result',
                  },
                };
              }
            }
          }
        }
      }

      // 3. Check for changes since last scan
      const lastScanRecord = this.scanStorage.getLastScanRecord(repoUrl);
      let changeDetection = {
        hasChanges: true,
        lastCommitHash: currentCommitHash,
        scanSkipped: false,
        reason: undefined as string | undefined,
      };

      if (!forceScan && lastScanRecord) {
        this.logger.log(`Checking for changes since last scan of ${repoUrl}`);
        this.logger.log(`Last scan commit hash: ${lastScanRecord.lastCommitHash}`);
        
        // If commit hash is the same, no need to check for changes
        if (lastScanRecord.lastCommitHash === currentCommitHash) {
          this.logger.log(`No changes detected for ${repoUrl} - same commit hash`);
          const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
          const metadata = metadataResult.metadata || this.getDefaultMetadata(repoUrl);
          
          const noChangeResult = {
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
              hasChanges: false,
              lastCommitHash: currentCommitHash,
              scanSkipped: true,
              reason: 'No changes detected since last scan',
            },
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

          // Cache the no-change result
          this.scanCache.cacheResult(repoUrl, currentCommitHash, noChangeResult);
          
          // Update storage
          this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
            status: 'success',
            duration: Date.now() - startTime,
            findings: 1, // One "no change" finding
          });

          return noChangeResult;
        }
        
        const changeResult = await this.scmManager.hasChangesSince(repoUrl, lastScanRecord.lastCommitHash);
        this.logger.log(`Change detection result:`, changeResult);
        
        if (changeResult.result && !changeResult.result.hasChanges) {
          this.logger.log(`No changes detected for ${repoUrl}, returning no-change finding instead of performing scan`);
          const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
          const metadata = metadataResult.metadata || this.getDefaultMetadata(repoUrl);
          
          const noChangeResult = {
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
              hasChanges: false,
              lastCommitHash: changeResult.result.lastCommitHash,
              scanSkipped: true,
              reason: 'No changes detected since last scan',
            },
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

          // Cache the no-change result
          this.scanCache.cacheResult(repoUrl, currentCommitHash, noChangeResult);
          
          // Update storage
          this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
            status: 'success',
            duration: Date.now() - startTime,
            findings: 1, // One "no change" finding
          });

          return noChangeResult;
        }
        
        this.logger.log(`Changes detected for ${repoUrl}, proceeding with scan`);
        changeDetection = {
          hasChanges: true,
          lastCommitHash: changeResult.result?.lastCommitHash || currentCommitHash,
          scanSkipped: false,
          reason: undefined,
        };
      } else {
        this.logger.log(`No previous scan record found for ${repoUrl} or force scan requested`);
      }

      // 4. Clone the repository to a temp directory
      const tmpDir = await tmp.dir({ unsafeCleanup: true });
      const repoPath = tmpDir.path;
      try {
        this.logger.log(`Cloning repo ${repoUrl} to ${repoPath}`);
        const cloneResult = await this.scmManager.cloneRepository(repoUrl, repoPath);
        
        if (!cloneResult.success) {
          throw new Error(`Failed to clone repository: ${cloneResult.error}`);
        }

        this.logger.log(`Successfully cloned repository using provider: ${cloneResult.provider}`);

        // 5. Fetch repository metadata
        const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
        const metadata = metadataResult.metadata || this.getDefaultMetadata(repoUrl);

        // 6. Run all scanners
        let allFindings: { [scannerName: string]: any[] } = {};
        let scannerInfos: Array<{ name: string; version: string; findings: any[] }> = [];
        
        for (const scanner of this.scanners) {
          try {
            const scannerInfo = { name: scanner.getName(), version: scanner.getVersion() };
            
            this.logger.log(`Running ${scannerInfo.name} scanner...`);
            const findings = await scanner.scan(repoPath);
            
            // Add code context to each finding
            const findingsWithContext = await Promise.all(
              findings.map(async (finding) => {
                try {
                  this.logger.log(`Extracting context for file: ${finding.filePath}, line: ${finding.line}`);
                  const codeContext = await this.extractCodeContext(repoPath, finding.filePath, finding.line);
                  this.logger.log(`Context extraction result: ${codeContext ? 'SUCCESS' : 'NULL'} for ${finding.filePath}`);
                  return {
                    ...finding,
                    scanner: scannerInfo.name,
                    codeContext,
                  };
                } catch (error) {
                  this.logger.warn(`Failed to extract code context for ${finding.filePath}:${finding.line}: ${error.message}`);
                  return {
                    ...finding,
                    scanner: scannerInfo.name,
                  };
                }
              })
            );
            
            // Store findings by scanner name
            allFindings[scannerInfo.name] = findingsWithContext;
            scannerInfos.push({ ...scannerInfo, findings: findingsWithContext });
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

        // 8. Cache the result
        this.scanCache.cacheResult(repoUrl, currentCommitHash, structuredOutput);

        // 9. Update scan record with current commit hash and performance metrics
        const totalFindings = Object.values(allFindings).reduce((sum, findings) => sum + findings.length, 0);
        this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
          status: 'success',
          duration: Date.now() - startTime,
          findings: totalFindings,
        });

        // 10. Log raw scan output
        this.logger.log(`Raw scan output for ${repoUrl}: ${JSON.stringify(allFindings)}`);

        // 11. Return structured result
        return structuredOutput;
      } finally {
        // Cleanup temp directory
        await tmpDir.cleanup();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Scan failed for ${repoUrl}: ${error.message}`);
      
      // Update storage with failure
      const commitHashResult = await this.scmManager.getLastCommitHash(repoUrl);
      const currentCommitHash = commitHashResult.hash || 'unknown';
      
      this.scanStorage.updateScanRecord(repoUrl, currentCommitHash, {
        status: 'failed',
        duration,
        findings: 0,
      });

      throw error;
    }
  }

  /**
   * Get default metadata when SCM provider fails
   */
  private getDefaultMetadata(repoUrl: string): any {
    const repoInfo = this.scmManager.parseRepositoryUrl(repoUrl);
    const name = repoInfo.repoInfo?.repository || this.extractRepoNameFromUrl(repoUrl);
    
    return {
      name,
      description: 'Repository information unavailable',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'unknown',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract repository name from URL as fallback
   */
  private extractRepoNameFromUrl(repoUrl: string): string {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1].replace('.git', '');
    } catch {
      // Handle SSH URLs
      const match = repoUrl.match(/\/([^\/]+)\.git$/);
      return match ? match[1] : 'unknown';
    }
  }

  /**
   * Extract code context for a specific file and line
   */
  private async extractCodeContext(repoPath: string, filePath: string, line: number, contextLines: number = 5): Promise<any> {
    try {
      let fullFilePath: string;
      let repositoryRelativePath: string;
      
      // Handle different path formats from scanners
      if (require('path').isAbsolute(filePath)) {
        // If the path is absolute, it might be a temporary path from the scanner
        // Extract the repository-relative path
        if (filePath.startsWith(repoPath)) {
          // Path is within the repo directory
          repositoryRelativePath = require('path').relative(repoPath, filePath);
          fullFilePath = filePath;
        } else {
          // Path might be from a different temp directory (common with scanners)
          // Try to find the relative part by looking for common directory patterns
          const pathParts = filePath.split(require('path').sep);
          const tempDirIndex = pathParts.findIndex(part => part.startsWith('tmp-'));
          
          if (tempDirIndex !== -1 && tempDirIndex + 1 < pathParts.length) {
            // Extract path after temp directory
            repositoryRelativePath = pathParts.slice(tempDirIndex + 1).join(require('path').sep);
            fullFilePath = require('path').join(repoPath, repositoryRelativePath);
          } else {
            // Fallback: use the file as-is if it exists
            if (require('fs').existsSync(filePath)) {
              repositoryRelativePath = require('path').basename(filePath);
              fullFilePath = filePath;
            } else {
              this.logger.warn(`Cannot determine repository-relative path for: ${filePath}`);
              return null;
            }
          }
        }
      } else {
        // Path is already relative to repository
        repositoryRelativePath = filePath;
        fullFilePath = require('path').join(repoPath, filePath);
      }
      
      // Check if file exists
      if (!require('fs').existsSync(fullFilePath)) {
        this.logger.warn(`File not found for context extraction: ${fullFilePath}`);
        return null;
      }

      // Read and process file content for code context
      const fileContent = require('fs').readFileSync(fullFilePath, 'utf-8').split('\n');
      const startLine = Math.max(0, line - 1 - contextLines);
      const endLine = Math.min(fileContent.length, line + contextLines);
      
      const codeContext = {
        filePath: repositoryRelativePath, // Return the repository-relative path
        line,
        startLine: startLine + 1,
        endLine: endLine,
        context: fileContent.slice(startLine, endLine).map((content, index) => ({
          lineNumber: startLine + index + 1,
          content: content,
          isTargetLine: startLine + index + 1 === line
        }))
      };
      
      return codeContext;
      
    } catch (error) {
      this.logger.error(`Failed to extract code context for ${filePath}:${line}: ${error.message}`);
      return null;
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
   * Get scan history for a repository
   */
  getScanHistory(repoUrl: string) {
    return this.scanStorage.getScanHistory(repoUrl);
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics() {
    return this.scanCache.getCacheStatistics();
  }

  /**
   * Get all cached repositories
   */
  getCachedRepositories() {
    return this.scanCache.getCachedRepositories();
  }

  /**
   * Get cached results for a specific repository
   */
  getCachedResultsForRepository(repoUrl: string) {
    return this.scanCache.getCachedResultsForRepository(repoUrl);
  }

  /**
   * Clear all cached results
   */
  clearCache() {
    this.scanCache.clearCache();
    return { message: 'Cache cleared successfully' };
  }

  /**
   * Invalidate cache for a specific repository
   */
  invalidateRepositoryCache(repoUrl: string) {
    this.scanCache.invalidateRepository(repoUrl);
    return { message: `Cache invalidated for repository: ${repoUrl}` };
  }

  /**
   * Get repositories that haven't been scanned recently
   */
  getStaleRepositories() {
    return this.scanStorage.getStaleRepositories();
  }

  /**
   * Get repositories with the most scans
   */
  getMostScannedRepositories() {
    return this.scanStorage.getMostScannedRepositories();
  }

  /**
   * Get repositories with the most cache hits
   */
  getMostCachedRepositories() {
    return this.scanStorage.getMostCachedRepositories();
  }

  /**
   * Force scan a repository (bypass cache and change detection)
   */
  async forceScanRepository(repoUrl: string): Promise<ScanResultDto> {
    return this.scanRepository(repoUrl, true);
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
        grouped[severity as keyof typeof grouped].push(finding);
      } else {
        grouped.low.push(finding);
      }
    });

    return grouped;
  }

  /**
   * Get code context for a specific file and line in a repository
   */
  async getCodeContextForFile(repoUrl: string, filePath: string, line: number, contextLines: number = 3): Promise<any> {
    const repoDir = await tmp.dir({ unsafeCleanup: true });
    const repoPath = repoDir.path;
    
    try {
      this.logger.log(`Cloning repo ${repoUrl} for code context`);
      await this.scmManager.cloneRepository(repoUrl, repoPath);
      
      // Fetch repository metadata
      const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
      const metadata = metadataResult.metadata || this.getDefaultMetadata(repoUrl);
      
      // Construct the full file path from repository-relative path
      const fullFilePath = require('path').join(repoPath, filePath);
      
      // Check if file exists
      if (!require('fs').existsSync(fullFilePath)) {
        return {
          error: 'File not found or unable to get code context',
          filePath,
          line,
          repoUrl
        };
      }

      // Read and process file content for code context
      const fileContent = require('fs').readFileSync(fullFilePath, 'utf-8').split('\n');
      const startLine = Math.max(0, line - 1 - contextLines);
      const endLine = Math.min(fileContent.length, line + contextLines);
      
      const codeContext = {
        filePath: filePath, // Return the repository-relative path
        line,
        startLine: startLine + 1,
        endLine: endLine,
        context: fileContent.slice(startLine, endLine).map((content, index) => ({
          lineNumber: startLine + index + 1,
          content: content,
          isTargetLine: startLine + index + 1 === line
        }))
      };
      
      return {
        repository: {
          name: metadata.name,
          url: repoUrl
        },
        codeContext
      };
      
    } catch (error) {
      this.logger.error(`Failed to get code context: ${error.message}`);
      throw new Error(`Failed to get code context: ${error.message}`);
    } finally {
      // Clean up the temporary directory
      try {
        await repoDir.cleanup();
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp directory: ${cleanupError.message}`);
      }
    }
  }
} 