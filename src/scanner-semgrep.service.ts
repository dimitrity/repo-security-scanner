import { SecurityScanner } from './scanners.interface';
import { exec } from 'child_process';

export class SemgrepScanner implements SecurityScanner {
  getName(): string {
    return 'Semgrep';
  }
  getVersion(): string {
    return 'latest';
  }
  async scan(targetPath: string): Promise<Array<any>> {
    return new Promise((resolve, reject) => {
      exec(
        `semgrep --config=auto --json --quiet ${targetPath}`,
        { maxBuffer: 1024 * 1024 * 10 },
        (error, stdout, stderr) => {
          if (error) {
            return reject(error);
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
        },
      );
    });
  }
} 