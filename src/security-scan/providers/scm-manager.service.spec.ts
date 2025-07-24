import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ScmManagerService } from './scm-manager.service';
import { ScmProviderRegistryService } from './scm-provider.registry';
import { 
  ScmProvider, 
  RepositoryMetadata, 
  ChangeDetectionResult, 
  CloneOptions,
  ScmAuthConfig,
  ProviderHealthStatus,
  RepositoryInfo,
  ScmPlatform
} from '../interfaces/scm.interface';

describe('ScmManagerService', () => {
  let service: ScmManagerService;
  let mockProviderRegistry: jest.Mocked<ScmProviderRegistryService>;
  let mockProvider: jest.Mocked<ScmProvider>;

  beforeEach(async () => {
    mockProvider = {
      getConfig: jest.fn().mockReturnValue({
        name: 'TestProvider',
        platform: 'github',
        hostnames: ['github.com'],
        supportsPrivateRepos: true,
        supportsApi: true,
      }),
      getName: jest.fn().mockReturnValue('TestProvider'),
      getPlatform: jest.fn().mockReturnValue('github'),
      getSupportedHostnames: jest.fn().mockReturnValue(['github.com']),
      canHandle: jest.fn().mockReturnValue(true),
      parseRepositoryUrl: jest.fn(),
      normalizeRepositoryUrl: jest.fn().mockReturnValue('https://github.com/user/repo.git'),
      configureAuthentication: jest.fn(),
      isAuthenticated: jest.fn().mockReturnValue(false),
      validateAuthentication: jest.fn().mockResolvedValue(true),
      cloneRepository: jest.fn(),
      fetchRepoMetadata: jest.fn(),
      getLastCommitHash: jest.fn(),
      hasChangesSince: jest.fn(),
      getBranches: jest.fn(),
      getTags: jest.fn(),
      getContributors: jest.fn(),
      healthCheck: jest.fn(),
    };

    mockProviderRegistry = {
      registerProvider: jest.fn(),
      unregisterProvider: jest.fn(),
      getProvider: jest.fn(),
      getProviderForUrl: jest.fn(),
      getAllProviders: jest.fn(),
      getAvailableProviders: jest.fn(),
      getProvidersByPlatform: jest.fn(),
      getProviderRecommendations: jest.fn(),
      getRegistryStats: jest.fn(),
      performHealthChecks: jest.fn(),
      getSupportedPlatforms: jest.fn(),
      isPlatformSupported: jest.fn(),
      isHostnameSupported: jest.fn(),
      clearAllProviders: jest.fn(),
    } as unknown as jest.Mocked<ScmProviderRegistryService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScmManagerService,
        {
          provide: ScmProviderRegistryService,
          useValue: mockProviderRegistry,
        },
      ],
    }).compile();

    service = module.get<ScmManagerService>(ScmManagerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize and log provider status', async () => {
      mockProviderRegistry.getRegistryStats.mockReturnValue({
        totalProviders: 2,
        providersByPlatform: { 
          github: 1, 
          gitlab: 1, 
          bitbucket: 0, 
          'azure-devops': 0, 
          gitea: 0, 
          forgejo: 0, 
          codeberg: 0, 
          generic: 0 
        },
        supportedHostnames: ['github.com', 'gitlab.com'],
      });

      mockProviderRegistry.performHealthChecks.mockResolvedValue({
        'TestProvider': { isHealthy: true, lastChecked: new Date().toISOString() },
      });

      await service.onModuleInit();

      expect(mockProviderRegistry.getRegistryStats).toHaveBeenCalled();
      expect(mockProviderRegistry.performHealthChecks).toHaveBeenCalled();
    });
  });

  describe('configureAuthentication', () => {
    it('should configure authentication for existing provider', () => {
      const authConfig: ScmAuthConfig = { type: 'token', token: 'test-token' };
      mockProviderRegistry.getProvider.mockReturnValue(mockProvider);

      const result = service.configureAuthentication('TestProvider', authConfig);

      expect(result).toBe(true);
      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('TestProvider');
      expect(mockProvider.configureAuthentication).toHaveBeenCalledWith(authConfig);
    });

    it('should return false for non-existent provider', () => {
      const authConfig: ScmAuthConfig = { type: 'token', token: 'test-token' };
      mockProviderRegistry.getProvider.mockReturnValue(null);

      const result = service.configureAuthentication('NonExistentProvider', authConfig);

      expect(result).toBe(false);
      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('NonExistentProvider');
      expect(mockProvider.configureAuthentication).not.toHaveBeenCalled();
    });
  });

  describe('configurePlatformAuthentication', () => {
    it('should configure authentication for all providers of a platform', () => {
      const authConfig: ScmAuthConfig = { type: 'token', token: 'test-token' };
      const mockProviders = [mockProvider, { ...mockProvider, getName: () => 'TestProvider2' }];
      mockProviderRegistry.getProvidersByPlatform.mockReturnValue(mockProviders);

      const result = service.configurePlatformAuthentication('github', authConfig);

      expect(result).toBe(2);
      expect(mockProviderRegistry.getProvidersByPlatform).toHaveBeenCalledWith('github');
      expect(mockProvider.configureAuthentication).toHaveBeenCalledWith(authConfig);
    });

    it('should return 0 for platform with no providers', () => {
      const authConfig: ScmAuthConfig = { type: 'token', token: 'test-token' };
      mockProviderRegistry.getProvidersByPlatform.mockReturnValue([]);

      const result = service.configurePlatformAuthentication('unknown', authConfig);

      expect(result).toBe(0);
      expect(mockProviderRegistry.getProvidersByPlatform).toHaveBeenCalledWith('unknown');
    });
  });

  describe('cloneRepository', () => {
    it('should successfully clone repository', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/repo';
      const options: CloneOptions = { depth: 1 };
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.cloneRepository.mockResolvedValue(undefined);

      const result = await service.cloneRepository(repoUrl, targetPath, options);

      expect(result).toEqual({
        success: true,
        provider: 'TestProvider',
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
      expect(mockProvider.cloneRepository).toHaveBeenCalledWith(repoUrl, targetPath, options);
    });

    it('should handle provider not found', async () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      const targetPath = '/tmp/repo';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = await service.cloneRepository(repoUrl, targetPath);

      expect(result).toEqual({
        success: false,
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
    });

    it('should handle clone error', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const targetPath = '/tmp/repo';
      const error = new Error('Clone failed');
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.cloneRepository.mockRejectedValue(error);

      const result = await service.cloneRepository(repoUrl, targetPath);

      expect(result).toEqual({
        success: false,
        provider: 'TestProvider',
        error: 'Clone failed',
      });
    });
  });

  describe('fetchRepositoryMetadata', () => {
    it('should successfully fetch metadata', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const mockMetadata: RepositoryMetadata = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
        platform: {},
        common: {},
      };
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);

      const result = await service.fetchRepositoryMetadata(repoUrl);

      expect(result).toEqual({
        metadata: mockMetadata,
        provider: 'TestProvider',
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
      expect(mockProvider.fetchRepoMetadata).toHaveBeenCalledWith(repoUrl);
    });

    it('should handle provider not found', async () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = await service.fetchRepositoryMetadata(repoUrl);

      expect(result).toEqual({
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
    });

    it('should handle fetch error', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const error = new Error('Fetch failed');
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.fetchRepoMetadata.mockRejectedValue(error);

      const result = await service.fetchRepositoryMetadata(repoUrl);

      expect(result).toEqual({
        provider: 'TestProvider',
        error: 'Fetch failed',
      });
    });
  });

  describe('getLastCommitHash', () => {
    it('should successfully get last commit hash', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const hash = 'abc123';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.getLastCommitHash.mockResolvedValue(hash);

      const result = await service.getLastCommitHash(repoUrl);

      expect(result).toEqual({
        hash,
        provider: 'TestProvider',
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
      expect(mockProvider.getLastCommitHash).toHaveBeenCalledWith(repoUrl);
    });

    it('should handle provider not found', async () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = await service.getLastCommitHash(repoUrl);

      expect(result).toEqual({
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
    });
  });

  describe('hasChangesSince', () => {
    it('should successfully check for changes', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const lastCommitHash = 'abc123';
      const mockResult: ChangeDetectionResult = {
        hasChanges: true,
        lastCommitHash: 'def456',
        changeSummary: {
          filesChanged: 5,
          additions: 100,
          deletions: 50,
          commits: 3,
        },
      };
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.hasChangesSince.mockResolvedValue(mockResult);

      const result = await service.hasChangesSince(repoUrl, lastCommitHash);

      expect(result).toEqual({
        result: mockResult,
        provider: 'TestProvider',
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
      expect(mockProvider.hasChangesSince).toHaveBeenCalledWith(repoUrl, lastCommitHash);
    });

    it('should handle provider not found', async () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      const lastCommitHash = 'abc123';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = await service.hasChangesSince(repoUrl, lastCommitHash);

      expect(result).toEqual({
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
    });
  });

  describe('parseRepositoryUrl', () => {
    it('should successfully parse repository URL', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const mockRepoInfo: RepositoryInfo = {
        platform: 'github',
        hostname: 'github.com',
        owner: 'user',
        repository: 'repo',
        fullName: 'user/repo',
        originalUrl: repoUrl,
      };
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.parseRepositoryUrl.mockReturnValue(mockRepoInfo);

      const result = service.parseRepositoryUrl(repoUrl);

      expect(result).toEqual({
        repoInfo: mockRepoInfo,
        provider: 'TestProvider',
      });
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
      expect(mockProvider.parseRepositoryUrl).toHaveBeenCalledWith(repoUrl);
    });

    it('should handle provider not found', () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = service.parseRepositoryUrl(repoUrl);

      expect(result).toEqual({
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
    });

    it('should handle parse failure', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.parseRepositoryUrl.mockReturnValue(null);

      const result = service.parseRepositoryUrl(repoUrl);

      expect(result).toEqual({
        provider: 'TestProvider',
        error: 'Failed to parse repository URL',
      });
    });

    it('should handle parse error', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const error = new Error('Parse failed');
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.parseRepositoryUrl.mockImplementation(() => {
        throw error;
      });

      const result = service.parseRepositoryUrl(repoUrl);

      expect(result).toEqual({
        provider: 'TestProvider',
        error: 'Parse failed',
      });
    });
  });

  describe('getProviderRecommendations', () => {
    it('should return provider recommendations', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const recommendations = {
        primary: mockProvider,
        alternatives: [],
        reasons: ['Primary: TestProvider - Direct hostname match or capability'],
      };
      
      mockProviderRegistry.getProviderRecommendations.mockReturnValue(recommendations);

      const result = service.getProviderRecommendations(repoUrl);

      expect(result).toEqual(recommendations);
      expect(mockProviderRegistry.getProviderRecommendations).toHaveBeenCalledWith(repoUrl);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', async () => {
      const providers = [mockProvider];
      mockProviderRegistry.getAvailableProviders.mockResolvedValue(providers);

      const result = await service.getAvailableProviders();

      expect(result).toEqual(providers);
      expect(mockProviderRegistry.getAvailableProviders).toHaveBeenCalled();
    });
  });

  describe('getRegistryStatistics', () => {
    it('should return registry statistics', () => {
      const stats = {
        totalProviders: 3,
        providersByPlatform: { 
          github: 1, 
          gitlab: 1, 
          bitbucket: 0, 
          'azure-devops': 0, 
          gitea: 0, 
          forgejo: 0, 
          codeberg: 0, 
          generic: 1 
        },
        supportedHostnames: ['github.com', 'gitlab.com'],
      };
      
      mockProviderRegistry.getRegistryStats.mockReturnValue(stats);

      const result = service.getRegistryStatistics();

      expect(result).toEqual(stats);
      expect(mockProviderRegistry.getRegistryStats).toHaveBeenCalled();
    });
  });

  describe('performHealthChecks', () => {
    it('should perform health checks on all providers', async () => {
      const healthResults = {
        'GitHubProvider': { isHealthy: true, lastChecked: new Date().toISOString() },
        'GitLabProvider': { isHealthy: false, error: 'Connection failed', lastChecked: new Date().toISOString() },
      };
      
      mockProviderRegistry.performHealthChecks.mockResolvedValue(healthResults);

      const result = await service.performHealthChecks();

      expect(result).toEqual(healthResults);
      expect(mockProviderRegistry.performHealthChecks).toHaveBeenCalled();
    });
  });

  describe('getSupportedPlatforms', () => {
    it('should return supported platforms', () => {
      const platforms: ScmPlatform[] = ['github', 'gitlab', 'bitbucket'];
      mockProviderRegistry.getSupportedPlatforms.mockReturnValue(platforms);

      const result = service.getSupportedPlatforms();

      expect(result).toEqual(platforms);
      expect(mockProviderRegistry.getSupportedPlatforms).toHaveBeenCalled();
    });
  });

  describe('isPlatformSupported', () => {
    it('should return true for supported platform', () => {
      mockProviderRegistry.isPlatformSupported.mockReturnValue(true);

      const result = service.isPlatformSupported('github');

      expect(result).toBe(true);
      expect(mockProviderRegistry.isPlatformSupported).toHaveBeenCalledWith('github');
    });

    it('should return false for unsupported platform', () => {
      mockProviderRegistry.isPlatformSupported.mockReturnValue(false);

      const result = service.isPlatformSupported('unknown');

      expect(result).toBe(false);
      expect(mockProviderRegistry.isPlatformSupported).toHaveBeenCalledWith('unknown');
    });
  });

  describe('isHostnameSupported', () => {
    it('should return true for supported hostname', () => {
      mockProviderRegistry.isHostnameSupported.mockReturnValue(true);

      const result = service.isHostnameSupported('github.com');

      expect(result).toBe(true);
      expect(mockProviderRegistry.isHostnameSupported).toHaveBeenCalledWith('github.com');
    });

    it('should return false for unsupported hostname', () => {
      mockProviderRegistry.isHostnameSupported.mockReturnValue(false);

      const result = service.isHostnameSupported('unknown.com');

      expect(result).toBe(false);
      expect(mockProviderRegistry.isHostnameSupported).toHaveBeenCalledWith('unknown.com');
    });
  });

  describe('getProvider', () => {
    it('should return provider by name', () => {
      mockProviderRegistry.getProvider.mockReturnValue(mockProvider);

      const result = service.getProvider('TestProvider');

      expect(result).toEqual(mockProvider);
      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('TestProvider');
    });

    it('should return null for non-existent provider', () => {
      mockProviderRegistry.getProvider.mockReturnValue(null);

      const result = service.getProvider('NonExistentProvider');

      expect(result).toBeNull();
      expect(mockProviderRegistry.getProvider).toHaveBeenCalledWith('NonExistentProvider');
    });
  });

  describe('getProviderForUrl', () => {
    it('should return provider for URL', () => {
      const repoUrl = 'https://github.com/user/repo.git';
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);

      const result = service.getProviderForUrl(repoUrl);

      expect(result).toEqual(mockProvider);
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
    });

    it('should return null for unsupported URL', () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = service.getProviderForUrl(repoUrl);

      expect(result).toBeNull();
      expect(mockProviderRegistry.getProviderForUrl).toHaveBeenCalledWith(repoUrl);
    });
  });

  describe('registerProvider', () => {
    it('should register a new provider', () => {
      const newProvider = { ...mockProvider, getName: () => 'NewProvider' };

      service.registerProvider(newProvider);

      expect(mockProviderRegistry.registerProvider).toHaveBeenCalledWith(newProvider);
    });
  });

  describe('unregisterProvider', () => {
    it('should unregister a provider', () => {
      service.unregisterProvider('TestProvider');

      expect(mockProviderRegistry.unregisterProvider).toHaveBeenCalledWith('TestProvider');
    });
  });

  describe('cloneMultipleRepositories', () => {
    it('should clone multiple repositories successfully', async () => {
      const repositories = [
        { url: 'https://github.com/user/repo1.git', targetPath: '/tmp/repo1' },
        { url: 'https://gitlab.com/user/repo2.git', targetPath: '/tmp/repo2' },
      ];

      mockProviderRegistry.getProviderForUrl
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(mockProvider);
      mockProvider.cloneRepository.mockResolvedValue(undefined);

      const result = await service.cloneMultipleRepositories(repositories);

      expect(result).toEqual([
        { url: 'https://github.com/user/repo1.git', success: true, provider: 'TestProvider' },
        { url: 'https://gitlab.com/user/repo2.git', success: true, provider: 'TestProvider' },
      ]);
    });

    it('should handle mixed success and failure', async () => {
      const repositories = [
        { url: 'https://github.com/user/repo1.git', targetPath: '/tmp/repo1' },
        { url: 'https://unknown.com/user/repo2.git', targetPath: '/tmp/repo2' },
      ];

      mockProviderRegistry.getProviderForUrl
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(null);
      mockProvider.cloneRepository.mockResolvedValue(undefined);

      const result = await service.cloneMultipleRepositories(repositories);

      expect(result).toEqual([
        { url: 'https://github.com/user/repo1.git', success: true, provider: 'TestProvider' },
        { url: 'https://unknown.com/user/repo2.git', success: false, error: 'No suitable provider found for repository: https://unknown.com/user/repo2.git' },
      ]);
    });

    it('should handle promise rejection', async () => {
      const repositories = [
        { url: 'https://github.com/user/repo1.git', targetPath: '/tmp/repo1' },
      ];

      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.cloneRepository.mockRejectedValue(new Error('Clone failed'));

      const result = await service.cloneMultipleRepositories(repositories);

      expect(result).toEqual([
        { url: 'https://github.com/user/repo1.git', success: false, provider: 'TestProvider', error: 'Clone failed' },
      ]);
    });
  });

  describe('fetchMultipleRepositoryMetadata', () => {
    it('should fetch metadata for multiple repositories', async () => {
      const repoUrls = [
        'https://github.com/user/repo1.git',
        'https://gitlab.com/user/repo2.git',
      ];

      const mockMetadata: RepositoryMetadata = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
        platform: {},
        common: {},
      };

      mockProviderRegistry.getProviderForUrl
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(mockProvider);
      mockProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);

      const result = await service.fetchMultipleRepositoryMetadata(repoUrls);

      expect(result).toEqual([
        { url: 'https://github.com/user/repo1.git', metadata: mockMetadata, provider: 'TestProvider' },
        { url: 'https://gitlab.com/user/repo2.git', metadata: mockMetadata, provider: 'TestProvider' },
      ]);
    });

    it('should handle mixed success and failure', async () => {
      const repoUrls = [
        'https://github.com/user/repo1.git',
        'https://unknown.com/user/repo2.git',
      ];

      const mockMetadata: RepositoryMetadata = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
        platform: {},
        common: {},
      };

      mockProviderRegistry.getProviderForUrl
        .mockReturnValueOnce(mockProvider)
        .mockReturnValueOnce(null);
      mockProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);

      const result = await service.fetchMultipleRepositoryMetadata(repoUrls);

      expect(result).toEqual([
        { url: 'https://github.com/user/repo1.git', metadata: mockMetadata, provider: 'TestProvider' },
        { url: 'https://unknown.com/user/repo2.git', error: 'No suitable provider found for repository: https://unknown.com/user/repo2.git' },
      ]);
    });
  });

  describe('analyzeRepository', () => {
    it('should perform comprehensive repository analysis', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const mockMetadata: RepositoryMetadata = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
        platform: {},
        common: {
          language: 'JavaScript',
          size: 1024,
          license: 'MIT',
        },
      };

      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);
      mockProvider.getBranches = jest.fn().mockResolvedValue(['main', 'develop']);
      mockProvider.getTags = jest.fn().mockResolvedValue(['v1.0.0', 'v1.1.0']);
      mockProvider.getContributors = jest.fn().mockResolvedValue([
        { name: 'User 1', contributions: 50 },
        { name: 'User 2', contributions: 30 },
      ]);

      const result = await service.analyzeRepository(repoUrl);

      expect(result).toMatchObject({
        metadata: mockMetadata,
        branches: ['main', 'develop'],
        tags: ['v1.0.0', 'v1.1.0'],
        contributors: [
          { name: 'User 1', contributions: 50 },
          { name: 'User 2', contributions: 30 },
        ],
        provider: 'TestProvider',
        analysis: {
          isActive: true,
          hasRecentActivity: true,
          primaryLanguage: 'JavaScript',
          estimatedSize: '1.0 MB',
          securityStatus: 'Good',
        },
      });
    });

    it('should handle provider not found', async () => {
      const repoUrl = 'https://unknown.com/user/repo.git';
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(null);

      const result = await service.analyzeRepository(repoUrl);

      expect(result).toEqual({
        error: `No suitable provider found for repository: ${repoUrl}`,
      });
    });

    it('should handle analysis error', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const error = new Error('Analysis failed');
      
      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.fetchRepoMetadata.mockRejectedValue(error);

      const result = await service.analyzeRepository(repoUrl);

      expect(result).toEqual({
        provider: 'TestProvider',
        metadata: undefined,
        branches: undefined,
        tags: undefined,
        contributors: undefined,
        analysis: undefined,
      });
    });

    it('should handle missing optional methods', async () => {
      const repoUrl = 'https://github.com/user/repo.git';
      const mockMetadata: RepositoryMetadata = {
        name: 'test-repo',
        description: 'Test repository',
        defaultBranch: 'main',
        lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
        platform: {},
        common: {},
      };

      mockProviderRegistry.getProviderForUrl.mockReturnValue(mockProvider);
      mockProvider.fetchRepoMetadata.mockResolvedValue(mockMetadata);
      // Remove optional methods
      delete mockProvider.getBranches;
      delete mockProvider.getTags;
      delete mockProvider.getContributors;

      const result = await service.analyzeRepository(repoUrl);

      expect(result).toMatchObject({
        metadata: mockMetadata,
        branches: [],
        tags: [],
        contributors: [],
        provider: 'TestProvider',
      });
    });
  });

  describe('private methods', () => {
    describe('formatSize', () => {
      it('should format size in KB', () => {
        const result = (service as any).formatSize(512);
        expect(result).toBe('512 KB');
      });

      it('should format size in MB', () => {
        const result = (service as any).formatSize(2048);
        expect(result).toBe('2.0 MB');
      });

      it('should format size in GB', () => {
        const result = (service as any).formatSize(2 * 1024 * 1024);
        expect(result).toBe('2.0 GB');
      });
    });

    describe('assessSecurityStatus', () => {
      it('should return Good for secure repository', () => {
        const metadata: RepositoryMetadata = {
          name: 'test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
          platform: {},
          common: {
            license: 'MIT',
          },
        };

        const result = (service as any).assessSecurityStatus(metadata, ['main', 'develop'], ['v1.0.0']);

        expect(result).toBe('Good');
      });

      it('should return Moderate for repository with some issues', () => {
        const metadata: RepositoryMetadata = {
          name: 'test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: { hash: 'abc123', timestamp: new Date().toISOString() },
          platform: {},
          common: {
            license: 'MIT', // Add license to reduce issues to 2
          },
        };

        const result = (service as any).assessSecurityStatus(metadata, ['main'], []);

        expect(result).toBe('Moderate');
      });

      it('should return Needs attention for repository with many issues', () => {
        const oldDate = new Date();
        oldDate.setFullYear(oldDate.getFullYear() - 2);
        
        const metadata: RepositoryMetadata = {
          name: 'test-repo',
          description: 'Test repository',
          defaultBranch: 'main',
          lastCommit: { hash: 'abc123', timestamp: oldDate.toISOString() },
          platform: {},
          common: {},
        };

        const result = (service as any).assessSecurityStatus(metadata, ['main'], []);

        expect(result).toBe('Needs attention');
      });
    });
  });
}); 