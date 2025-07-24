import { Test, TestingModule } from '@nestjs/testing';
import { GitHubScmProvider } from './scm-github.provider';
import { RepositoryInfo } from '../interfaces/scm.interface';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('GitHubScmProvider', () => {
  let provider: GitHubScmProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitHubScmProvider],
    }).compile();

    provider = module.get<GitHubScmProvider>(GitHubScmProvider);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct GitHub configuration', () => {
      expect(provider['config']?.name).toBe('GitHub Provider');
      expect(provider['config']?.platform).toBe('github');
      expect(provider['config']?.hostnames).toEqual([
        'github.com',
        'www.github.com',
      ]);
      expect(provider['config']?.apiBaseUrl).toBe('https://api.github.com');
      expect(provider['config']?.supportsPrivateRepos).toBe(true);
      expect(provider['config']?.supportsApi).toBe(true);
      expect(provider['config']?.authentication?.type).toBe('token');
      expect(provider['config']?.rateLimit?.requestsPerHour).toBe(5000);
      expect(provider['config']?.rateLimit?.burstLimit).toBe(100);
    });

    it('should set correct API base URL', () => {
      expect(provider['apiBaseUrl']).toBe('https://api.github.com');
    });
  });

  describe('canHandle', () => {
    it('should handle GitHub.com URLs', () => {
      expect(provider.canHandle('https://github.com/user/repo.git')).toBe(true);
      expect(provider.canHandle('https://github.com/user/repo')).toBe(true);
    });

    it('should handle www.github.com URLs', () => {
      expect(provider.canHandle('https://www.github.com/user/repo.git')).toBe(
        true,
      );
      expect(provider.canHandle('https://www.github.com/user/repo')).toBe(true);
    });

    it('should reject non-GitHub URLs', () => {
      expect(provider.canHandle('https://gitlab.com/user/repo.git')).toBe(
        false,
      );
      expect(provider.canHandle('https://bitbucket.org/user/repo.git')).toBe(
        false,
      );
      expect(provider.canHandle('https://example.com/user/repo.git')).toBe(
        false,
      );
      expect(provider.canHandle('not-a-url')).toBe(false);
    });
  });

  describe('buildApiHeaders', () => {
    it('should build headers without authentication', () => {
      provider['authConfig'] = undefined;
      const headers = (provider as any).buildApiHeaders();

      expect(headers).toEqual({
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Repository-Security-Scanner/1.0',
      });
    });

    it('should build headers with authentication', () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      const headers = (provider as any).buildApiHeaders();

      expect(headers).toEqual({
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Repository-Security-Scanner/1.0',
        Authorization: 'Bearer test-token',
      });
    });
  });

  describe('fetchFromApi', () => {
    const mockRepoInfo: RepositoryInfo = {
      platform: 'github',
      hostname: 'github.com',
      owner: 'testuser',
      repository: 'testrepo',
      fullName: 'testuser/testrepo',
      originalUrl: 'https://github.com/testuser/testrepo.git',
    };

    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return null for non-GitHub repository', async () => {
      const nonGitHubRepo: RepositoryInfo = {
        ...mockRepoInfo,
        platform: 'gitlab',
      };

      const result = await (provider as any).fetchFromApi(nonGitHubRepo);
      expect(result).toBeNull();
    });

    it('should return null for null repository info', async () => {
      const result = await (provider as any).fetchFromApi(null);
      expect(result).toBeNull();
    });

    it('should fetch metadata successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          name: 'testrepo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2023-01-01T00:00:00Z',
          id: 123456,
          node_id: 'MDEwOlJlcG9zaXRvcnkxMjM0NTY=',
          owner: {
            login: 'testuser',
            id: 123,
            type: 'User',
            avatar_url: 'https://avatars.githubusercontent.com/u/123',
            html_url: 'https://github.com/testuser',
          },
          full_name: 'testuser/testrepo',
          private: false,
          html_url: 'https://github.com/testuser/testrepo',
          clone_url: 'https://github.com/testuser/testrepo.git',
          git_url: 'git://github.com/testuser/testrepo.git',
          ssh_url: 'git@github.com:testuser/testrepo.git',
          size: 1024,
          language: 'JavaScript',
          has_issues: true,
          has_projects: true,
          has_wiki: true,
          has_pages: false,
          has_downloads: true,
          archived: false,
          disabled: false,
          open_issues_count: 5,
          license: { name: 'MIT' },
          allow_forking: true,
          is_template: false,
          topics: ['test', 'example'],
          visibility: 'public',
          forks_count: 10,
          stargazers_count: 25,
          created_at: '2023-01-01T00:00:00Z',
          pushed_at: '2023-01-02T00:00:00Z',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toMatchObject({
        name: 'testrepo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: {
          hash: 'latest',
          timestamp: '2023-01-01T00:00:00Z',
        },
        platform: {
          github: {
            id: 123456,
            fullName: 'testuser/testrepo',
            isPrivate: false,
            language: 'JavaScript',
            visibility: 'public',
          },
        },
        common: {
          visibility: 'public',
          forksCount: 10,
          starsCount: 25,
          language: 'JavaScript',
          license: 'MIT',
        },
      });
    });

    it('should handle 401 authentication error', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result).toBeNull();
    });

    it('should handle 403 rate limit error', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result).toBeNull();
    });

    it('should handle 404 repository not found', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result).toBeNull();
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result).toBeNull();
    });

    it('should fetch additional data when authenticated', async () => {
      const mockMainResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          name: 'testrepo',
          description: 'Test repository',
          default_branch: 'main',
          updated_at: '2023-01-01T00:00:00Z',
          id: 123456,
          node_id: 'MDEwOlJlcG9zaXRvcnkxMjM0NTY=',
          owner: {
            login: 'testuser',
            id: 123,
            type: 'User',
            avatar_url: 'https://avatars.githubusercontent.com/u/123',
            html_url: 'https://github.com/testuser',
          },
          full_name: 'testuser/testrepo',
          private: false,
          html_url: 'https://github.com/testuser/testrepo',
          clone_url: 'https://github.com/testuser/testrepo.git',
          git_url: 'git://github.com/testuser/testrepo.git',
          ssh_url: 'git@github.com:testuser/testrepo.git',
          size: 1024,
          language: 'JavaScript',
          has_issues: true,
          has_projects: true,
          has_wiki: true,
          has_pages: false,
          has_downloads: true,
          archived: false,
          disabled: false,
          open_issues_count: 5,
          license: { name: 'MIT' },
          allow_forking: true,
          is_template: false,
          topics: ['test', 'example'],
          visibility: 'public',
          forks_count: 10,
          stargazers_count: 25,
          created_at: '2023-01-01T00:00:00Z',
          pushed_at: '2023-01-02T00:00:00Z',
        }),
      };

      const mockCommitsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            sha: 'abc123',
            commit: {
              message: 'Test commit',
              author: { name: 'Test Author', date: '2023-01-01T00:00:00Z' },
            },
          },
        ]),
      };

      const mockContributorsResponse = {
        ok: true,
        headers: new Map([
          [
            'Link',
            '<https://api.github.com/repos/testuser/testrepo/contributors?page=5>; rel="last"',
          ],
        ]),
        json: jest.fn().mockResolvedValue([]),
      };

      const mockReleasesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          tag_name: 'v1.0.0',
          name: 'Release 1.0.0',
          published_at: '2023-01-01T00:00:00Z',
          prerelease: false,
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockMainResponse as any)
        .mockResolvedValueOnce(mockCommitsResponse as any)
        .mockResolvedValueOnce(mockContributorsResponse as any)
        .mockResolvedValueOnce(mockReleasesResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result).not.toBeNull();
      expect(result?.lastCommit).toMatchObject({
        hash: 'abc123',
        message: 'Test commit',
        author: 'Test Author',
      });

      expect(result?.platform.github.latestRelease).toMatchObject({
        tagName: 'v1.0.0',
        name: 'Release 1.0.0',
        publishedAt: '2023-01-01T00:00:00Z',
        isPrerelease: false,
      });
    });
  });

  describe('fetchAdditionalGitHubData', () => {
    const headers = { Authorization: 'Bearer test-token' };

    it('should fetch additional data successfully', async () => {
      const mockCommitsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            sha: 'abc123',
            commit: {
              message: 'Test commit',
              author: { name: 'Test Author', date: '2023-01-01T00:00:00Z' },
            },
          },
        ]),
      };

      const mockContributorsResponse = {
        ok: true,
        headers: new Map([
          [
            'Link',
            '<https://api.github.com/repos/testuser/testrepo/contributors?page=3>; rel="last"',
          ],
        ]),
        json: jest.fn().mockResolvedValue([]),
      };

      const mockReleasesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          tag_name: 'v1.0.0',
          name: 'Release 1.0.0',
          published_at: '2023-01-01T00:00:00Z',
          prerelease: false,
        }),
      };

      mockFetch
        .mockResolvedValueOnce(mockCommitsResponse as any)
        .mockResolvedValueOnce(mockContributorsResponse as any)
        .mockResolvedValueOnce(mockReleasesResponse as any);

      const result = await (provider as any).fetchAdditionalGitHubData(
        'testuser/testrepo',
        headers,
      );

      expect(result).toMatchObject({
        lastCommitHash: 'abc123',
        lastCommitMessage: 'Test commit',
        lastCommitAuthor: 'Test Author',
        contributorCount: 3,
        latestRelease: {
          tagName: 'v1.0.0',
          name: 'Release 1.0.0',
          publishedAt: '2023-01-01T00:00:00Z',
          isPrerelease: false,
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await (provider as any).fetchAdditionalGitHubData(
        'testuser/testrepo',
        headers,
      );

      expect(result).toEqual({});
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await (provider as any).fetchAdditionalGitHubData(
        'testuser/testrepo',
        headers,
      );

      expect(result).toEqual({});
    });
  });

  describe('getBranches', () => {
    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return branches successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue([
            { name: 'main' },
            { name: 'develop' },
            { name: 'feature/test' },
          ]),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getBranches(
        'https://github.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/branches',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toEqual(['main', 'develop', 'feature/test']);
    });

    it('should return empty array for invalid URL', async () => {
      const result = await provider.getBranches('invalid-url');
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.getBranches(
        'https://github.com/testuser/testrepo',
      );
      expect(result).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getBranches(
        'https://github.com/testuser/testrepo',
      );
      expect(result).toEqual([]);
    });
  });

  describe('getTags', () => {
    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return tags successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue([
            { name: 'v1.0.0' },
            { name: 'v1.1.0' },
            { name: 'v2.0.0' },
          ]),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getTags(
        'https://github.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/tags',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toEqual(['v1.0.0', 'v1.1.0', 'v2.0.0']);
    });

    it('should return empty array for invalid URL', async () => {
      const result = await provider.getTags('invalid-url');
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.getTags(
        'https://github.com/testuser/testrepo',
      );
      expect(result).toEqual([]);
    });
  });

  describe('getContributors', () => {
    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return contributors successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            login: 'user1',
            avatar_url: 'https://avatars.githubusercontent.com/u/1',
            contributions: 50,
            type: 'User',
          },
          {
            login: 'user2',
            avatar_url: 'https://avatars.githubusercontent.com/u/2',
            contributions: 30,
            type: 'Bot',
          },
        ]),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getContributors(
        'https://github.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/testuser/testrepo/contributors',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toEqual([
        {
          name: 'user1',
          username: 'user1',
          avatarUrl: 'https://avatars.githubusercontent.com/u/1',
          contributions: 50,
          type: 'user',
        },
        {
          name: 'user2',
          username: 'user2',
          avatarUrl: 'https://avatars.githubusercontent.com/u/2',
          contributions: 30,
          type: 'bot',
        },
      ]);
    });

    it('should return empty array for invalid URL', async () => {
      const result = await provider.getContributors('invalid-url');
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.getContributors(
        'https://github.com/testuser/testrepo',
      );
      expect(result).toEqual([]);
    });
  });

  describe('searchRepositories', () => {
    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should search repositories successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          items: [
            {
              name: 'repo1',
              full_name: 'user1/repo1',
              description: 'Test repository 1',
              html_url: 'https://github.com/user1/repo1',
              private: false,
              language: 'JavaScript',
              stargazers_count: 100,
              forks_count: 20,
              updated_at: '2023-01-01T00:00:00Z',
            },
            {
              name: 'repo2',
              full_name: 'user2/repo2',
              description: 'Test repository 2',
              html_url: 'https://github.com/user2/repo2',
              private: true,
              language: 'TypeScript',
              stargazers_count: 50,
              forks_count: 10,
              updated_at: '2023-01-02T00:00:00Z',
            },
          ],
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.searchRepositories('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/search/repositories?q=test%20query',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toEqual([
        {
          name: 'repo1',
          fullName: 'user1/repo1',
          description: 'Test repository 1',
          url: 'https://github.com/user1/repo1',
          isPrivate: false,
          language: 'JavaScript',
          stars: 100,
          forks: 20,
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          name: 'repo2',
          fullName: 'user2/repo2',
          description: 'Test repository 2',
          url: 'https://github.com/user2/repo2',
          isPrivate: true,
          language: 'TypeScript',
          stars: 50,
          forks: 10,
          updatedAt: '2023-01-02T00:00:00Z',
        },
      ]);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.searchRepositories('test query');
      expect(result).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.searchRepositories('test query');
      expect(result).toEqual([]);
    });
  });

  describe('getApiStatus', () => {
    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return API status successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          rate: {
            limit: 5000,
            remaining: 4500,
            reset: 1640995200,
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getApiStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/rate_limit',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toMatchObject({
        available: true,
        rateLimit: {
          remaining: 4500,
          total: 5000,
          resetTime: expect.any(String),
        },
        features: [
          'repositories',
          'commits',
          'branches',
          'tags',
          'contributors',
          'search',
        ],
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        error: 'Unable to connect to GitHub API',
      });
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        error: 'Unable to connect to GitHub API',
      });
    });
  });

  describe('validateAuthentication', () => {
    it('should return false when no token is configured', async () => {
      provider['authConfig'] = undefined;
      const result = await provider.validateAuthentication();
      expect(result).toBe(false);
    });

    it('should return true for valid authentication', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockFetch.mockResolvedValue({ ok: true } as any);

      const result = await provider.validateAuthentication();

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/user', {
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      });
      expect(result).toBe(true);
    });

    it('should return false for invalid authentication', async () => {
      provider['authConfig'] = { type: 'token', token: 'invalid-token' };
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.validateAuthentication();
      expect(result).toBe(false);
    });

    it('should handle fetch errors', async () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.validateAuthentication();
      expect(result).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when API is available', async () => {
      const mockResponse = {
        ok: true,
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.healthCheck();

      expect(mockFetch).toHaveBeenCalledWith('https://api.github.com/zen');
      expect(result).toMatchObject({
        isHealthy: true,
        lastChecked: expect.any(String),
      });
      expect(result.apiAvailable).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when API is not available', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.healthCheck();

      expect(result).toMatchObject({
        isHealthy: false,
        lastChecked: expect.any(String),
        error: 'GitHub API returned status 500',
        apiAvailable: false,
        authenticationValid: false,
      });
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.healthCheck();

      expect(result).toMatchObject({
        isHealthy: false,
        lastChecked: expect.any(String),
        error: 'Network error',
        apiAvailable: false,
        authenticationValid: false,
      });
    });
  });
});
