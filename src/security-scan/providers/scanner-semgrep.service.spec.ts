import { Test, TestingModule } from '@nestjs/testing';
import { SemgrepScanner } from './scanner-semgrep.service';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// Mock dependencies
jest.mock('child_process');
jest.mock('fs');
jest.mock('path');

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('SemgrepScanner', () => {
  let scanner: SemgrepScanner;
  let mockProcess: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SemgrepScanner],
    }).compile();

    scanner = module.get<SemgrepScanner>(SemgrepScanner);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock fs.existsSync and fs.statSync
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.statSync as jest.Mock).mockReturnValue({
      isDirectory: () => true,
    });

    // Mock path.resolve
    (path.resolve as jest.Mock).mockImplementation((p) => `/absolute/${p}`);
    (path.normalize as jest.Mock).mockImplementation((p) => p);
    (path.relative as jest.Mock).mockImplementation(
      (from, to) => `relative/${to}`,
    );
    (path.basename as jest.Mock).mockImplementation((p) => p.split('/').pop());
  });

  describe('getName', () => {
    it('should return the correct scanner name', () => {
      expect(scanner.getName()).toBe('Semgrep');
    });
  });

  describe('getVersion', () => {
    it('should return the correct scanner version', () => {
      expect(scanner.getVersion()).toBe('latest');
    });
  });

  describe('validateAndSanitizePath', () => {
    it('should throw error for empty path', () => {
      expect(() => (scanner as any).validateAndSanitizePath('')).toThrow(
        'Target path must be a non-empty string',
      );
    });

    it('should throw error for null path', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath(null as any),
      ).toThrow('Target path must be a non-empty string');
    });

    it('should throw error for undefined path', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath(undefined as any),
      ).toThrow('Target path must be a non-empty string');
    });

    it('should throw error for non-string path', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath(123 as any),
      ).toThrow('Target path must be a non-empty string');
    });

    it('should throw error for path with shell metacharacters', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath('/path;with&metacharacters'),
      ).toThrow('Invalid characters detected in path');
    });

    it('should throw error for path with directory traversal', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath('/path/../traversal'),
      ).toThrow('Invalid characters detected in path');
    });

    it('should throw error for path with redirection characters', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath('/path>with<redirect'),
      ).toThrow('Invalid characters detected in path');
    });

    it('should throw error for path with multiple spaces', () => {
      expect(() =>
        (scanner as any).validateAndSanitizePath('/path  with  spaces'),
      ).toThrow('Invalid characters detected in path');
    });

    it('should throw error for non-existent path', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(() =>
        (scanner as any).validateAndSanitizePath('/nonexistent'),
      ).toThrow('Target path does not exist');
    });

    it('should throw error for path that is not a directory', () => {
      (fs.statSync as jest.Mock).mockReturnValue({
        isDirectory: () => false,
      });
      expect(() =>
        (scanner as any).validateAndSanitizePath('/not-a-directory'),
      ).toThrow('Target path must be a directory');
    });

    it('should throw error for extremely long path', () => {
      const longPath = 'a'.repeat(4097);
      expect(() => (scanner as any).validateAndSanitizePath(longPath)).toThrow(
        'Target path is too long',
      );
    });

    it('should return sanitized absolute path for valid input', () => {
      const result = (scanner as any).validateAndSanitizePath('/valid/path');
      expect(result).toBe('/absolute//valid/path');
    });

    it('should remove null bytes and control characters', () => {
      const result = (scanner as any).validateAndSanitizePath(
        '/path\x00with\x1fcontrol\x7fchars',
      );
      expect(result).toBe('/absolute//pathwithcontrolchars');
    });
  });

  describe('scan', () => {
    beforeEach(() => {
      mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
      };
      mockSpawn.mockReturnValue(mockProcess);
    });

    it('should successfully scan and return findings', async () => {
      const mockStdout = JSON.stringify({
        results: [
          {
            check_id: 'test-rule',
            extra: {
              message: 'Test finding',
              severity: 'WARNING',
            },
            path: '/test/path/file.js',
            start: { line: 10 },
          },
        ],
      });

      // Setup process events
      let stdoutCallback: (data: any) => void = () => {};
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');

      // Simulate stdout data
      stdoutCallback(Buffer.from(mockStdout));

      // Simulate process close
      closeCallback(0);

      const result = await scanPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'semgrep',
        ['--config=auto', '--json', '--quiet', '/absolute//test/path'],
        {
          timeout: 300000,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      expect(result).toEqual([
        {
          ruleId: 'test-rule',
          message: 'Test finding',
          filePath: 'relative//test/path/file.js',
          line: 10,
          severity: 'WARNING',
          scanner: 'Semgrep',
        },
      ]);
    });

    it('should handle empty output', async () => {
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          // No data
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      closeCallback(0);

      const result = await scanPromise;
      expect(result).toEqual([]);
    });

    it('should handle array output format', async () => {
      const mockStdout = JSON.stringify([
        {
          check_id: 'test-rule',
          extra: { message: 'Test finding' },
          path: '/test/path/file.js',
          start: { line: 10 },
        },
      ]);

      let stdoutCallback: (data: any) => void = () => {};
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      stdoutCallback(Buffer.from(mockStdout));
      closeCallback(0);

      const result = await scanPromise;
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('test-rule');
    });

    it('should handle findings format', async () => {
      const mockStdout = JSON.stringify({
        findings: [
          {
            check_id: 'test-rule',
            extra: { message: 'Test finding' },
            path: '/test/path/file.js',
            start: { line: 10 },
          },
        ],
      });

      let stdoutCallback: (data: any) => void = () => {};
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      stdoutCallback(Buffer.from(mockStdout));
      closeCallback(0);

      const result = await scanPromise;
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('test-rule');
    });

    it('should handle process error', async () => {
      let errorCallback: (error: Error) => void = () => {};

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          errorCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      errorCallback(new Error('Process error'));

      await expect(scanPromise).rejects.toThrow('Process error');
    });

    it('should handle non-zero exit code', async () => {
      let stderrCallback: (data: any) => void = () => {};
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stderr.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stderrCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      stderrCallback(Buffer.from('Error message'));
      closeCallback(1);

      await expect(scanPromise).rejects.toThrow(
        'Semgrep process exited with code 1: Error message',
      );
    });

    it('should handle JSON parse error', async () => {
      let stdoutCallback: (data: any) => void = () => {};
      let closeCallback: (code: number) => void = () => {};

      mockProcess.stdout.on.mockImplementation((event, callback) => {
        if (event === 'data') {
          stdoutCallback = callback;
        }
      });

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          closeCallback = callback;
        }
      });

      const scanPromise = scanner.scan('/test/path');
      stdoutCallback(Buffer.from('Invalid JSON'));
      closeCallback(0);

      await expect(scanPromise).rejects.toThrow();
    });

    it('should handle timeout', async () => {
      jest.useFakeTimers();

      mockProcess.kill = jest.fn();

      const scanPromise = scanner.scan('/test/path');

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(300000);

      await expect(scanPromise).rejects.toThrow('Semgrep scan timeout');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');

      jest.useRealTimers();
    });

    it('should handle path validation error', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(scanner.scan('/nonexistent')).rejects.toThrow(
        'Semgrep scan failed: Target path does not exist',
      );
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path when file is within target directory', () => {
      const result = (scanner as any).getRelativePath(
        '/test/path/file.js',
        '/test/path',
      );
      expect(result).toBe('relative//test/path/file.js');
    });

    it('should return basename when file is not within target directory', () => {
      (path.relative as jest.Mock).mockReturnValue('');
      const result = (scanner as any).getRelativePath(
        '/other/path/file.js',
        '/test/path',
      );
      expect(result).toBe('file.js');
    });

    it('should handle empty absolute path', () => {
      const result = (scanner as any).getRelativePath('', '/test/path');
      expect(result).toBe('unknown');
    });

    it('should handle empty target path', () => {
      const result = (scanner as any).getRelativePath('/test/path/file.js', '');
      expect(result).toBe('/test/path/file.js');
    });

    it('should handle path operation errors', () => {
      (path.relative as jest.Mock).mockImplementation(() => {
        throw new Error('Path error');
      });

      const result = (scanner as any).getRelativePath(
        '/test/path/file.js',
        '/test/path',
      );
      expect(result).toBe('file.js');
    });
  });
});
