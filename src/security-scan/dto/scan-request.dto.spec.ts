import { validate } from 'class-validator';
import { ScanRequestDto } from './scan-request.dto';

describe('ScanRequestDto', () => {
  describe('validation', () => {
    it('should validate with valid GitHub URL', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid GitLab URL', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://gitlab.com/user/repo';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with valid Bitbucket URL', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://bitbucket.org/user/repo';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with URL ending in .git', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo.git';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with URL containing subdirectories', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo/tree/main';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with URL containing query parameters', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo?ref=main';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with URL containing fragments', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo#readme';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject invalid URL format', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'not-a-valid-url';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });

    it('should reject empty string', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });

    it('should reject null value', async () => {
      const dto = new ScanRequestDto();
      (dto as any).repoUrl = null;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should reject undefined value', async () => {
      const dto = new ScanRequestDto();
      (dto as any).repoUrl = undefined;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should reject non-string values', async () => {
      const dto = new ScanRequestDto();
      (dto as any).repoUrl = 123;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isString).toBeDefined();
    });

    it('should reject URLs without protocol', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'github.com/user/repo';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });

    it('should reject URLs with invalid protocol', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'ftp://github.com/user/repo';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });

    it('should reject URLs with spaces', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo with spaces';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });

    it('should reject URLs with special characters', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo<script>alert("xss")</script>';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isUrl).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long URLs', async () => {
      const longUrl = 'https://github.com/user/repo'.padEnd(2000, '/path');
      const dto = new ScanRequestDto();
      dto.repoUrl = longUrl;

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle URLs with unicode characters', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/répô';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle URLs with numbers in path', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user/repo123';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should handle URLs with underscores and hyphens', async () => {
      const dto = new ScanRequestDto();
      dto.repoUrl = 'https://github.com/user-name/repo_name';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('property access', () => {
    it('should allow setting and getting repoUrl', () => {
      const dto = new ScanRequestDto();
      const testUrl = 'https://github.com/test/repo';
      
      dto.repoUrl = testUrl;
      expect(dto.repoUrl).toBe(testUrl);
    });

    it('should handle multiple assignments', () => {
      const dto = new ScanRequestDto();
      
      dto.repoUrl = 'https://github.com/repo1';
      expect(dto.repoUrl).toBe('https://github.com/repo1');
      
      dto.repoUrl = 'https://github.com/repo2';
      expect(dto.repoUrl).toBe('https://github.com/repo2');
    });
  });

  describe('instance creation', () => {
    it('should create instance with default values', () => {
      const dto = new ScanRequestDto();
      expect(dto).toBeInstanceOf(ScanRequestDto);
      expect(dto.repoUrl).toBeUndefined();
    });

    it('should create multiple independent instances', () => {
      const dto1 = new ScanRequestDto();
      const dto2 = new ScanRequestDto();
      
      dto1.repoUrl = 'https://github.com/repo1';
      dto2.repoUrl = 'https://github.com/repo2';
      
      expect(dto1.repoUrl).toBe('https://github.com/repo1');
      expect(dto2.repoUrl).toBe('https://github.com/repo2');
    });
  });
}); 