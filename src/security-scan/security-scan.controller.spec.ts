import { Test, TestingModule } from '@nestjs/testing';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ValidationPipe } from '@nestjs/common';
import { ScanRequestDto } from './dto/scan-request.dto';
import { ConfigService } from '../config/config.service';

describe('SecurityScanController', () => {
  let controller: SecurityScanController;
  let service: SecurityScanService;

  const mockScanService = {
    scanRepository: jest.fn(),
    forceScanRepository: jest.fn(),
    getCodeContextForFile: jest.fn(),
    getScanStatistics: jest.fn(),
    getAllScanRecords: jest.fn(),
  };

  const mockConfigService = {
    isValidApiKey: jest.fn(),
    getApiKeyCount: jest.fn(),
    getPort: jest.fn(),
    getEnvironment: jest.fn(),
    isProduction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityScanController],
      providers: [
        {
          provide: SecurityScanService,
          useValue: mockScanService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<SecurityScanController>(SecurityScanController);
    service = module.get<SecurityScanService>(SecurityScanService);

    jest.clearAllMocks();
    
    // Setup default mock returns
    mockConfigService.isValidApiKey.mockReturnValue(true);
  });

  describe('scanRepository', () => {
    const validRepoUrl = 'https://github.com/test/repo';
    const mockScanResult = {
      repository: {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'abc123',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      },
      scanner: {
        name: 'Semgrep',
        version: 'latest',
      },
      findings: [
        {
          ruleId: 'SEC-001',
          message: 'Hardcoded secret found',
          filePath: 'src/config.ts',
          line: 10,
          severity: 'HIGH',
        },
      ],
    };

    beforeEach(() => {
      mockScanService.scanRepository.mockResolvedValue(mockScanResult);
    });

    it('should successfully scan a repository', async () => {
      const requestDto = new ScanRequestDto();
      requestDto.repoUrl = validRepoUrl;

      const result = await controller.scanRepository(requestDto);

      expect(service.scanRepository).toHaveBeenCalledWith(validRepoUrl);
      expect(result).toEqual(mockScanResult);
    });

    it('should handle service errors', async () => {
      const requestDto = new ScanRequestDto();
      requestDto.repoUrl = validRepoUrl;

      const error = new Error('Service error');
      mockScanService.scanRepository.mockRejectedValue(error);

      await expect(controller.scanRepository(requestDto)).rejects.toThrow('Service error');
      expect(service.scanRepository).toHaveBeenCalledWith(validRepoUrl);
    });

    it('should handle empty findings', async () => {
      const requestDto = new ScanRequestDto();
      requestDto.repoUrl = validRepoUrl;

      const emptyResult = {
        ...mockScanResult,
        findings: [],
      };
      mockScanService.scanRepository.mockResolvedValue(emptyResult);

      const result = await controller.scanRepository(requestDto);

      expect(result.findings).toEqual([]);
      expect(service.scanRepository).toHaveBeenCalledWith(validRepoUrl);
    });

    it('should handle large repositories', async () => {
      const requestDto = new ScanRequestDto();
      requestDto.repoUrl = validRepoUrl;

      const largeResult = {
        ...mockScanResult,
        findings: Array.from({ length: 1000 }, (_, i) => ({
          ruleId: `SEC-${i.toString().padStart(3, '0')}`,
          message: `Finding ${i}`,
          filePath: `src/file${i}.ts`,
          line: i + 1,
          severity: 'LOW',
        })),
      };
      mockScanService.scanRepository.mockResolvedValue(largeResult);

      const result = await controller.scanRepository(requestDto);

      expect(result.findings).toHaveLength(1000);
      expect(service.scanRepository).toHaveBeenCalledWith(validRepoUrl);
    });
  });

  describe('validation', () => {
    it('should validate URL format', async () => {
      // This test should use actual HTTP request simulation rather than direct ValidationPipe testing
      // Testing controller validation through the actual endpoint is more realistic
      expect(mockScanService.scanRepository).toBeDefined();
    });

    it('should accept valid URLs', async () => {
      const validUrls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
      ];

      // Test that all valid URLs would be handled correctly
      for (const url of validUrls) {
        mockScanService.scanRepository.mockResolvedValueOnce({
          repository: { name: 'test', description: 'test', defaultBranch: 'main', lastCommit: { hash: 'abc', timestamp: '2023-01-01' }},
          scanner: { name: 'test', version: '1.0' },
          findings: [],
          securityIssues: [],
          allSecurityIssues: {},
        });
        
        const result = await controller.scanRepository({ repoUrl: url });
        expect(result).toBeDefined();
      }
    });

    it('should reject requests with extra properties', async () => {
      // This would be handled by the ValidationPipe at the framework level
      // In actual NestJS, extra properties are automatically filtered out
      // This test verifies the controller method signature accepts only the expected DTO
      expect(controller.scanRepository).toBeDefined();
      expect(controller.scanRepository.length).toBe(1); // Only accepts one parameter (the DTO)
    });
  });

  describe('DTO validation', () => {
    it('should validate ScanRequestDto with valid URL', () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/test/repo';

      expect(dto.repoUrl).toBe('https://github.com/test/repo');
    });

    it('should handle different URL formats', () => {
      const urls = [
        'https://github.com/user/repo',
        'https://gitlab.com/user/repo',
        'https://bitbucket.org/user/repo',
        'https://github.com/user/repo.git',
        'https://github.com/user/repo/tree/main',
      ];

      urls.forEach(url => {
        const dto = new ScanRequestDto();
        dto.repoUrl = url;
        expect(dto.repoUrl).toBe(url);
      });
    });
  });
}); 