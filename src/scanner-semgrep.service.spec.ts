import { SemgrepScanner } from './scanner-semgrep.service';
import { exec } from 'child_process';

// Mock child_process.exec
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));

describe('SemgrepScanner', () => {
  let scanner: SemgrepScanner;
  const mockExec = exec as jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    scanner = new SemgrepScanner();
    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return correct scanner name', () => {
      expect(scanner.getName()).toBe('Semgrep');
    });
  });

  describe('getVersion', () => {
    it('should return correct version', () => {
      expect(scanner.getVersion()).toBe('latest');
    });
  });

  describe('scan', () => {
    const testPath = '/tmp/test-repo';

    it('should successfully scan and return findings', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'SEC-001',
            extra: {
              message: 'Hardcoded secret found',
              severity: 'HIGH',
            },
            path: 'src/config.ts',
            start: {
              line: 10,
            },
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        expect(command).toBe(`semgrep --config=auto --json --quiet ${testPath}`);
        expect(options).toEqual({ maxBuffer: 1024 * 1024 * 10 });
        
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      
      expect(findings).toHaveLength(1);
      expect(findings[0]).toEqual({
        ruleId: 'SEC-001',
        message: 'Hardcoded secret found',
        filePath: 'src/config.ts',
        line: 10,
        severity: 'HIGH',
      });
    });

    it('should handle empty results', async () => {
      const mockSemgrepOutput = { results: [] };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings).toHaveLength(0);
    });

    it('should handle results without check_id', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            extra: {
              message: 'Finding without check_id',
              severity: 'MEDIUM',
            },
            path: 'src/test.ts',
            start: { line: 5 },
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings[0].ruleId).toBe('UNKNOWN');
    });

    it('should handle results without message', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'SEC-003',
            extra: {
              metadata: { short_description: 'Short description' },
              severity: 'LOW',
            },
            path: 'src/utils.ts',
            start: { line: 15 },
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings[0].message).toBe('Short description');
    });

    it('should handle results without start line', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'SEC-005',
            extra: {
              message: 'Finding without line number',
              severity: 'WARNING',
            },
            path: 'src/file.ts',
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings[0].line).toBe(0);
    });

    it('should handle results without severity', async () => {
      const mockSemgrepOutput = {
        results: [
          {
            check_id: 'SEC-006',
            extra: { message: 'Finding without severity' },
            path: 'src/file.ts',
            start: { line: 12 },
          },
        ],
      };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings[0].severity).toBe('INFO');
    });

    it('should handle semgrep execution errors', async () => {
      const execError = new Error('Semgrep command failed');
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(execError, '', 'stderr output');
        }
        return {} as any;
      });

      await expect(scanner.scan(testPath)).rejects.toThrow('Semgrep command failed');
    });

    it('should handle JSON parsing errors', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, 'invalid json', '');
        }
        return {} as any;
      });

      await expect(scanner.scan(testPath)).rejects.toThrow();
    });

    it('should handle output without results property', async () => {
      const mockSemgrepOutput = { otherProperty: 'value' };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings).toHaveLength(0);
    });

    it('should handle output with non-array results', async () => {
      const mockSemgrepOutput = { results: 'not an array' };

      mockExec.mockImplementation((command, options, callback) => {
        if (callback) {
          callback(null, JSON.stringify(mockSemgrepOutput), '');
        }
        return {} as any;
      });

      const findings = await scanner.scan(testPath);
      expect(findings).toHaveLength(0);
    });

    it('should use correct semgrep command with auto config', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        expect(command).toBe(`semgrep --config=auto --json --quiet ${testPath}`);
        if (callback) {
          callback(null, JSON.stringify({ results: [] }), '');
        }
        return {} as any;
      });

      await scanner.scan(testPath);
    });

    it('should use correct buffer size', async () => {
      mockExec.mockImplementation((command, options, callback) => {
        expect(options).toEqual({ maxBuffer: 1024 * 1024 * 10 });
        if (callback) {
          callback(null, JSON.stringify({ results: [] }), '');
        }
        return {} as any;
      });

      await scanner.scan(testPath);
    });
  });
}); 