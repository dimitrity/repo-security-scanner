import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ScmProviderRegistryService } from './scm-provider.registry';
import { 
  ScmProvider, 
  RepositoryMetadata, 
  ChangeDetectionResult, 
  CloneOptions,
  ScmAuthConfig,
  ProviderHealthStatus,
  RepositoryInfo
} from '../interfaces/scm.interface';

/**
 * High-level SCM Manager Service
 * Provides a unified interface for all SCM operations across multiple providers
 */
@Injectable()
export class ScmManagerService implements OnModuleInit {
  private readonly logger = new Logger(ScmManagerService.name);

  constructor(
    private readonly providerRegistry: ScmProviderRegistryService
  ) {}

  async onModuleInit() {
    this.logger.log('SCM Manager initialized');
    await this.logProviderStatus();
  }

  /**
   * Configure authentication for a specific provider or platform
   */
  configureAuthentication(providerName: string, authConfig: ScmAuthConfig): boolean {
    const provider = this.providerRegistry.getProvider(providerName);
    if (!provider) {
      this.logger.warn(`Provider ${providerName} not found for authentication configuration`);
      return false;
    }

    provider.configureAuthentication(authConfig);
    this.logger.log(`Authentication configured for provider: ${providerName}`);
    return true;
  }

  /**
   * Configure authentication for all providers of a specific platform
   */
  configurePlatformAuthentication(platform: string, authConfig: ScmAuthConfig): number {
    const providers = this.providerRegistry.getProvidersByPlatform(platform as any);
    let configuredCount = 0;

    providers.forEach(provider => {
      provider.configureAuthentication(authConfig);
      configuredCount++;
    });

    this.logger.log(`Authentication configured for ${configuredCount} providers of platform: ${platform}`);
    return configuredCount;
  }

  /**
   * Clone a repository using the best available provider
   */
  async cloneRepository(repoUrl: string, targetPath: string, options?: CloneOptions): Promise<{
    success: boolean;
    provider?: string;
    error?: string;
  }> {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      const error = `No suitable provider found for repository: ${repoUrl}`;
      this.logger.error(error);
      return { success: false, error };
    }

