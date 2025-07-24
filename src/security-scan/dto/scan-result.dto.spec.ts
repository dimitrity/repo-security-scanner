import { ScanResultDto } from './scan-result.dto';

describe('ScanResultDto', () => {
  describe('structure validation', () => {
    it('should have correct repository property structure', () => {
      const dto = new ScanResultDto();
      dto.repository = {
        name: 'test',
        description: 'test',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc', timestamp: '2024-01-01T00:00:00.000Z' },
      };

      expect(dto).toHaveProperty('repository');
      expect(dto.repository).toHaveProperty('name');
      expect(dto.repository).toHaveProperty('description');
      expect(dto.repository).toHaveProperty('defaultBranch');
      expect(dto.repository).toHaveProperty('lastCommit');
      expect(dto.repository.lastCommit).toHaveProperty('hash');
      expect(dto.repository.lastCommit).toHaveProperty('timestamp');
    });

    it('should have correct scanner property structure', () => {
      const dto = new ScanResultDto();
      dto.scanner = { name: 'test', version: '1.0.0' };

      expect(dto).toHaveProperty('scanner');
      expect(dto.scanner).toHaveProperty('name');
      expect(dto.scanner).toHaveProperty('version');
    });

    it('should have correct findings property structure', () => {
      const dto = new ScanResultDto();
      dto.findings = [];

      expect(dto).toHaveProperty('findings');
      expect(Array.isArray(dto.findings)).toBe(true);
    });
  });

  describe('data assignment', () => {
    it('should accept valid repository data', () => {
      const dto = new ScanResultDto();
      const repositoryData = {
        name: 'test-repo',
        description: 'A test repository',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'abc123def456',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      };

      dto.repository = repositoryData;
      expect(dto.repository).toEqual(repositoryData);
    });

    it('should accept valid scanner data', () => {
      const dto = new ScanResultDto();
      const scannerData = {
        name: 'Semgrep',
        version: '1.0.0',
      };

      dto.scanner = scannerData;
      expect(dto.scanner).toEqual(scannerData);
    });

    it('should accept valid findings data', () => {
      const dto = new ScanResultDto();
      const findingsData = [
        {
          ruleId: 'SEC-001',
          message: 'Hardcoded secret found',
          filePath: 'src/config.ts',
          line: 10,
          severity: 'HIGH',
        },
        {
          ruleId: 'SEC-002',
          message: 'SQL injection vulnerability',
          filePath: 'src/database.ts',
          line: 25,
          severity: 'CRITICAL',
        },
      ];

      dto.findings = findingsData;
      expect(dto.findings).toEqual(findingsData);
    });

    it('should accept empty findings array', () => {
      const dto = new ScanResultDto();
      dto.findings = [];
      expect(dto.findings).toEqual([]);
    });

    it('should accept large findings array', () => {
      const dto = new ScanResultDto();
      const largeFindings = Array.from({ length: 1000 }, (_, i) => ({
        ruleId: `SEC-${i.toString().padStart(3, '0')}`,
        message: `Finding ${i}`,
        filePath: `src/file${i}.ts`,
        line: i + 1,
        severity: 'LOW',
      }));

      dto.findings = largeFindings;
      expect(dto.findings).toHaveLength(1000);
      expect(dto.findings[0].ruleId).toBe('SEC-000');
      expect(dto.findings[999].ruleId).toBe('SEC-999');
    });
  });

  describe('finding structure validation', () => {
    it('should validate finding with all required properties', () => {
      const dto = new ScanResultDto();
      const finding = {
        ruleId: 'SEC-001',
        message: 'Test finding',
        filePath: 'src/test.ts',
        line: 42,
        severity: 'MEDIUM',
      };

      dto.findings = [finding];
      expect(dto.findings[0]).toHaveProperty('ruleId');
      expect(dto.findings[0]).toHaveProperty('message');
      expect(dto.findings[0]).toHaveProperty('filePath');
      expect(dto.findings[0]).toHaveProperty('line');
      expect(dto.findings[0]).toHaveProperty('severity');
    });

    it('should handle findings with different severity levels', () => {
      const dto = new ScanResultDto();
      const severities = [
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL',
        'INFO',
        'WARNING',
      ];

      severities.forEach((severity, index) => {
        const finding = {
          ruleId: `SEC-${index}`,
          message: `Finding with ${severity} severity`,
          filePath: `src/file${index}.ts`,
          line: index + 1,
          severity,
        };

        dto.findings = [finding];
        expect(dto.findings[0].severity).toBe(severity);
      });
    });

    it('should handle findings with different file extensions', () => {
      const dto = new ScanResultDto();
      const extensions = ['.ts', '.js', '.py', '.java', '.cpp', '.go', '.rs'];

      extensions.forEach((ext, index) => {
        const finding = {
          ruleId: `SEC-${index}`,
          message: `Finding in ${ext} file`,
          filePath: `src/file${index}${ext}`,
          line: index + 1,
          severity: 'LOW',
        };

        dto.findings = [finding];
        expect(dto.findings[0].filePath.endsWith(ext)).toBe(true);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle findings with very long messages', () => {
      const dto = new ScanResultDto();
      const longMessage = 'A'.repeat(10000);
      const finding = {
        ruleId: 'SEC-001',
        message: longMessage,
        filePath: 'src/test.ts',
        line: 1,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].message).toBe(longMessage);
    });

    it('should handle findings with very long file paths', () => {
      const dto = new ScanResultDto();
      const longPath =
        'src/very/deep/nested/directory/structure/with/many/levels/file.ts';
      const finding = {
        ruleId: 'SEC-001',
        message: 'Test finding',
        filePath: longPath,
        line: 1,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].filePath).toBe(longPath);
    });

    it('should handle findings with zero line numbers', () => {
      const dto = new ScanResultDto();
      const finding = {
        ruleId: 'SEC-001',
        message: 'Test finding',
        filePath: 'src/test.ts',
        line: 0,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].line).toBe(0);
    });

    it('should handle findings with very large line numbers', () => {
      const dto = new ScanResultDto();
      const finding = {
        ruleId: 'SEC-001',
        message: 'Test finding',
        filePath: 'src/test.ts',
        line: 999999,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].line).toBe(999999);
    });

    it('should handle findings with special characters in messages', () => {
      const dto = new ScanResultDto();
      const specialMessage =
        'Finding with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const finding = {
        ruleId: 'SEC-001',
        message: specialMessage,
        filePath: 'src/test.ts',
        line: 1,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].message).toBe(specialMessage);
    });

    it('should handle findings with unicode characters', () => {
      const dto = new ScanResultDto();
      const unicodeMessage = 'Finding with unicode: 🚀 🔒 💻';
      const finding = {
        ruleId: 'SEC-001',
        message: unicodeMessage,
        filePath: 'src/测试.ts',
        line: 1,
        severity: 'LOW',
      };

      dto.findings = [finding];
      expect(dto.findings[0].message).toBe(unicodeMessage);
      expect(dto.findings[0].filePath).toBe('src/测试.ts');
    });
  });

  describe('complete scan result', () => {
    it('should create a complete scan result with all properties', () => {
      const dto = new ScanResultDto();

      dto.repository = {
        name: 'security-test-repo',
        description: 'A repository for testing security scanners',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'a1b2c3d4e5f6',
          timestamp: '2024-01-15T10:30:00.000Z',
        },
      };

      dto.scanner = {
        name: 'Semgrep',
        version: '1.45.0',
      };

      dto.findings = [
        {
          ruleId: 'SEC-001',
          message: 'Hardcoded API key detected',
          filePath: 'src/config.ts',
          line: 15,
          severity: 'HIGH',
        },
        {
          ruleId: 'SEC-002',
          message: 'SQL injection vulnerability',
          filePath: 'src/database.ts',
          line: 42,
          severity: 'CRITICAL',
        },
      ];

      expect(dto.repository.name).toBe('security-test-repo');
      expect(dto.scanner.name).toBe('Semgrep');
      expect(dto.findings).toHaveLength(2);
      expect(dto.findings[0].ruleId).toBe('SEC-001');
      expect(dto.findings[1].ruleId).toBe('SEC-002');
    });

    it('should handle multiple scan results independently', () => {
      const dto1 = new ScanResultDto();
      const dto2 = new ScanResultDto();

      dto1.repository = {
        name: 'repo1',
        description: 'First repo',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc', timestamp: '2024-01-01T00:00:00.000Z' },
      };
      dto2.repository = {
        name: 'repo2',
        description: 'Second repo',
        defaultBranch: 'develop',
        lastCommit: { hash: 'def', timestamp: '2024-01-02T00:00:00.000Z' },
      };

      expect(dto1.repository.name).toBe('repo1');
      expect(dto2.repository.name).toBe('repo2');
    });
  });

  describe('type safety', () => {
    it('should maintain type safety for all properties', () => {
      const dto = new ScanResultDto();
      dto.repository = {
        name: 'test',
        description: 'test',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc', timestamp: '2024-01-01T00:00:00.000Z' },
      };
      dto.scanner = { name: 'test', version: '1.0.0' };
      dto.findings = [];

      // Repository properties should be strings
      expect(typeof dto.repository.name).toBe('string');
      expect(typeof dto.repository.description).toBe('string');
      expect(typeof dto.repository.defaultBranch).toBe('string');
      expect(typeof dto.repository.lastCommit.hash).toBe('string');
      expect(typeof dto.repository.lastCommit.timestamp).toBe('string');

      // Scanner properties should be strings
      expect(typeof dto.scanner.name).toBe('string');
      expect(typeof dto.scanner.version).toBe('string');

      // Findings should be an array
      expect(Array.isArray(dto.findings)).toBe(true);
    });
  });
});
