import { Test, TestingModule } from '@nestjs/testing';
import { GitleaksScanner } from './scanner-gitleaks.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

jest.mock('child_process');
jest.mock('fs');
jest.mock('path');
jest.mock('os');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('GitleaksScanner', () => {
  let scanner: GitleaksScanner;
  let mockProcess: any;
  let mockOs: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitleaksScanner],
    }).compile();

    scanner = module.get<GitleaksScanner>(GitleaksScanner);
    jest.clearAllMocks();

    // Mock fs
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({
      isDirectory: () => true,
    });

    // Mock path
    (path.resolve as jest.Mock).mockImplementation((p) => `/absolute/${p}`);
    (path.normalize as jest.Mock).mockImplementation((p) => p);
    (path.relative as jest.Mock).mockImplementation((from, to) => `relative/${to}`);
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());

    // Mock os
    mockOs = {
      tmpdir: jest.fn().mockReturnValue('/tmp'),
    };
    (os.tmpdir as jest.Mock) = mockOs.tmpdir;

    // Mock process.cwd
    Object.defineProperty(process, 'cwd', {
      value: jest.fn().mockReturnValue('/current/working/directory'),
      writable: true,
    });

    mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProcess);
  });

  describe('getName', () => {
    it('should return Gitleaks', () => {
      expect(scanner.getName()).toBe('Gitleaks');
    });
  });

  describe('getVersion', () => {
    it('should return latest', () => {
      expect(scanner.getVersion()).toBe('latest');
    });
  });

  describe('validateAndSanitizePath', () => {
    it('should throw error for empty path', () => {
      expect(() => {
        (scanner as any).validateAndSanitizePath('');
      }).toThrow('Invalid target path provided');
    });

    it('should throw error for null path', () => {
      expect(() => {
        (scanner as any).validateAndSanitizePath(null);
      }).toThrow('Invalid target path provided');
    });

    it('should throw error for undefined path', () => {
      expect(() => {
        (scanner as any).validateAndSanitizePath(undefined);
      }).toThrow('Invalid target path provided');
    });

    it('should throw error for non-string path', () => {
      expect(() => {
        (scanner as any).validateAndSanitizePath(123 as any);
      }).toThrow('Invalid target path provided');
    });

    it('should throw error for non-existent path', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/non/existent/path');
      }).toThrow('Target path does not exist: /absolute//non/existent/path');
    });

    it('should throw error for non-directory path', () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => false,
      });
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/file/path');
      }).toThrow('Target path is not a directory: /absolute//file/path');
    });

    it('should throw error for path outside current directory and temp directories', () => {
      (path.resolve as jest.Mock).mockReturnValue('/outside/allowed/path');
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/outside/path');
      }).toThrow('Target path is outside allowed directories: /outside/allowed/path');
    });

    it('should allow path in current directory', () => {
      (path.resolve as jest.Mock).mockReturnValue('/current/working/directory/subdir');
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/current/subdir');
      }).not.toThrow();
    });

    it('should allow path in temp directory', () => {
      (path.resolve as jest.Mock).mockReturnValue('/tmp/some/path');
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/tmp/path');
      }).not.toThrow();
    });

    it('should allow path with tmp- pattern', () => {
      (path.resolve as jest.Mock).mockReturnValue('/some/path/tmp-12345');
      
      expect(() => {
        (scanner as any).validateAndSanitizePath('/path/tmp-12345');
      }).not.toThrow();
    });
  });

  describe('isInTempDirectory', () => {
    it('should return true for /tmp path', () => {
      const result = (scanner as any).isInTempDirectory('/tmp/some/path');
      expect(result).toBe(true);
    });

    it('should return true for OS temp directory', () => {
      mockOs.tmpdir.mockReturnValue('/var/folders');
      const result = (scanner as any).isInTempDirectory('/var/folders/some/path');
      expect(result).toBe(true);
    });

    it('should return true for /temp path', () => {
      const result = (scanner as any).isInTempDirectory('/temp/some/path');
      expect(result).toBe(true);
    });

    it('should return true for /var/tmp path', () => {
      const result = (scanner as any).isInTempDirectory('/var/tmp/some/path');
      expect(result).toBe(true);
    });

    it('should return true for path with tmp- pattern', () => {
      const result = (scanner as any).isInTempDirectory('/some/path/tmp-12345');
      expect(result).toBe(true);
    });

    it('should return false for regular path', () => {
      const result = (scanner as any).isInTempDirectory('/home/user/project');
      expect(result).toBe(false);
    });
  });

  describe('checkGitleaksInstallation', () => {
    let stdoutCallback: (data: Buffer) => void;
    let stderrCallback: (data: Buffer) => void;
    let closeCallback: (code: number) => void;
    let errorCallback: (error: Error) => void;

    beforeEach(() => {
      stdoutCallback = () => {};
      stderrCallback = () => {};
      closeCallback = () => {};
      errorCallback = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') stdoutCallback = callback;
      });
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') stderrCallback = callback;
      });
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') closeCallback = callback;
        if (event === 'error') errorCallback = callback;
      });
    });

    it('should resolve when gitleaks is installed', async () => {
      const promise = (scanner as any).checkGitleaksInstallation();
      
      stdoutCallback(Buffer.from('gitleaks version 8.16.4'));
      closeCallback(0);
      
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject when gitleaks is not found', async () => {
      const promise = (scanner as any).checkGitleaksInstallation();
      
      stderrCallback(Buffer.from('command not found: gitleaks'));
      closeCallback(1);
      
      await expect(promise).rejects.toThrow('Gitleaks not found or not accessible. Error: command not found: gitleaks');
    });

    it('should reject on process error', async () => {
      const promise = (scanner as any).checkGitleaksInstallation();
      
      errorCallback(new Error('ENOENT'));
      
      await expect(promise).rejects.toThrow('Failed to check Gitleaks installation: ENOENT');
    });
  });

  describe('runGitleaksScan', () => {
    let stdoutCallback: (data: Buffer) => void;
    let stderrCallback: (data: Buffer) => void;
    let closeCallback: (code: number) => void;
    let errorCallback: (error: Error) => void;

    beforeEach(() => {
      stdoutCallback = () => {};
      stderrCallback = () => {};
      closeCallback = () => {};
      errorCallback = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') stdoutCallback = callback;
      });
      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') stderrCallback = callback;
      });
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') closeCallback = callback;
        if (event === 'error') errorCallback = callback;
      });
    });

    it('should return findings when secrets are found', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      stdoutCallback(Buffer.from(`Finding: AWS Access Key ID
Secret: AKIAIOSFODNN7EXAMPLE
RuleID: aws-access-key-id
Entropy: 0.0
File: /test/path/config.js
Line: 15
Commit: abc123
Author: John Doe
Email: john@example.com
Date: 2023-01-01T00:00:00Z
Fingerprint: abc123def456

`));
      closeCallback(1);
      
      const result = await promise;
      expect(result).toHaveLength(2); // 1 finding + 1 scan summary
      expect(result[0]).toMatchObject({
        ruleId: 'gitleaks.aws-access-key-id',
        message: 'AWS Access Key ID',
        filePath: '/test/path/config.js',
        line: 15,
        severity: 'high',
        secret: 'AKIAIOSFODNN7EXAMPLE',
        scanner: 'Gitleaks',
      });
      expect(result[1]).toMatchObject({
        ruleId: 'gitleaks.scan-summary',
        severity: 'info',
        scanner: 'Gitleaks',
        scanStatus: 'completed_with_secrets',
        secretsFound: 1,
      });
    });

    it('should return scan summary when no secrets found', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      closeCallback(0);
      
      const result = await promise;
      expect(result).toHaveLength(1); // Only scan summary
      expect(result[0]).toMatchObject({
        ruleId: 'gitleaks.scan-summary',
        message: 'Gitleaks scan completed - no secrets found',
        severity: 'info',
        scanner: 'Gitleaks',
        scanStatus: 'completed_no_secrets',
        secretsFound: 0,
      });
    });

    it('should handle multiple findings', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      stdoutCallback(Buffer.from(`Finding: AWS Access Key ID
Secret: AKIAIOSFODNN7EXAMPLE
RuleID: aws-access-key-id
File: config.js
Line: 15

Finding: Generic API Key
Secret: sk-1234567890abcdef
RuleID: generic-api-key
File: api.js
Line: 42

`));
      closeCallback(1);
      
      const result = await promise;
      expect(result).toHaveLength(3); // 2 findings + 1 scan summary
      expect(result[0].ruleId).toBe('gitleaks.aws-access-key-id');
      expect(result[1].ruleId).toBe('gitleaks.generic-api-key');
      expect(result[2].secretsFound).toBe(2);
    });

    it('should handle parsing errors gracefully', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      stdoutCallback(Buffer.from('invalid output format'));
      closeCallback(1);
      
      const result = await promise;
      expect(result).toHaveLength(1); // Only scan summary
      expect(result[0]).toMatchObject({
        ruleId: 'gitleaks.scan-summary',
        scanStatus: 'completed_with_secrets',
        secretsFound: 0,
      });
    });

    it('should reject on process error', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      errorCallback(new Error('ENOENT'));
      
      await expect(promise).rejects.toThrow('Failed to execute Gitleaks: ENOENT');
    });

    it('should reject on non-zero exit code (not 0 or 1)', async () => {
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      stderrCallback(Buffer.from('Invalid arguments'));
      closeCallback(2);
      
      await expect(promise).rejects.toThrow('Gitleaks scan failed with code 2: Invalid arguments');
    });

    it('should handle timeout', async () => {
      jest.useFakeTimers();
      
      const promise = (scanner as any).runGitleaksScan('/test/path');
      
      jest.advanceTimersByTime(300000); // 5 minutes
      
      await expect(promise).rejects.toThrow('Gitleaks scan timed out');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      
      jest.useRealTimers();
    });
  });

  describe('parseGitleaksOutput', () => {
    it('should return empty array for empty output', () => {
      const result = (scanner as any).parseGitleaksOutput('', '/test/path');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only output', () => {
      const result = (scanner as any).parseGitleaksOutput('   \n  \t  ', '/test/path');
      expect(result).toEqual([]);
    });

    it('should parse single finding correctly', () => {
      const output = `Finding: AWS Access Key ID
Secret: AKIAIOSFODNN7EXAMPLE
RuleID: aws-access-key-id
Entropy: 0.0
File: config.js
Line: 15
Commit: abc123
Author: John Doe
Email: john@example.com
Date: 2023-01-01T00:00:00Z
Fingerprint: abc123def456

`;
      
      const result = (scanner as any).parseGitleaksOutput(output, '/test/path');
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        ruleId: 'gitleaks.aws-access-key-id',
        message: 'AWS Access Key ID',
        filePath: 'config.js',
        line: 15,
        severity: 'high',
        secret: 'AKIAIOSFODNN7EXAMPLE',
        entropy: 0.0,
        commit: 'abc123',
        author: 'John Doe',
        email: 'john@example.com',
        date: '2023-01-01T00:00:00Z',
        fingerprint: 'abc123def456',
      });
    });

    it('should parse multiple findings correctly', () => {
      const output = `Finding: AWS Access Key ID
Secret: AKIAIOSFODNN7EXAMPLE
RuleID: aws-access-key-id
File: config.js
Line: 15

Finding: Generic API Key
Secret: sk-1234567890abcdef
RuleID: generic-api-key
File: api.js
Line: 42

`;
      
      const result = (scanner as any).parseGitleaksOutput(output, '/test/path');
      expect(result).toHaveLength(2);
      expect(result[0].ruleId).toBe('gitleaks.aws-access-key-id');
      expect(result[1].ruleId).toBe('gitleaks.generic-api-key');
    });

    it('should handle finding without empty line at end', () => {
      const output = `Finding: AWS Access Key ID
Secret: AKIAIOSFODNN7EXAMPLE
RuleID: aws-access-key-id
File: config.js
Line: 15`;
      
      const result = (scanner as any).parseGitleaksOutput(output, '/test/path');
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('gitleaks.aws-access-key-id');
    });

    it('should handle unknown keys', () => {
      const output = `Finding: Test Finding
Secret: test-secret
RuleID: test-rule
UnknownKey: unknown-value
File: test.js
Line: 10

`;
      
      const result = (scanner as any).parseGitleaksOutput(output, '/test/path');
      expect(result).toHaveLength(1);
      // The transformGitleaksFinding method only maps known fields, so unknown keys are not preserved
      expect(result[0]).toMatchObject({
        ruleId: 'gitleaks.test-rule',
        message: 'Test Finding',
        filePath: 'test.js',
        line: 10,
        severity: 'low',
        secret: 'test-secret',
        scanner: 'Gitleaks',
      });
    });

    it('should handle parsing errors gracefully', () => {
      const result = (scanner as any).parseGitleaksOutput('invalid format', '/test/path');
      expect(result).toEqual([]);
    });
  });

  describe('transformGitleaksFinding', () => {
    it('should transform finding with all fields', () => {
      const gitleaksFinding = {
        Finding: 'AWS Access Key ID',
        Secret: 'AKIAIOSFODNN7EXAMPLE',
        RuleID: 'aws-access-key-id',
        Entropy: 0.0,
        File: 'config.js',
        Line: 15,
        Commit: 'abc123',
        Author: 'John Doe',
        Email: 'john@example.com',
        Date: '2023-01-01T00:00:00Z',
        Fingerprint: 'abc123def456',
      };
      
      const result = (scanner as any).transformGitleaksFinding(gitleaksFinding, '/test/path');
      
      expect(result).toMatchObject({
        ruleId: 'gitleaks.aws-access-key-id',
        message: 'AWS Access Key ID',
        filePath: 'config.js',
        line: 15,
        severity: 'high',
        secret: 'AKIAIOSFODNN7EXAMPLE',
        match: 'AWS Access Key ID',
        tags: ['aws-access-key-id'],
        scanner: 'Gitleaks',
        entropy: 0.0,
        commit: 'abc123',
        author: 'John Doe',
        email: 'john@example.com',
        date: '2023-01-01T00:00:00Z',
        fingerprint: 'abc123def456',
      });
    });

    it('should handle missing fields with defaults', () => {
      const gitleaksFinding = {
        Finding: 'Test Finding',
        RuleID: 'test-rule',
      };
      
      const result = (scanner as any).transformGitleaksFinding(gitleaksFinding, '/test/path');
      
      expect(result).toMatchObject({
        ruleId: 'gitleaks.test-rule',
        message: 'Test Finding',
        filePath: 'unknown',
        line: 0,
        severity: 'low',
        secret: 'hidden',
        match: 'Test Finding',
        tags: ['test-rule'],
        scanner: 'Gitleaks',
      });
    });
  });

  describe('mapGitleaksSeverity', () => {
    it('should map high severity rules correctly', () => {
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
      
      highSeverityRules.forEach(rule => {
        const result = (scanner as any).mapGitleaksSeverity(rule);
        expect(result).toBe('high');
      });
    });

    it('should map medium severity rules correctly', () => {
      const mediumSeverityRules = [
        'email',
        'url',
        'ip-address',
        'credit-card',
      ];
      
      mediumSeverityRules.forEach(rule => {
        const result = (scanner as any).mapGitleaksSeverity(rule);
        expect(result).toBe('medium');
      });
    });

    it('should map unknown rules to low severity', () => {
      const result = (scanner as any).mapGitleaksSeverity('unknown-rule');
      expect(result).toBe('low');
    });

    it('should handle case insensitive matching', () => {
      expect((scanner as any).mapGitleaksSeverity('AWS-ACCESS-KEY-ID')).toBe('high');
      expect((scanner as any).mapGitleaksSeverity('Email')).toBe('medium');
    });
  });

  describe('createScanSummaryFinding', () => {
    it('should create summary for successful scan with no secrets', () => {
      const result = (scanner as any).createScanSummaryFinding(0, 'stdout', 'stderr', 0);
      
      expect(result).toMatchObject({
        ruleId: 'gitleaks.scan-summary',
        message: 'Gitleaks scan completed - no secrets found',
        filePath: 'N/A',
        line: 0,
        severity: 'info',
        secret: 'N/A',
        match: 'N/A',
        tags: ['scan-summary', 'gitleaks'],
        scanner: 'Gitleaks',
        scanStatus: 'completed_no_secrets',
        exitCode: 0,
        secretsFound: 0,
        scanOutput: {
          stdout: 'stdout',
          stderr: 'stderr',
          hasOutput: true,
          hasErrors: true,
        },
      });
      expect(result.timestamp).toBeDefined();
    });

    it('should create summary for successful scan with secrets', () => {
      const result = (scanner as any).createScanSummaryFinding(1, 'stdout', 'stderr', 3);
      
      expect(result).toMatchObject({
        message: 'Gitleaks scan completed - found 3 potential secret(s)',
        scanStatus: 'completed_with_secrets',
        exitCode: 1,
        secretsFound: 3,
      });
    });

    it('should handle empty output', () => {
      const result = (scanner as any).createScanSummaryFinding(0, '', '', 0);
      
      expect(result.scanOutput).toMatchObject({
        stdout: 'No output',
        stderr: 'No errors',
        hasOutput: false,
        hasErrors: false,
      });
    });
  });

  describe('scan', () => {
    it('should throw error for invalid path', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      
      await expect(scanner.scan('/non/existent/path')).rejects.toThrow('Gitleaks scan failed: Target path does not exist: /absolute//non/existent/path');
    });

    it('should throw error for non-directory path', async () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => false,
      });
      
      await expect(scanner.scan('/file/path')).rejects.toThrow('Gitleaks scan failed: Target path is not a directory: /absolute//file/path');
    });

    it('should throw error for path outside allowed directories', async () => {
      (path.resolve as jest.Mock).mockReturnValue('/outside/allowed/path');
      
      await expect(scanner.scan('/outside/path')).rejects.toThrow('Gitleaks scan failed: Target path is outside allowed directories: /outside/allowed/path');
    });
  });
}); 