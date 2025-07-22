import { Test, TestingModule } from '@nestjs/testing';
import { SecurityScanController } from './security-scan.controller';
import { SecurityScanService } from './security-scan.service';
import { ValidationPipe } from '@nestjs/common';
import { ScanRequestDto } from './dto/scan-request.dto';

describe('SecurityScanController', () => {
  let controller: SecurityScanController;
  let service: SecurityScanService;

  const mockScanService = {
    scanRepository: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SecurityScanController],
      providers: [
        {
          provide: SecurityScanService,
          useValue: mockScanService,
        },
      ],
    }).compile();

    controller = module.get<SecurityScanController>(SecurityScanController);
    service = module.get<SecurityScanService>(SecurityScanService);

    jest.clearAllMocks();
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
      const validationPipe = new ValidationPipe({ 
        whitelist: true, 
        forbidNonWhitelisted: true 
      });

      const invalidRequest = {
        repoUrl: 'not-a-valid-url',
      };

      await expect(
        validationPipe.transform(invalidRequest, { type: 'body' } as any)
      ).rejects.toThrow();
    });

    it('should accept valid URLs', async () => {
      const validationPipe = new ValidationPipe({ 
        whitelist: true, 
        forbidNonWhitelisted: true 
      });

      const validRequest = {
        repoUrl: 'https://github.com/user/repo',
      };

      const result = await validationPipe.transform(validRequest, { type: 'body' } as any);
      expect(result.repoUrl).toBe('https://github.com/user/repo');
    });

    it('should reject requests with extra properties', async () => {
      const validationPipe = new ValidationPipe({ 
        whitelist: true, 
        forbidNonWhitelisted: true 
      });

      const requestWithExtraProps = {
        repoUrl: 'https://github.com/user/repo',
        extraProp: 'should-be-rejected',
      };

      await expect(
        validationPipe.transform(requestWithExtraProps, { type: 'body' } as any)
      ).rejects.toThrow();
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