import { Test, TestingModule } from '@nestjs/testing';
import { BitbucketScmProvider } from './scm-bitbucket.provider';

// Mock fetch globally
global.fetch = jest.fn();

describe('BitbucketScmProvider', () => {
  let provider: BitbucketScmProvider;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BitbucketScmProvider],
    }).compile();

    provider = module.get<BitbucketScmProvider>(BitbucketScmProvider);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('canHandle', () => {
    it('should handle Bitbucket URLs', () => {
      expect(provider.canHandle('https://bitbucket.org/user/repo')).toBe(true);
      expect(provider.canHandle('https://bitbucket.org/user/repo.git')).toBe(true);
      expect(provider.canHandle('https://www.bitbucket.org/user/repo')).toBe(true);
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
      const result = provider.parseRepositoryUrl('https://bitbucket.org/atlassian/design-system');
      
      expect(result).toEqual({
        platform: 'bitbucket',
        hostname: 'bitbucket.org',
        owner: 'atlassian',
        repository: 'design-system',
        fullName: 'atlassian/design-system',
        originalUrl: 'https://bitbucket.org/atlassian/design-system'
      });
    });

    it('should parse Bitbucket URLs with .git suffix', () => {
      const result = provider.parseRepositoryUrl('https://bitbucket.org/user/repo.git');
      
      expect(result).toEqual({
        platform: 'bitbucket',
        hostname: 'bitbucket.org',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: 'https://bitbucket.org/user/repo.git'
      });
    });

    it('should return null for invalid URLs', () => {
      expect(provider.parseRepositoryUrl('https://github.com/user/repo')).toBeNull();
      expect(provider.parseRepositoryUrl('https://bitbucket.org/user')).toBeNull();
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
      expect(provider.getSupportedHostnames()).toEqual(['bitbucket.org', 'www.bitbucket.org']);
    });
  });

  describe('fetchRepoMetadata', () => {
    it('should create basic metadata when not authenticated', async () => {
      const result = await provider.fetchRepoMetadata('https://bitbucket.org/atlassian/design-system');
      
      expect(result).toEqual({
        name: 'design-system',
        description: 'Repository metadata unavailable (no API access)',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'unknown',
          timestamp: expect.any(String),
          author: 'unknown',
          message: 'Commit information unavailable'
        },
        common: {
          webUrl: 'https://bitbucket.org/atlassian/design-system'
        }
      });
    });

    it('should handle invalid URLs', async () => {
      await expect(provider.fetchRepoMetadata('invalid-url')).rejects.toThrow('Invalid Bitbucket repository URL');
    });

    it('should fetch metadata from API when authenticated', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockRepoData = {
        name: 'test-repo',
        description: 'Test repository',
        mainbranch: { name: 'main' },
        uuid: 'test-uuid',
        full_name: 'user/test-repo',
        is_private: false,
        language: 'TypeScript',
        size: 1024,
        created_on: '2023-01-01T00:00:00Z',
        updated_on: '2023-12-01T00:00:00Z',
        has_issues: true,
        has_wiki: false,
        links: {
          html: { href: 'https://bitbucket.org/user/test-repo' },
          clone: [
            { name: 'https', href: 'https://bitbucket.org/user/test-repo.git' },
            { name: 'ssh', href: 'git@bitbucket.org:user/test-repo.git' }
          ]
        },
        owner: {
          username: 'testuser',
          display_name: 'Test User',
          type: 'user',
          uuid: 'user-uuid'
        }
      };

      const mockCommitsData = {
        values: [{
          hash: 'abc123',
          date: '2023-12-01T10:00:00Z',
          author: { display_name: 'Test Author' },
          message: 'Test commit message'
        }]
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRepoData,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockCommitsData,
        } as Response);

      const result = await provider.fetchRepoMetadata('https://bitbucket.org/user/test-repo');

      expect(result).toEqual({
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'abc123',
          timestamp: '2023-12-01T10:00:00Z',
          author: 'Test Author',
          message: 'Test commit message'
        },
        platform: {
          bitbucket: {
            id: 'test-uuid',
            fullName: 'user/test-repo',
            isPrivate: false,
            language: 'TypeScript',
            size: 1024,
            createdAt: '2023-01-01T00:00:00Z',
            updatedAt: '2023-12-01T00:00:00Z',
            hasIssues: true,
            hasWiki: false,
            forksCount: 0,
            watchersCount: 0,
            webUrl: 'https://bitbucket.org/user/test-repo',
            cloneUrl: 'https://bitbucket.org/user/test-repo.git',
            sshUrl: 'git@bitbucket.org:user/test-repo.git',
            owner: {
              username: 'testuser',
              displayName: 'Test User',
              type: 'user',
              uuid: 'user-uuid'
            }
          }
        },
        common: {
          language: 'TypeScript',
          size: 1024,
          visibility: 'public',
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-12-01T00:00:00Z',
          webUrl: 'https://bitbucket.org/user/test-repo'
        }
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://api.bitbucket.org/2.0/repositories/user/test-repo', {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Repository-Security-Scanner/1.0',
          'Authorization': 'Bearer test-token'
        }
      });
    });

    it('should handle API authentication errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'invalid-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await provider.fetchRepoMetadata('https://bitbucket.org/user/test-repo');

      expect(result).toEqual({
        name: 'test-repo',
        description: 'Repository metadata unavailable (no API access)',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'unknown',
          timestamp: expect.any(String),
          author: 'unknown',
          message: 'Commit information unavailable'
        },
        common: {
          webUrl: 'https://bitbucket.org/user/test-repo'
        }
      });
    });

    it('should handle API 404 errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await provider.fetchRepoMetadata('https://bitbucket.org/user/nonexistent');

      expect(result).toEqual({
        name: 'nonexistent',
        description: 'Repository metadata unavailable (no API access)',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'unknown',
          timestamp: expect.any(String),
          author: 'unknown',
          message: 'Commit information unavailable'
        },
        common: {
          webUrl: 'https://bitbucket.org/user/nonexistent'
        }
      });
    });

    it('should handle commits API failure gracefully', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockRepoData = {
        name: 'test-repo',
        description: 'Test repository',
        mainbranch: { name: 'main' },
        uuid: 'test-uuid',
        full_name: 'user/test-repo',
        is_private: false,
        language: 'TypeScript',
        size: 1024,
        created_on: '2023-01-01T00:00:00Z',
        updated_on: '2023-12-01T00:00:00Z',
        has_issues: true,
        has_wiki: false,
        links: {
          html: { href: 'https://bitbucket.org/user/test-repo' },
          clone: [
            { name: 'https', href: 'https://bitbucket.org/user/test-repo.git' }
          ]
        },
        owner: {
          username: 'testuser',
          display_name: 'Test User',
          type: 'user',
          uuid: 'user-uuid'
        }
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRepoData,
        } as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        } as Response);

      const result = await provider.fetchRepoMetadata('https://bitbucket.org/user/test-repo');

      expect(result.lastCommit).toEqual({
        hash: 'unknown',
        timestamp: expect.any(String),
        author: 'unknown',
        message: 'Unknown commit'
      });
    });
  });

  describe('getBranches', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.getBranches('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });

    it('should fetch branches when authenticated', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockBranchesData = {
        values: [
          { name: 'main' },
          { name: 'develop' },
          { name: 'feature/test' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockBranchesData,
      } as Response);

      const result = await provider.getBranches('https://bitbucket.org/user/repo');

      expect(result).toEqual(['main', 'develop', 'feature/test']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bitbucket.org/2.0/repositories/user/repo/refs/branches',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should handle branches API errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      const result = await provider.getBranches('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });

    it('should handle fetch errors for branches', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.getBranches('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });
  });

  describe('getTags', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.getTags('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });

    it('should fetch tags when authenticated', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockTagsData = {
        values: [
          { name: 'v1.0.0' },
          { name: 'v1.1.0' },
          { name: 'v2.0.0' }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTagsData,
      } as Response);

      const result = await provider.getTags('https://bitbucket.org/user/repo');

      expect(result).toEqual(['v1.0.0', 'v1.1.0', 'v2.0.0']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bitbucket.org/2.0/repositories/user/repo/refs/tags',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should handle tags API errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      const result = await provider.getTags('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });

    it('should handle fetch errors for tags', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.getTags('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });
  });

  describe('getContributors', () => {
    it('should return empty array (not supported by Bitbucket API v2.0)', async () => {
      const result = await provider.getContributors('https://bitbucket.org/user/repo');
      expect(result).toEqual([]);
    });
  });

  describe('searchRepositories', () => {
    it('should return empty array when not authenticated', async () => {
      const result = await provider.searchRepositories('test');
      expect(result).toEqual([]);
    });

    it('should search repositories when authenticated', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockSearchData = {
        values: [
          {
            name: 'test-repo',
            full_name: 'user/test-repo',
            description: 'A test repository',
            links: { html: { href: 'https://bitbucket.org/user/test-repo' } },
            language: 'JavaScript',
            is_private: false,
            updated_on: '2023-12-01T00:00:00Z'
          },
          {
            name: 'another-test',
            full_name: 'user/another-test',
            description: '',
            links: { html: { href: 'https://bitbucket.org/user/another-test' } },
            language: 'Python',
            is_private: true,
            updated_on: '2023-11-01T00:00:00Z'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchData,
      } as Response);

      const result = await provider.searchRepositories('test');

      expect(result).toEqual([
        {
          name: 'test-repo',
          fullName: 'user/test-repo',
          description: 'A test repository',
          url: 'https://bitbucket.org/user/test-repo',
          language: 'JavaScript',
          stars: 0,
          forks: 0,
          isPrivate: false,
          updatedAt: '2023-12-01T00:00:00Z'
        },
        {
          name: 'another-test',
          fullName: 'user/another-test',
          description: '',
          url: 'https://bitbucket.org/user/another-test',
          language: 'Python',
          stars: 0,
          forks: 0,
          isPrivate: true,
          updatedAt: '2023-11-01T00:00:00Z'
        }
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bitbucket.org/2.0/repositories?q=name~"test"',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should handle search API errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      const result = await provider.searchRepositories('test');
      expect(result).toEqual([]);
    });

    it('should handle search fetch errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.searchRepositories('test');
      expect(result).toEqual([]);
    });
  });

  describe('getApiStatus', () => {
    it('should return API status when available', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      const mockHeaders = new Headers();
      mockHeaders.set('X-RateLimit-Remaining', '950');
      mockHeaders.set('X-RateLimit-Limit', '1000');
      mockHeaders.set('X-RateLimit-Reset', '2023-12-01T12:00:00Z');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
      } as Response);

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: true,
        rateLimit: {
          remaining: 950,
          total: 1000,
          resetTime: '2023-12-01T12:00:00Z'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.bitbucket.org/2.0/user',
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should return unavailable status on API error', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      } as Response);

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        rateLimit: {
          remaining: 0,
          total: 1000,
          resetTime: expect.any(String)
        }
      });
    });

    it('should handle fetch errors', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        error: 'Network error'
      });
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const result = await provider.healthCheck();
      
      expect(result).toEqual(expect.objectContaining({
        isHealthy: expect.any(Boolean),
        responseTime: expect.any(Number),
        lastChecked: expect.any(String),
        apiAvailable: expect.any(Boolean),
        authenticationValid: expect.any(Boolean)
      }));

      // Error property is optional
      if (result.error) {
        expect(result.error).toEqual(expect.any(String));
      }
    });

    it('should return healthy status when API is available', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
      } as Response);

      const result = await provider.healthCheck();

      expect(result.isHealthy).toBe(true);
      expect(result.apiAvailable).toBe(true);
      expect(result.authenticationValid).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status on API failure', async () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      mockFetch.mockRejectedValueOnce(new Error('API down'));

      const result = await provider.healthCheck();

      expect(result.isHealthy).toBe(false);
      expect(result.apiAvailable).toBe(false);
      expect(result.authenticationValid).toBe(false);
      // Note: error is handled by getApiStatus internally, not propagated to healthCheck
    });
  });

  describe('authentication', () => {
    it('should configure authentication', () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      expect(provider.isAuthenticated()).toBe(true);
    });

    it('should handle authentication removal', () => {
      provider.configureAuthentication({
        type: 'none'
      });

      expect(provider.isAuthenticated()).toBe(false);
    });

    it('should build correct API headers when authenticated', () => {
      provider.configureAuthentication({
        type: 'token',
        token: 'test-token'
      });

      // Test that headers are built correctly by checking a method that uses them
      provider.getBranches('https://bitbucket.org/user/repo');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0',
            'Authorization': 'Bearer test-token'
          }
        }
      );
    });

    it('should build headers without auth when not authenticated', () => {
      provider.configureAuthentication({
        type: 'none'
      });

      // Since getBranches returns early when not authenticated, 
      // we test via healthCheck which always calls getApiStatus
      provider.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Repository-Security-Scanner/1.0'
          }
        }
      );
    });
  });
}) 