import { SecurityScanner } from './scanners.interface';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class SemgrepScanner implements SecurityScanner {
  getName(): string {
    return 'Semgrep';
  }
  getVersion(): string {
    return 'latest';
  }

  /**
   * Validates and sanitizes the target path to prevent command injection
   * @param targetPath The path to validate
   * @returns The sanitized absolute path
   * @throws Error if the path is invalid or contains dangerous characters
   */
  private validateAndSanitizePath(targetPath: string): string {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('Target path must be a non-empty string');
    }

    // Remove any null bytes or control characters
    const sanitizedPath = targetPath.replace(/[\x00-\x1f\x7f]/g, '');
    
    // Check for dangerous patterns that could lead to command injection
    const dangerousPatterns = [
      /[;&|`$(){}[\]]/, // Shell metacharacters
      /\.\./, // Directory traversal attempts
      /[<>]/, // Redirection characters
      /\s+/, // Multiple spaces (potential for command chaining)
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitizedPath)) {
        throw new Error(`Invalid characters detected in path: ${targetPath}`);
      }
    }

    // Resolve to absolute path to prevent directory traversal
    const absolutePath = path.resolve(sanitizedPath);
    
    // Ensure the path exists and is a directory
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Target path does not exist: ${absolutePath}`);
    }
    
    const stats = fs.statSync(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Target path must be a directory: ${absolutePath}`);
    }

    // Additional security check: ensure the path is within reasonable bounds
    // This prevents extremely long paths that could cause issues
    if (absolutePath.length > 4096) {
      throw new Error('Target path is too long');
    }

    return absolutePath;
  }

  async scan(targetPath: string): Promise<Array<any>> {
    try {
      // Validate and sanitize the input path
      const sanitizedPath = this.validateAndSanitizePath(targetPath);
      
      return new Promise((resolve, reject) => {
        // Use spawn with array arguments to prevent command injection
        const semgrepProcess = spawn('semgrep', [
          '--config=auto',
          '--json',
          '--quiet',
          sanitizedPath
        ], {
          // Security options
          timeout: 300000, // 5 minute timeout
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        semgrepProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        semgrepProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        semgrepProcess.on('close', (code) => {
          if (code !== 0) {
            return reject(new Error(`Semgrep process exited with code ${code}: ${stderr}`));
          }
          
          try {
            const semgrepOutput = JSON.parse(stdout);
            if (!semgrepOutput || !Array.isArray(semgrepOutput.results)) return resolve([]);
            const findings = semgrepOutput.results.map((result: any) => ({
              ruleId: result.check_id || 'UNKNOWN',
              message: result.extra?.message || result.extra?.metadata?.short_description || 'No message',
              filePath: result.path,
              line: result.start?.line || 0,
              severity: result.extra?.severity || 'INFO',
            }));
            resolve(findings);
          } catch (parseErr) {
            reject(parseErr);
          }
        });

        semgrepProcess.on('error', (error) => {
          reject(error);
        });

        // Handle timeout
        setTimeout(() => {
          semgrepProcess.kill('SIGTERM');
          reject(new Error('Semgrep process timed out'));
        }, 300000);
      });
    } catch (error) {
      // Re-throw validation errors
      throw error;
    }
  }
} 