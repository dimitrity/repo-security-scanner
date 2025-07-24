import { Injectable, Logger } from '@nestjs/common';
import { SecurityScanner } from '../interfaces/scanners.interface';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class GitleaksScanner implements SecurityScanner {
  private readonly logger = new Logger(GitleaksScanner.name);

  getName(): string {
    return 'Gitleaks';
  }

  getVersion(): string {
    return 'latest';
  }

  async scan(targetPath: string): Promise<any[]> {
    this.logger.log(`Starting Gitleaks scan for ${targetPath}`);

    try {
      // Validate target path
      this.validateAndSanitizePath(targetPath);

      // Check if gitleaks is installed
      await this.checkGitleaksInstallation();

      // Run gitleaks scan
      const findings = await this.runGitleaksScan(targetPath);

      this.logger.log(
        `Gitleaks scan completed. Found ${findings.length} potential secrets.`,
      );
      return findings;
    } catch (error) {
      this.logger.error(`Gitleaks scan failed: ${error.message}`);
      throw new Error(`Gitleaks scan failed: ${error.message}`);
    }
  }

  private validateAndSanitizePath(targetPath: string): void {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('Invalid target path provided');
    }

    // Resolve to absolute path
    const resolvedPath = path.resolve(targetPath);

    // Check if path exists and is a directory
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Target path does not exist: ${resolvedPath}`);
    }

    const stats = fs.statSync(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Target path is not a directory: ${resolvedPath}`);
    }

    // Security check: ensure path is within expected bounds
    const currentDir = process.cwd();
    const isInCurrentDir = resolvedPath.startsWith(currentDir);
    const isInTempDir = this.isInTempDirectory(resolvedPath);

    if (!isInCurrentDir && !isInTempDir) {
      throw new Error(
        `Target path is outside allowed directories: ${resolvedPath}`,
      );
    }
  }

  /**
   * Check if a path is in a temporary directory (cross-platform)
   * @param resolvedPath The absolute path to check
   * @returns true if the path is in a temporary directory
   */
  private isInTempDirectory(resolvedPath: string): boolean {
    const os = require('os');
    const tmpDir = os.tmpdir();

    // Check common temporary directory patterns
    const tempPaths = [
      '/tmp', // Linux/Unix standard
      tmpDir, // OS-specific temp directory (e.g., /var/folders on macOS)
      '/temp', // Windows alternative
      '/var/tmp', // Unix alternative
    ];

    // Also check for any path containing 'tmp-' pattern (from tmp-promise)
    const hasTmpPattern = resolvedPath.includes('/tmp-');

    return (
      tempPaths.some((tempPath) => resolvedPath.startsWith(tempPath)) ||
      hasTmpPattern
    );
  }

  private async checkGitleaksInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const gitleaksCheck = spawn('gitleaks', ['version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      gitleaksCheck.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitleaksCheck.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitleaksCheck.on('close', (code) => {
        if (code === 0) {
          this.logger.log(`Gitleaks version: ${stdout.trim()}`);
          resolve();
        } else {
          reject(
            new Error(`Gitleaks not found or not accessible. Error: ${stderr}`),
          );
        }
      });

      gitleaksCheck.on('error', (error) => {
        reject(
          new Error(`Failed to check Gitleaks installation: ${error.message}`),
        );
      });
    });
  }

  private async runGitleaksScan(targetPath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Gitleaks command with JSON output
      const gitleaksProcess = spawn(
        'gitleaks',
        [
          'detect',
          '--source',
          targetPath,
          '--report-format',
          'json',
          '--no-banner',
          '--verbose',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          cwd: targetPath,
        },
      );

      let stdout = '';
      let stderr = '';

      gitleaksProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      gitleaksProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      gitleaksProcess.on('close', (code) => {
        if (code === 0 || code === 1) {
          // Gitleaks returns 1 when secrets are found
          try {
            // Parse findings from output
            const findings = this.parseGitleaksOutput(stdout, targetPath);

            // Always add a scan summary finding, even if no secrets found
            const scanSummary = this.createScanSummaryFinding(
              code,
              stdout,
              stderr,
              findings.length,
            );
            findings.push(scanSummary);

            resolve(findings);
          } catch (parseError) {
            this.logger.warn(
              `Failed to parse Gitleaks output: ${parseError.message}`,
            );
            // Return scan summary even if parsing fails
            const scanSummary = this.createScanSummaryFinding(
              code,
              stdout,
              stderr,
              0,
            );
            resolve([scanSummary]);
          }
        } else {
          reject(
            new Error(`Gitleaks scan failed with code ${code}: ${stderr}`),
          );
        }
      });

      gitleaksProcess.on('error', (error) => {
        reject(new Error(`Failed to execute Gitleaks: ${error.message}`));
      });

      // Set timeout for the scan
      setTimeout(() => {
        gitleaksProcess.kill('SIGTERM');
        reject(new Error('Gitleaks scan timed out'));
      }, 300000); // 5 minutes timeout
    });
  }

  private parseGitleaksOutput(output: string, targetPath: string): any[] {
    if (!output.trim()) {
      return [];
    }

    try {
      // Gitleaks outputs in key-value format, not JSON
      const lines = output.trim().split('\n');
      const findings: any[] = [];
      let currentFinding: any = {};

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          // Empty line indicates end of a finding
          if (Object.keys(currentFinding).length > 0) {
            findings.push(
              this.transformGitleaksFinding(currentFinding, targetPath),
            );
            currentFinding = {};
          }
          continue;
        }

        // Parse key-value pairs
        const colonIndex = trimmedLine.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmedLine.substring(0, colonIndex).trim();
          const value = trimmedLine.substring(colonIndex + 1).trim();

          switch (key) {
            case 'Finding':
              currentFinding.Finding = value;
              break;
            case 'Secret':
              currentFinding.Secret = value;
              break;
            case 'RuleID':
              currentFinding.RuleID = value;
              break;
            case 'Entropy':
              currentFinding.Entropy = parseFloat(value);
              break;
            case 'File':
              currentFinding.File = value;
              break;
            case 'Line':
              currentFinding.Line = parseInt(value, 10);
              break;
            case 'Commit':
              currentFinding.Commit = value;
              break;
            case 'Author':
              currentFinding.Author = value;
              break;
            case 'Email':
              currentFinding.Email = value;
              break;
            case 'Date':
              currentFinding.Date = value;
              break;
            case 'Fingerprint':
              currentFinding.Fingerprint = value;
              break;
            default:
              // Store unknown keys
              currentFinding[key] = value;
          }
        }
      }

      // Don't forget the last finding if there's no empty line at the end
      if (Object.keys(currentFinding).length > 0) {
        findings.push(
          this.transformGitleaksFinding(currentFinding, targetPath),
        );
      }

      return findings;
    } catch (error) {
      this.logger.error(`Failed to parse Gitleaks output: ${error.message}`);
      return [];
    }
  }

  private transformGitleaksFinding(
    gitleaksFinding: any,
    targetPath: string,
  ): any {
    return {
      ruleId: `gitleaks.${gitleaksFinding.RuleID || 'unknown'}`,
      message: gitleaksFinding.Finding || 'Secret detected',
      filePath: gitleaksFinding.File || 'unknown',
      line: gitleaksFinding.Line || 0,
      severity: this.mapGitleaksSeverity(gitleaksFinding.RuleID),
      secret: gitleaksFinding.Secret || 'hidden',
      match: gitleaksFinding.Finding || '',
      tags: [gitleaksFinding.RuleID || 'unknown'],
      scanner: 'Gitleaks',
      // Additional Gitleaks-specific fields
      entropy: gitleaksFinding.Entropy,
      commit: gitleaksFinding.Commit,
      author: gitleaksFinding.Author,
      email: gitleaksFinding.Email,
      date: gitleaksFinding.Date,
      fingerprint: gitleaksFinding.Fingerprint,
    };
  }

  private mapGitleaksSeverity(ruleId: string): string {
    // Map Gitleaks rule IDs to severity levels
    const highSeverityRules = [
      'aws-access-key-id',
      'aws-secret-access-key',
      'aws-access-token',
      'private-key',
      'ssh-private-key',
      'api-key',
      'generic-api-key',
      'password',
      'token',
      'secret',
    ];

    const mediumSeverityRules = ['email', 'url', 'ip-address', 'credit-card'];

    const ruleIdLower = ruleId.toLowerCase();

    if (highSeverityRules.some((rule) => ruleIdLower.includes(rule))) {
      return 'high';
    } else if (mediumSeverityRules.some((rule) => ruleIdLower.includes(rule))) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private createScanSummaryFinding(
    exitCode: number,
    stdout: string,
    stderr: string,
    secretsFound: number,
  ): any {
    const status =
      exitCode === 0 ? 'completed_no_secrets' : 'completed_with_secrets';
    const message =
      secretsFound === 0
        ? 'Gitleaks scan completed - no secrets found'
        : `Gitleaks scan completed - found ${secretsFound} potential secret(s)`;

    return {
      ruleId: 'gitleaks.scan-summary',
      message: message,
      filePath: 'N/A',
      line: 0,
      severity: 'info',
      secret: 'N/A',
      match: 'N/A',
      tags: ['scan-summary', 'gitleaks'],
      scanner: 'Gitleaks',
      scanStatus: status,
      exitCode: exitCode,
      secretsFound: secretsFound,
      scanOutput: {
        stdout: stdout.trim() || 'No output',
        stderr: stderr.trim() || 'No errors',
        hasOutput: stdout.trim().length > 0,
        hasErrors: stderr.trim().length > 0,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