    try {
      await provider.cloneRepository(repoUrl, targetPath, options);
      this.logger.log(`Successfully cloned ${repoUrl} using provider: ${provider.getName()}`);
      return { success: true, provider: provider.getName() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clone ${repoUrl} with provider ${provider.getName()}:`, errorMessage);
      return { success: false, provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Fetch repository metadata using the best available provider
   */
  async fetchRepositoryMetadata(repoUrl: string): Promise<{
    metadata?: RepositoryMetadata;
    provider?: string;
    error?: string;
  }> {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      const error = `No suitable provider found for repository: ${repoUrl}`;
      this.logger.error(error);
      return { error };
    }

    try {
      const metadata = await provider.fetchRepoMetadata(repoUrl);
      this.logger.log(`Successfully fetched metadata for ${repoUrl} using provider: ${provider.getName()}`);
      return { metadata, provider: provider.getName() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch metadata for ${repoUrl} with provider ${provider.getName()}:`, errorMessage);
      return { provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Get last commit hash using the best available provider
   */
  async getLastCommitHash(repoUrl: string): Promise<{
    hash?: string;
    provider?: string;
    error?: string;
  }> {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      const error = `No suitable provider found for repository: ${repoUrl}`;
      this.logger.error(error);
      return { error };
    }

    try {
      const hash = await provider.getLastCommitHash(repoUrl);
      this.logger.log(`Successfully got last commit hash for ${repoUrl} using provider: ${provider.getName()}`);
      return { hash, provider: provider.getName() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get last commit hash for ${repoUrl} with provider ${provider.getName()}:`, errorMessage);
      return { provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Check for changes since a specific commit
   */
  async hasChangesSince(repoUrl: string, lastCommitHash: string): Promise<{
    result?: ChangeDetectionResult;
    provider?: string;
    error?: string;
  }> {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      const error = `No suitable provider found for repository: ${repoUrl}`;
      this.logger.error(error);
      return { error };
    }

    try {
      const result = await provider.hasChangesSince(repoUrl, lastCommitHash);
      this.logger.log(`Successfully checked changes for ${repoUrl} using provider: ${provider.getName()}`);
      return { result, provider: provider.getName() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check changes for ${repoUrl} with provider ${provider.getName()}:`, errorMessage);
      return { provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Parse repository URL using the best available provider
   */
  parseRepositoryUrl(repoUrl: string): {
    repoInfo?: RepositoryInfo;
    provider?: string;
    error?: string;
  } {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      const error = `No suitable provider found for repository: ${repoUrl}`;
      this.logger.error(error);
      return { error };
    }

    try {
      const repoInfo = provider.parseRepositoryUrl(repoUrl);
      if (repoInfo) {
        return { repoInfo, provider: provider.getName() };
      } else {
        return { provider: provider.getName(), error: 'Failed to parse repository URL' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse URL ${repoUrl} with provider ${provider.getName()}:`, errorMessage);
      return { provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Get provider recommendations for a repository URL
   */
  getProviderRecommendations(repoUrl: string) {
    return this.providerRegistry.getProviderRecommendations(repoUrl);
  }

  /**
   * Get all available providers
   */
  async getAvailableProviders(): Promise<ScmProvider[]> {
    return this.providerRegistry.getAvailableProviders();
  }

  /**
   * Get provider registry statistics
   */
  getRegistryStatistics() {
    return this.providerRegistry.getRegistryStats();
  }

  /**
   * Perform health checks on all providers
   */
  async performHealthChecks(): Promise<Record<string, ProviderHealthStatus>> {
    return this.providerRegistry.performHealthChecks();
  }

  /**
   * Get supported platforms
   */
  getSupportedPlatforms() {
    return this.providerRegistry.getSupportedPlatforms();
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform: string): boolean {
    return this.providerRegistry.isPlatformSupported(platform as any);
  }

  /**
   * Check if a hostname is supported
   */
  isHostnameSupported(hostname: string): boolean {
    return this.providerRegistry.isHostnameSupported(hostname);
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): ScmProvider | null {
    return this.providerRegistry.getProvider(name);
  }

  /**
   * Get provider for URL
   */
  getProviderForUrl(repoUrl: string): ScmProvider | null {
    return this.providerRegistry.getProviderForUrl(repoUrl);
  }

  /**
   * Register a new provider (mainly for testing or plugins)
   */
  registerProvider(provider: ScmProvider): void {
    this.providerRegistry.registerProvider(provider);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): void {
    this.providerRegistry.unregisterProvider(name);
  }

  /**
   * Bulk operations for multiple repositories
   */
  async cloneMultipleRepositories(repositories: Array<{
    url: string;
    targetPath: string;
    options?: CloneOptions;
  }>): Promise<Array<{
    url: string;
    success: boolean;
    provider?: string;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      repositories.map(async (repo) => {
        const result = await this.cloneRepository(repo.url, repo.targetPath, repo.options);
        return { url: repo.url, ...result };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: repositories[index].url,
          success: false,
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Fetch metadata for multiple repositories
   */
  async fetchMultipleRepositoryMetadata(repoUrls: string[]): Promise<Array<{
    url: string;
    metadata?: RepositoryMetadata;
    provider?: string;
    error?: string;
  }>> {
    const results = await Promise.allSettled(
      repoUrls.map(async (url) => {
        const result = await this.fetchRepositoryMetadata(url);
        return { url, ...result };
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: repoUrls[index],
          error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
        };
      }
    });
  }

  /**
   * Advanced repository analysis
   */
  async analyzeRepository(repoUrl: string): Promise<{
    metadata?: RepositoryMetadata;
    branches?: string[];
    tags?: string[];
    contributors?: any[];
    provider?: string;
    analysis?: {
      isActive: boolean;
      hasRecentActivity: boolean;
      primaryLanguage?: string;
      estimatedSize?: string;
      securityStatus?: string;
    };
    error?: string;
  }> {
    const provider = this.providerRegistry.getProviderForUrl(repoUrl);
    
    if (!provider) {
      return { error: `No suitable provider found for repository: ${repoUrl}` };
    }

    try {
      const results = await Promise.allSettled([
        provider.fetchRepoMetadata(repoUrl),
        provider.getBranches ? provider.getBranches(repoUrl) : Promise.resolve([]),
        provider.getTags ? provider.getTags(repoUrl) : Promise.resolve([]),
        provider.getContributors ? provider.getContributors(repoUrl) : Promise.resolve([])
      ]);

      const metadata = results[0].status === 'fulfilled' ? results[0].value : undefined;
      const branches = results[1].status === 'fulfilled' ? results[1].value : [];
      const tags = results[2].status === 'fulfilled' ? results[2].value : [];
      const contributors = results[3].status === 'fulfilled' ? results[3].value : [];

      // Perform analysis
      let analysis;
      if (metadata) {
        const lastActivity = new Date(metadata.lastCommit.timestamp);
        const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        
        analysis = {
          isActive: daysSinceActivity < 365,
          hasRecentActivity: daysSinceActivity < 30,
          primaryLanguage: metadata.common?.language,
          estimatedSize: metadata.common?.size ? this.formatSize(metadata.common.size) : undefined,
          securityStatus: this.assessSecurityStatus(metadata, branches, tags)
        };
      }

      return {
        metadata,
        branches,
        tags,
        contributors,
        provider: provider.getName(),
        analysis
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to analyze repository ${repoUrl}:`, errorMessage);
      return { provider: provider.getName(), error: errorMessage };
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatSize(sizeInKB: number): string {
    if (sizeInKB < 1024) return `${sizeInKB} KB`;
    if (sizeInKB < 1024 * 1024) return `${(sizeInKB / 1024).toFixed(1)} MB`;
    return `${(sizeInKB / (1024 * 1024)).toFixed(1)} GB`;
  }

  /**
   * Assess basic security posture of a repository
   */
  private assessSecurityStatus(metadata: RepositoryMetadata, branches: string[], tags: string[]): string {
    const issues: string[] = [];
    
    if (!metadata.common?.license) {
      issues.push('No license specified');
    }
    
    if (branches.length === 1 && branches[0] === metadata.defaultBranch) {
      issues.push('No development branches');
    }
    
    if (tags.length === 0) {
      issues.push('No releases/tags');
    }
    
    if (metadata.lastCommit.timestamp) {
      const daysSinceLastCommit = Math.floor((Date.now() - new Date(metadata.lastCommit.timestamp).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLastCommit > 365) {
        issues.push('Inactive for over a year');
      }
    }
    
    if (issues.length === 0) return 'Good';
    if (issues.length <= 2) return 'Moderate';
    return 'Needs attention';
  }

  /**
   * Log provider status on initialization
   */
  private async logProviderStatus(): Promise<void> {
    const stats = this.getRegistryStatistics();
    this.logger.log(`SCM Provider Registry Status:`);
    this.logger.log(`- Total providers: ${stats.totalProviders}`);
    this.logger.log(`- Supported platforms: ${Object.keys(stats.providersByPlatform).join(', ')}`);
    this.logger.log(`- Supported hostnames: ${stats.supportedHostnames.join(', ')}`);

    if (stats.totalProviders > 0) {
      const healthResults = await this.performHealthChecks();
      const healthyProviders = Object.values(healthResults).filter(h => h.isHealthy).length;
      this.logger.log(`- Healthy providers: ${healthyProviders}/${stats.totalProviders}`);
    }
  }
} 