import { Test, TestingModule } from '@nestjs/testing';
import { GitLabScmProvider } from './scm-gitlab.provider';
import { RepositoryInfo } from '../interfaces/scm.interface';

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('GitLabScmProvider', () => {
  let provider: GitLabScmProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GitLabScmProvider],
    }).compile();

    provider = module.get<GitLabScmProvider>(GitLabScmProvider);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct GitLab configuration', () => {
      expect(provider['config']?.name).toBe('GitLab Provider');
      expect(provider['config']?.platform).toBe('gitlab');
      expect(provider['config']?.hostnames).toEqual([
        'gitlab.com',
        'www.gitlab.com',
        'gitlab.',
      ]);
      expect(provider['config']?.apiBaseUrl).toBe('https://gitlab.com/api/v4');
      expect(provider['config']?.supportsPrivateRepos).toBe(true);
      expect(provider['config']?.supportsApi).toBe(true);
      expect(provider['config']?.authentication?.type).toBe('token');
      expect(provider['config']?.rateLimit?.requestsPerHour).toBe(2000);
      expect(provider['config']?.rateLimit?.burstLimit).toBe(50);
    });
  });

  describe('canHandle', () => {
    it('should handle GitLab.com URLs', () => {
      expect(provider.canHandle('https://gitlab.com/user/repo.git')).toBe(true);
      expect(provider.canHandle('https://gitlab.com/user/repo')).toBe(true);
    });

    it('should handle www.gitlab.com URLs', () => {
      expect(provider.canHandle('https://www.gitlab.com/user/repo.git')).toBe(
        true,
      );
      expect(provider.canHandle('https://www.gitlab.com/user/repo')).toBe(true);
    });

    it('should handle GitLab subdomain URLs', () => {
      expect(
        provider.canHandle('https://gitlab.example.com/user/repo.git'),
      ).toBe(true);
      expect(
        provider.canHandle('https://gitlab.company.org/user/repo.git'),
      ).toBe(true);
    });

    it('should reject non-GitLab URLs', () => {
      expect(provider.canHandle('https://github.com/user/repo.git')).toBe(
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

  describe('getApiBaseUrl', () => {
    it('should return default API URL for gitlab.com', () => {
      const result = (provider as any).getApiBaseUrl('gitlab.com');
      expect(result).toBe('https://gitlab.com/api/v4');
    });

    it('should return default API URL for undefined hostname', () => {
      const result = (provider as any).getApiBaseUrl();
      expect(result).toBe('https://gitlab.com/api/v4');
    });

    it('should return custom API URL for subdomain', () => {
      const result = (provider as any).getApiBaseUrl('gitlab.example.com');
      expect(result).toBe('https://gitlab.example.com/api/v4');
    });
  });

  describe('buildApiHeaders', () => {
    it('should build headers without authentication', () => {
      provider['authConfig'] = undefined;
      const headers = (provider as any).buildApiHeaders();

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'Repository-Security-Scanner/1.0',
      });
    });

    it('should build headers with authentication', () => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
      const headers = (provider as any).buildApiHeaders();

      expect(headers).toEqual({
        'Content-Type': 'application/json',
        'User-Agent': 'Repository-Security-Scanner/1.0',
        Authorization: 'Bearer test-token',
      });
    });
  });

  describe('fetchFromApi', () => {
    const mockRepoInfo: RepositoryInfo = {
      platform: 'gitlab',
      hostname: 'gitlab.com',
      owner: 'testuser',
      repository: 'testrepo',
      fullName: 'testuser/testrepo',
      originalUrl: 'https://gitlab.com/testuser/testrepo.git',
    };

    beforeEach(() => {
      provider['authConfig'] = { type: 'token', token: 'test-token' };
    });

    it('should return null for non-GitLab repository', async () => {
      const nonGitLabRepo: RepositoryInfo = {
        ...mockRepoInfo,
        platform: 'github',
      };

      const result = await (provider as any).fetchFromApi(nonGitLabRepo);
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
          id: 123456,
          name: 'testrepo',
          path: 'testrepo',
          path_with_namespace: 'testuser/testrepo',
          description: 'Test repository',
          default_branch: 'main',
          last_activity_at: '2023-01-01T00:00:00Z',
          namespace: {
            id: 123,
            name: 'testuser',
            path: 'testuser',
            kind: 'user',
            full_path: 'testuser',
          },
          visibility: 'public',
          forks_count: 10,
          star_count: 25,
          issues_enabled: true,
          merge_requests_enabled: true,
          wiki_enabled: true,
          snippets_enabled: false,
          container_registry_enabled: true,
          packages_enabled: true,
          security_and_compliance_access_level: 'enabled',
          analytics_access_level: 'enabled',
          builds_enabled: true,
          web_url: 'https://gitlab.com/testuser/testrepo',
          ssh_url_to_repo: 'git@gitlab.com:testuser/testrepo.git',
          http_url_to_repo: 'https://gitlab.com/testuser/testrepo.git',
          readme_url:
            'https://gitlab.com/testuser/testrepo/-/blob/main/README.md',
          avatar_url: null,
          topics: ['test', 'example'],
          created_at: '2023-01-01T00:00:00Z',
          archived: false,
          open_issues_count: 5,
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/testuser%2Ftestrepo',
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
          gitlab: {
            id: 123456,
            name: 'testrepo',
            path: 'testrepo',
            pathWithNamespace: 'testuser/testrepo',
            visibility: 'public',
            forksCount: 10,
            starsCount: 25,
            issuesEnabled: true,
            mergeRequestsEnabled: true,
            wikiEnabled: true,
            snippetsEnabled: false,
            containerRegistryEnabled: true,
            packagesEnabled: true,
            securityAndComplianceEnabled: true,
            analyticsEnabled: true,
            buildsEnabled: true,
            webUrl: 'https://gitlab.com/testuser/testrepo',
            sshUrlToRepo: 'git@gitlab.com:testuser/testrepo.git',
            httpUrlToRepo: 'https://gitlab.com/testuser/testrepo.git',
            readmeUrl:
              'https://gitlab.com/testuser/testrepo/-/blob/main/README.md',
            topics: ['test', 'example'],
            createdAt: '2023-01-01T00:00:00Z',
            lastActivityAt: '2023-01-01T00:00:00Z',
          },
        },
        common: {
          visibility: 'public',
          forksCount: 10,
          starsCount: 25,
          issuesCount: 5,
          topics: ['test', 'example'],
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z',
          pushedAt: '2023-01-01T00:00:00Z',
          webUrl: 'https://gitlab.com/testuser/testrepo',
          cloneUrl: 'https://gitlab.com/testuser/testrepo.git',
          sshUrl: 'git@gitlab.com:testuser/testrepo.git',
          archived: false,
          disabled: false,
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

    it('should handle 403 access forbidden error', async () => {
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
          id: 123456,
          name: 'testrepo',
          path_with_namespace: 'testuser/testrepo',
          description: 'Test repository',
          default_branch: 'main',
          last_activity_at: '2023-01-01T00:00:00Z',
          visibility: 'public',
          forks_count: 10,
          star_count: 25,
          created_at: '2023-01-01T00:00:00Z',
          archived: false,
          open_issues_count: 5,
        }),
      };

      const mockCommitsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 'abc123',
            message: 'Test commit',
            author_name: 'Test Author',
            committed_date: '2023-01-01T00:00:00Z',
          },
        ]),
      };

      const mockContributorsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            name: 'User 1',
            email: 'user1@example.com',
            commits: 50,
            additions: 1000,
            deletions: 100,
          },
          {
            name: 'User 2',
            email: 'user2@example.com',
            commits: 30,
            additions: 500,
            deletions: 50,
          },
        ]),
      };

      const mockLanguagesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          JavaScript: 60,
          TypeScript: 30,
          CSS: 10,
        }),
      };

      const mockMergeRequestsResponse = {
        ok: true,
        headers: new Map([['X-Total', '5']]),
      };

      const mockPipelinesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 123,
            status: 'success',
            ref: 'main',
            sha: 'abc123',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T01:00:00Z',
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(mockMainResponse as any)
        .mockResolvedValueOnce(mockCommitsResponse as any)
        .mockResolvedValueOnce(mockContributorsResponse as any)
        .mockResolvedValueOnce(mockLanguagesResponse as any)
        .mockResolvedValueOnce(mockMergeRequestsResponse as any)
        .mockResolvedValueOnce(mockPipelinesResponse as any);

      const result = await (provider as any).fetchFromApi(mockRepoInfo);

      expect(result.lastCommit).toMatchObject({
        hash: 'abc123',
        message: 'Test commit',
        author: 'Test Author',
      });

      expect(result.platform.gitlab.topContributors).toHaveLength(2);
      expect(result.platform.gitlab.mainLanguage).toBe('JavaScript');
      expect(result.platform.gitlab.openMergeRequestsCount).toBe(5);
      expect(result.platform.gitlab.latestPipeline).toMatchObject({
        id: 123,
        status: 'success',
        ref: 'main',
        sha: 'abc123',
      });
    });
  });

  describe('fetchAdditionalGitLabData', () => {
    const headers = { Authorization: 'Bearer test-token' };
    const apiBaseUrl = 'https://gitlab.com/api/v4';
    const projectPath = 'testuser%2Ftestrepo';

    it('should fetch additional data successfully', async () => {
      const mockCommitsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 'abc123',
            message: 'Test commit',
            author_name: 'Test Author',
            committed_date: '2023-01-01T00:00:00Z',
          },
        ]),
      };

      const mockContributorsResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            name: 'User 1',
            email: 'user1@example.com',
            commits: 50,
            additions: 1000,
            deletions: 100,
          },
          {
            name: 'User 2',
            email: 'user2@example.com',
            commits: 30,
            additions: 500,
            deletions: 50,
          },
        ]),
      };

      const mockLanguagesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          JavaScript: 60,
          TypeScript: 30,
          CSS: 10,
        }),
      };

      const mockMergeRequestsResponse = {
        ok: true,
        headers: new Map([['X-Total', '5']]),
      };

      const mockPipelinesResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue([
          {
            id: 123,
            status: 'success',
            ref: 'main',
            sha: 'abc123',
            created_at: '2023-01-01T00:00:00Z',
            updated_at: '2023-01-01T01:00:00Z',
          },
        ]),
      };

      mockFetch
        .mockResolvedValueOnce(mockCommitsResponse as any)
        .mockResolvedValueOnce(mockContributorsResponse as any)
        .mockResolvedValueOnce(mockLanguagesResponse as any)
        .mockResolvedValueOnce(mockMergeRequestsResponse as any)
        .mockResolvedValueOnce(mockPipelinesResponse as any);

      const result = await (provider as any).fetchAdditionalGitLabData(
        apiBaseUrl,
        projectPath,
        headers,
      );

      expect(result).toMatchObject({
        lastCommitHash: 'abc123',
        lastCommitMessage: 'Test commit',
        lastCommitAuthor: 'Test Author',
        lastCommitDate: '2023-01-01T00:00:00Z',
        contributorCount: 2,
        mainLanguage: 'JavaScript',
        languages: {
          JavaScript: 60,
          TypeScript: 30,
          CSS: 10,
        },
        openMergeRequestsCount: 5,
        latestPipeline: {
          id: 123,
          status: 'success',
          ref: 'main',
          sha: 'abc123',
        },
      });
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await (provider as any).fetchAdditionalGitLabData(
        apiBaseUrl,
        projectPath,
        headers,
      );
      expect(result).toEqual({});
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await (provider as any).fetchAdditionalGitLabData(
        apiBaseUrl,
        projectPath,
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
        'https://gitlab.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/testuser%2Ftestrepo/repository/branches',
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
        'https://gitlab.com/testuser/testrepo',
      );
      expect(result).toEqual([]);
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getBranches(
        'https://gitlab.com/testuser/testrepo',
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
        'https://gitlab.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/testuser%2Ftestrepo/repository/tags',
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
        'https://gitlab.com/testuser/testrepo',
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
            name: 'User 1',
            email: 'user1@example.com',
            commits: 50,
            additions: 1000,
            deletions: 100,
          },
          {
            name: 'User 2',
            email: 'user2@example.com',
            commits: 30,
            additions: 500,
            deletions: 50,
          },
        ]),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getContributors(
        'https://gitlab.com/testuser/testrepo',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects/testuser%2Ftestrepo/repository/contributors',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toEqual([
        {
          name: 'User 1',
          email: 'user1@example.com',
          contributions: 50,
          type: 'user',
        },
        {
          name: 'User 2',
          email: 'user2@example.com',
          contributions: 30,
          type: 'user',
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
        'https://gitlab.com/testuser/testrepo',
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
        json: jest.fn().mockResolvedValue([
          {
            name: 'repo1',
            path_with_namespace: 'user1/repo1',
            description: 'Test repository 1',
            web_url: 'https://gitlab.com/user1/repo1',
            visibility: 'public',
            star_count: 100,
            forks_count: 20,
            last_activity_at: '2023-01-01T00:00:00Z',
          },
          {
            name: 'repo2',
            path_with_namespace: 'user2/repo2',
            description: 'Test repository 2',
            web_url: 'https://gitlab.com/user2/repo2',
            visibility: 'private',
            star_count: 50,
            forks_count: 10,
            last_activity_at: '2023-01-02T00:00:00Z',
          },
        ]),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.searchRepositories('test query');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/projects?search=test%20query&visibility=public',
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
          url: 'https://gitlab.com/user1/repo1',
          isPrivate: false,
          language: '',
          stars: 100,
          forks: 20,
          updatedAt: '2023-01-01T00:00:00Z',
        },
        {
          name: 'repo2',
          fullName: 'user2/repo2',
          description: 'Test repository 2',
          url: 'https://gitlab.com/user2/repo2',
          isPrivate: true,
          language: '',
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
          version: '15.0.0',
          revision: 'abc123',
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await provider.getApiStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/version',
        {
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        },
      );

      expect(result).toMatchObject({
        available: true,
        version: '15.0.0',
        features: [
          'repositories',
          'commits',
          'branches',
          'tags',
          'contributors',
          'merge_requests',
          'pipelines',
        ],
      });
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({ ok: false } as any);

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        error: 'Unable to connect to GitLab API',
      });
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getApiStatus();

      expect(result).toEqual({
        available: false,
        error: 'Unable to connect to GitLab API',
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

      expect(mockFetch).toHaveBeenCalledWith('https://gitlab.com/api/v4/user', {
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

      expect(mockFetch).toHaveBeenCalledWith(
        'https://gitlab.com/api/v4/version',
      );
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
        error: 'GitLab API returned status 500',
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
