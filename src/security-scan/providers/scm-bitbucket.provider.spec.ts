import { Test, TestingModule } from '@nestjs/testing';
import { BitbucketScmProvider } from './scm-bitbucket.provider';

describe('BitbucketScmProvider', () => {
  let provider: BitbucketScmProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitbucketScmProvider],
    }).compile();

    provider = module.get<BitbucketScmProvider>(BitbucketScmProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('canHandle', () => {
    it('should handle Bitbucket URLs', () => {
      expect(provider.canHandle('https://bitbucket.org/user/repo')).toBe(true);
      expect(provider.canHandle('https://bitbucket.org/user/repo.git')).toBe(
        true,
      );
      expect(provider.canHandle('https://www.bitbucket.org/user/repo')).toBe(
        true,
      );
    });

    it('should not handle non-Bitbucket URLs', () => {
      expect(provider.canHandle('https://github.com/user/repo')).toBe(false);
      expect(provider.canHandle('https://gitlab.com/user/repo')).toBe(false);
      expect(provider.canHandle('https://example.com/user/repo')).toBe(false);
      expect(provider.canHandle('not-a-url')).toBe(false);
    });
  });

  describe('parseRepositoryUrl', () => {
    it('should parse valid Bitbucket URLs', () => {
      const result = provider.parseRepositoryUrl(
        'https://bitbucket.org/atlassian/design-system',
      );

      expect(result).toEqual({
        platform: 'bitbucket',
        hostname: 'bitbucket.org',
        owner: 'atlassian',
        repository: 'design-system',
        fullName: 'atlassian/design-system',
        originalUrl: 'https://bitbucket.org/atlassian/design-system',
      });
    });

    it('should parse Bitbucket URLs with .git suffix', () => {
      const result = provider.parseRepositoryUrl(
        'https://bitbucket.org/user/repo.git',
      );

      expect(result).toEqual({
        platform: 'bitbucket',
        hostname: 'bitbucket.org',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'https://bitbucket.org/user/repo.git',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(
        provider.parseRepositoryUrl('https://github.com/user/repo'),
      ).toBeNull();
      expect(
        provider.parseRepositoryUrl('https://bitbucket.org/user'),
      ).toBeNull();
      expect(provider.parseRepositoryUrl('not-a-url')).toBeNull();
    });
  });

  describe('getConfig', () => {
    it('should return correct configuration', () => {
      const config = provider.getConfig();

      expect(config.name).toBe('Bitbucket Provider');
      expect(config.platform).toBe('bitbucket');
      expect(config.hostnames).toEqual(['bitbucket.org', 'www.bitbucket.org']);
      expect(config.apiBaseUrl).toBe('https://api.bitbucket.org/2.0');
      expect(config.supportsPrivateRepos).toBe(true);
      expect(config.supportsApi).toBe(true);
    });
  });

  describe('getName', () => {
    it('should return provider name', () => {
      expect(provider.getName()).toBe('Bitbucket Provider');
    });
  });

  describe('getPlatform', () => {
    it('should return bitbucket platform', () => {
      expect(provider.getPlatform()).toBe('bitbucket');
    });
  });

  describe('getSupportedHostnames', () => {
    it('should return supported hostnames', () => {
      expect(provider.getSupportedHostnames()).toEqual([
        'bitbucket.org',
        'www.bitbucket.org',
      ]);
    });
  });

  describe('fetchRepoMetadata', () => {
    it('should create basic metadata when not authenticated', async () => {
      const result = await provider.fetchRepoMetadata(
        'https://bitbucket.org/atlassian/design-system',
      );

      expect(result).toEqual({
        name: 'design-system',
        description: 'Repository metadata unavailable (no API access)',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'unknown',
          timestamp: expect.any(String),
          author: 'unknown',
          message: 'Commit information unavailable',
        },
        common: {
          webUrl: 'https://bitbucket.org/atlassian/design-system',
        },
      });
    });

    it('should handle invalid URLs', async () => {
      await expect(provider.fetchRepoMetadata('invalid-url')).rejects.toThrow(
        'Invalid Bitbucket repository URL',
      );
    });
  });

  describe('getBranches', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.getBranches(
        'https://bitbucket.org/user/repo',
      );
      expect(result).toEqual([]);
    });
  });

  describe('getTags', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.getTags('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });
  });

  describe('getContributors', () => {
    it('should return empty array (not supported by Bitbucket API v2.0)', async () => {
      const result = await provider.getContributors(
        'https://bitbucket.org/user/repo',
      );
      expect(result).toEqual([]);
    });
  });

  describe('searchRepositories', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.searchRepositories('test');
      expect(result).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await provider.healthCheck();

      expect(result).toEqual(
        expect.objectContaining({
          isHealthy: expect.any(Boolean),
          responseTime: expect.any(Number),
          lastChecked: expect.any(String),
          apiAvailable: expect.any(Boolean),
          authenticationValid: expect.any(Boolean),
        }),
      );

      // Error property is optional
      if (result.error) {
        expect(result.error).toEqual(expect.any(String));
      }
    });
  });

  describe('authentication', () => {
    it('should configure authentication', () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token',
      });

      expect(provider.isAuthenticated()).toBe(true);
    });

    it('should handle authentication removal', () => {
      provider.configureAuthentication({
        type: 'none',
      });

      expect(provider.isAuthenticated()).toBe(false);
    });
  });
});
