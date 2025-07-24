import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ScmProviderRegistryService } from './scm-provider.registry';
import {
  ScmProvider,
  ScmPlatform,
  ProviderHealthStatus,
  ScmProviderConfig,
  ScmAuthConfig,
} from '../interfaces/scm.interface';

describe('ScmProviderRegistryService', () => {
  let service: ScmProviderRegistryService;
  let mockProvider1: jest.Mocked<ScmProvider>;
  let mockProvider2: jest.Mocked<ScmProvider>;
  let mockProvider3: jest.Mocked<ScmProvider>;

  beforeEach(async () => {
    // Create mock providers
    mockProvider1 = {
      getConfig: jest.fn().mockReturnValue({
        name: 'GitHubProvider',
        platform: 'github',
        hostnames: ['github.com', 'www.github.com'],
        supportsPrivateRepos: true,
        supportsApi: true,
        authentication: { type: 'token' },
      }),
      getName: jest.fn().mockReturnValue('GitHubProvider'),
      getPlatform: jest.fn().mockReturnValue('github'),
      getSupportedHostnames: jest
        .fn()
        .mockReturnValue(['github.com', 'www.github.com']),
      canHandle: jest.fn().mockReturnValue(true),
      parseRepositoryUrl: jest.fn(),
      normalizeRepositoryUrl: jest
        .fn()
        .mockReturnValue('https://github.com/user/repo.git'),
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
      healthCheck: jest.fn().mockResolvedValue({
        isHealthy: true,
        lastChecked: new Date().toISOString(),
      }),
    };

    mockProvider2 = {
      getConfig: jest.fn().mockReturnValue({
        name: 'GitLabProvider',
        platform: 'gitlab',
        hostnames: ['gitlab.com', 'www.gitlab.com'],
        supportsPrivateRepos: true,
        supportsApi: true,
        authentication: { type: 'token' },
      }),
      getName: jest.fn().mockReturnValue('GitLabProvider'),
      getPlatform: jest.fn().mockReturnValue('gitlab'),
      getSupportedHostnames: jest
        .fn()
        .mockReturnValue(['gitlab.com', 'www.gitlab.com']),
      canHandle: jest.fn().mockReturnValue(true),
      parseRepositoryUrl: jest.fn(),
      normalizeRepositoryUrl: jest
        .fn()
        .mockReturnValue('https://gitlab.com/user/repo.git'),
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
      healthCheck: jest.fn().mockResolvedValue({
        isHealthy: true,
        lastChecked: new Date().toISOString(),
      }),
    };

    mockProvider3 = {
      getConfig: jest.fn().mockReturnValue({
        name: 'GenericProvider',
        platform: 'generic',
        hostnames: ['custom-git.com'],
        supportsPrivateRepos: false,
        supportsApi: false,
        authentication: { type: 'none' },
      }),
      getName: jest.fn().mockReturnValue('GenericProvider'),
      getPlatform: jest.fn().mockReturnValue('generic'),
      getSupportedHostnames: jest.fn().mockReturnValue(['custom-git.com']),
      canHandle: jest.fn().mockReturnValue(false),
      parseRepositoryUrl: jest.fn(),
      normalizeRepositoryUrl: jest
        .fn()
        .mockReturnValue('https://custom-git.com/user/repo.git'),
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
      healthCheck: jest.fn().mockResolvedValue({
        isHealthy: false,
        lastChecked: new Date().toISOString(),
        error: 'Connection failed',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ScmProviderRegistryService],
    }).compile();

    service = module.get<ScmProviderRegistryService>(
      ScmProviderRegistryService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    service.clearAllProviders();
  });

  describe('registerProvider', () => {
    it('should register a provider successfully', () => {
      service.registerProvider(mockProvider1);

      expect(service.getProvider('GitHubProvider')).toBe(mockProvider1);
      expect(service.getProvidersByPlatform('github')).toContain(mockProvider1);
      expect(service.isHostnameSupported('github.com')).toBe(true);
    });

    it('should register multiple providers for the same platform', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      expect(service.getProvidersByPlatform('github')).toContain(mockProvider1);
      expect(service.getProvidersByPlatform('gitlab')).toContain(mockProvider2);
    });

    it('should register multiple hostnames for a provider', () => {
      service.registerProvider(mockProvider1);

      expect(service.isHostnameSupported('github.com')).toBe(true);
      expect(service.isHostnameSupported('www.github.com')).toBe(true);
    });

    it('should log registration information', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.registerProvider(mockProvider1);

      expect(logSpy).toHaveBeenCalledWith(
        'Registered SCM provider: GitHubProvider (github) - Hostnames: github.com, www.github.com',
      );
    });
  });

  describe('unregisterProvider', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should unregister a provider successfully', () => {
      service.unregisterProvider('GitHubProvider');

      expect(service.getProvider('GitHubProvider')).toBeNull();
      expect(service.getProvidersByPlatform('github')).not.toContain(
        mockProvider1,
      );
      expect(service.isHostnameSupported('github.com')).toBe(false);
    });

    it('should handle unregistering non-existent provider', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      service.unregisterProvider('NonExistentProvider');

      expect(warnSpy).toHaveBeenCalledWith(
        'Provider NonExistentProvider not found for unregistration',
      );
    });

    it('should clean up platform registry when last provider is removed', () => {
      service.unregisterProvider('GitHubProvider');

      expect(service.getProvidersByPlatform('github')).toEqual([]);
      expect(service.isPlatformSupported('github')).toBe(false);
    });

    it('should clean up hostname registry when last provider is removed', () => {
      service.unregisterProvider('GitHubProvider');

      expect(service.isHostnameSupported('github.com')).toBe(false);
      expect(service.isHostnameSupported('www.github.com')).toBe(false);
    });

    it('should log unregistration information', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.unregisterProvider('GitHubProvider');

      expect(logSpy).toHaveBeenCalledWith(
        'Unregistered SCM provider: GitHubProvider',
      );
    });
  });

  describe('getProvider', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
    });

    it('should return provider by name', () => {
      const provider = service.getProvider('GitHubProvider');
      expect(provider).toBe(mockProvider1);
    });

    it('should return null for non-existent provider', () => {
      const provider = service.getProvider('NonExistentProvider');
      expect(provider).toBeNull();
    });
  });

  describe('getProviderForUrl', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
      service.registerProvider(mockProvider3);
    });

    it('should find provider by exact hostname match', () => {
      const provider = service.getProviderForUrl(
        'https://github.com/user/repo.git',
      );
      expect(provider).toBe(mockProvider1);
    });

    it('should find provider by partial hostname match', () => {
      // Mock provider that supports partial matching
      const partialMatchProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['git.']),
        canHandle: jest.fn().mockReturnValue(true),
      };
      service.registerProvider(partialMatchProvider);

      const provider = service.getProviderForUrl(
        'https://git.example.com/user/repo.git',
      );
      expect(provider).toBe(partialMatchProvider);
    });

    it('should find provider by capability check', () => {
      // Mock provider that doesn't match hostname but can handle URL
      const capableProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['other.com']),
        canHandle: jest.fn().mockReturnValue(true),
      };
      service.registerProvider(capableProvider);

      const provider = service.getProviderForUrl(
        'https://unknown.com/user/repo.git',
      );
      expect(provider).toBe(capableProvider);
    });

    it('should return null when no provider can handle URL', () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      // Clear all providers and add only one that can't handle the URL
      service.clearAllProviders();
      const incapableProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['other.com']),
        canHandle: jest.fn().mockReturnValue(false),
      };
      service.registerProvider(incapableProvider);

      const provider = service.getProviderForUrl(
        'https://unknown.com/user/repo.git',
      );

      expect(provider).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        'No provider found for URL: https://unknown.com/user/repo.git',
      );
    });

    it('should handle invalid URLs gracefully', () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');

      const provider = service.getProviderForUrl('invalid-url');

      expect(provider).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });

    it('should log when finding providers', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.getProviderForUrl('https://github.com/user/repo.git');

      expect(logSpy).toHaveBeenCalledWith(
        'Found exact hostname match for https://github.com/user/repo.git: GitHubProvider',
      );
    });
  });

  describe('getAllProviders', () => {
    it('should return empty array when no providers registered', () => {
      const providers = service.getAllProviders();
      expect(providers).toEqual([]);
    });

    it('should return all registered providers', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);

      const providers = service.getAllProviders();
      expect(providers).toContain(mockProvider1);
      expect(providers).toContain(mockProvider2);
      expect(providers).toHaveLength(2);
    });
  });

  describe('getAvailableProviders', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1); // Healthy
      service.registerProvider(mockProvider2); // Healthy
      service.registerProvider(mockProvider3); // Unhealthy
    });

    it('should return only healthy providers', async () => {
      const providers = await service.getAvailableProviders();

      expect(providers).toContain(mockProvider1);
      expect(providers).toContain(mockProvider2);
      expect(providers).not.toContain(mockProvider3);
      expect(providers).toHaveLength(2);
    });

    it('should handle health check failures gracefully', async () => {
      const failingProvider = {
        ...mockProvider1,
        getName: jest.fn().mockReturnValue('FailingProvider'),
        healthCheck: jest
          .fn()
          .mockRejectedValue(new Error('Health check failed')),
      };
      service.registerProvider(failingProvider);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      const providers = await service.getAvailableProviders();

      expect(providers).not.toContain(failingProvider);
      expect(warnSpy).toHaveBeenCalledWith(
        'Health check failed for provider FailingProvider:',
        expect.any(Error),
      );
    });

    it('should return empty array when no providers are healthy', async () => {
      const unhealthyProvider = {
        ...mockProvider1,
        healthCheck: jest.fn().mockResolvedValue({
          isHealthy: false,
          lastChecked: new Date().toISOString(),
        }),
      };
      service.clearAllProviders();
      service.registerProvider(unhealthyProvider);

      const providers = await service.getAvailableProviders();
      expect(providers).toEqual([]);
    });
  });

  describe('getProvidersByPlatform', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should return providers for specific platform', () => {
      const githubProviders = service.getProvidersByPlatform('github');
      const gitlabProviders = service.getProvidersByPlatform('gitlab');

      expect(githubProviders).toContain(mockProvider1);
      expect(gitlabProviders).toContain(mockProvider2);
    });

    it('should return empty array for unsupported platform', () => {
      const providers = service.getProvidersByPlatform('bitbucket');
      expect(providers).toEqual([]);
    });
  });

  describe('getRegistryStats', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
      service.registerProvider(mockProvider3);
    });

    it('should return correct statistics', () => {
      const stats = service.getRegistryStats();

      expect(stats.totalProviders).toBe(3);
      expect(stats.providersByPlatform).toEqual({
        github: 1,
        gitlab: 1,
        generic: 1,
      });
      expect(stats.supportedHostnames).toContain('github.com');
      expect(stats.supportedHostnames).toContain('gitlab.com');
      expect(stats.supportedHostnames).toContain('custom-git.com');
    });

    it('should handle empty registry', () => {
      service.clearAllProviders();

      const stats = service.getRegistryStats();

      expect(stats.totalProviders).toBe(0);
      expect(stats.providersByPlatform).toEqual({});
      expect(stats.supportedHostnames).toEqual([]);
    });
  });

  describe('performHealthChecks', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
      service.registerProvider(mockProvider3);
    });

    it('should perform health checks on all providers', async () => {
      const results = await service.performHealthChecks();

      expect(results).toHaveProperty('GitHubProvider');
      expect(results).toHaveProperty('GitLabProvider');
      expect(results).toHaveProperty('GenericProvider');
      expect(results.GitHubProvider.isHealthy).toBe(true);
      expect(results.GitLabProvider.isHealthy).toBe(true);
      expect(results.GenericProvider.isHealthy).toBe(false);
    });

    it('should handle health check failures gracefully', async () => {
      const failingProvider = {
        ...mockProvider1,
        getName: jest.fn().mockReturnValue('FailingProvider'),
        healthCheck: jest
          .fn()
          .mockRejectedValue(new Error('Health check failed')),
      };
      service.registerProvider(failingProvider);

      const results = await service.performHealthChecks();

      expect(results.FailingProvider.isHealthy).toBe(false);
      expect(results.FailingProvider.error).toBe('Health check failed');
      expect(results.FailingProvider.lastChecked).toBeDefined();
    });

    it('should handle unknown errors', async () => {
      const failingProvider = {
        ...mockProvider1,
        getName: jest.fn().mockReturnValue('FailingProvider'),
        healthCheck: jest.fn().mockRejectedValue('Unknown error'),
      };
      service.registerProvider(failingProvider);

      const results = await service.performHealthChecks();

      expect(results.FailingProvider.isHealthy).toBe(false);
      expect(results.FailingProvider.error).toBe('Unknown error');
    });
  });

  describe('getSupportedPlatforms', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should return all supported platforms', () => {
      const platforms = service.getSupportedPlatforms();

      expect(platforms).toContain('github');
      expect(platforms).toContain('gitlab');
      expect(platforms).toHaveLength(2);
    });

    it('should return empty array when no providers registered', () => {
      service.clearAllProviders();

      const platforms = service.getSupportedPlatforms();
      expect(platforms).toEqual([]);
    });
  });

  describe('isPlatformSupported', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
    });

    it('should return true for supported platform', () => {
      expect(service.isPlatformSupported('github')).toBe(true);
    });

    it('should return false for unsupported platform', () => {
      expect(service.isPlatformSupported('bitbucket')).toBe(false);
    });
  });

  describe('isHostnameSupported', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
    });

    it('should return true for exact hostname match', () => {
      expect(service.isHostnameSupported('github.com')).toBe(true);
    });

    it('should return true for partial hostname match', () => {
      const partialMatchProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['git.']),
      };
      service.registerProvider(partialMatchProvider);

      expect(service.isHostnameSupported('git.example.com')).toBe(true);
    });

    it('should return false for unsupported hostname', () => {
      expect(service.isHostnameSupported('unknown.com')).toBe(false);
    });

    it('should handle reverse partial matching', () => {
      const reverseMatchProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['example.com']),
      };
      service.registerProvider(reverseMatchProvider);

      expect(service.isHostnameSupported('git.example.com')).toBe(true);
    });
  });

  describe('getProviderRecommendations', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should return primary provider for supported URL', () => {
      // Clear and add only the primary provider
      service.clearAllProviders();
      service.registerProvider(mockProvider1);

      const recommendations = service.getProviderRecommendations(
        'https://github.com/user/repo.git',
      );

      expect(recommendations.primary).toBe(mockProvider1);
      expect(recommendations.alternatives).toEqual([]);
      expect(recommendations.reasons).toContain(
        'Primary: GitHubProvider - Direct hostname match or capability',
      );
    });

    it('should return alternatives when multiple providers can handle URL', () => {
      const alternativeProvider = {
        ...mockProvider2,
        canHandle: jest.fn().mockReturnValue(true),
      };
      service.registerProvider(alternativeProvider);

      const recommendations = service.getProviderRecommendations(
        'https://github.com/user/repo.git',
      );

      expect(recommendations.primary).toBe(mockProvider1);
      expect(recommendations.alternatives).toContain(alternativeProvider);
      expect(recommendations.reasons).toContain('Alternatives: GitLabProvider');
    });

    it('should return null primary for unsupported URL', () => {
      // Clear all providers and add only one that can't handle the URL
      service.clearAllProviders();
      const incapableProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue(['other.com']),
        canHandle: jest.fn().mockReturnValue(false),
      };
      service.registerProvider(incapableProvider);

      const recommendations = service.getProviderRecommendations(
        'https://unknown.com/user/repo.git',
      );

      expect(recommendations.primary).toBeNull();
      expect(recommendations.reasons).toContain(
        'No primary provider found - URL may not be supported',
      );
    });

    it('should warn about unsupported hostnames', () => {
      const recommendations = service.getProviderRecommendations(
        'https://unknown.com/user/repo.git',
      );

      expect(recommendations.reasons).toContain(
        'Warning: Hostname unknown.com is not explicitly supported',
      );
    });

    it('should handle invalid URLs gracefully', () => {
      const recommendations = service.getProviderRecommendations('invalid-url');

      expect(recommendations.primary).toBeNull();
      expect(recommendations.reasons).toContain(
        'Error analyzing URL: Unknown error',
      );
    });
  });

  describe('clearAllProviders', () => {
    beforeEach(() => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
    });

    it('should clear all providers', () => {
      service.clearAllProviders();

      expect(service.getAllProviders()).toEqual([]);
      expect(service.getSupportedPlatforms()).toEqual([]);
      expect(service.getRegistryStats().totalProviders).toBe(0);
    });

    it('should log clearing operation', () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      service.clearAllProviders();

      expect(logSpy).toHaveBeenCalledWith(
        'Cleared all SCM providers from registry',
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle provider with empty hostnames array', () => {
      const emptyHostnameProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest.fn().mockReturnValue([]),
      };

      expect(() =>
        service.registerProvider(emptyHostnameProvider),
      ).not.toThrow();
      expect(service.getProvider('GitHubProvider')).toBe(emptyHostnameProvider);
    });

    it('should handle provider with duplicate hostnames', () => {
      const duplicateHostnameProvider = {
        ...mockProvider1,
        getSupportedHostnames: jest
          .fn()
          .mockReturnValue(['github.com', 'github.com']),
      };

      expect(() =>
        service.registerProvider(duplicateHostnameProvider),
      ).not.toThrow();
    });

    it('should handle concurrent registration and unregistration', () => {
      service.registerProvider(mockProvider1);
      service.registerProvider(mockProvider2);
      service.unregisterProvider('GitHubProvider');
      service.registerProvider(mockProvider1);

      expect(service.getProvider('GitHubProvider')).toBe(mockProvider1);
      expect(service.getProvidersByPlatform('github')).toContain(mockProvider1);
    });

    it('should handle provider with null/undefined values gracefully', () => {
      const invalidProvider = {
        ...mockProvider1,
        getName: jest.fn().mockReturnValue(null),
        getPlatform: jest.fn().mockReturnValue(undefined),
        getSupportedHostnames: jest.fn().mockReturnValue([]), // Use empty array instead of null
      };

      expect(() => service.registerProvider(invalidProvider)).not.toThrow();
    });
  });
});
