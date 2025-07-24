import { Injectable, Logger } from '@nestjs/common';
import { 
  ScmProvider, 
  ScmProviderRegistry, 
  ScmPlatform, 
  ProviderHealthStatus 
} from '../interfaces/scm.interface';

/**
 * Registry for managing multiple SCM providers
 */
@Injectable()
export class ScmProviderRegistryService implements ScmProviderRegistry {
  private readonly logger = new Logger(ScmProviderRegistryService.name);
  private providers = new Map<string, ScmProvider>();
  private platformProviders = new Map<ScmPlatform, ScmProvider[]>();
  private hostnameProviders = new Map<string, ScmProvider[]>();

  /**
   * Register a new SCM provider
   */
  registerProvider(provider: ScmProvider): void {
    const name = provider.getName();
    const platform = provider.getPlatform();
    const hostnames = provider.getSupportedHostnames();

    // Register by name
    this.providers.set(name, provider);

    // Register by platform
    if (!this.platformProviders.has(platform)) {
      this.platformProviders.set(platform, []);
    }
    this.platformProviders.get(platform)!.push(provider);

    // Register by hostname
    hostnames.forEach(hostname => {
      if (!this.hostnameProviders.has(hostname)) {
        this.hostnameProviders.set(hostname, []);
      }
      this.hostnameProviders.get(hostname)!.push(provider);
    });

    this.logger.log(`Registered SCM provider: ${name} (${platform}) - Hostnames: ${hostnames.join(', ')}`);
  }

  /**
   * Unregister an SCM provider
   */
  unregisterProvider(name: string): void {
    const provider = this.providers.get(name);
    if (!provider) {
      this.logger.warn(`Provider ${name} not found for unregistration`);
      return;
    }

    const platform = provider.getPlatform();
    const hostnames = provider.getSupportedHostnames();

    // Remove from name registry
    this.providers.delete(name);

    // Remove from platform registry
    const platformProvidersList = this.platformProviders.get(platform);
    if (platformProvidersList) {
      const index = platformProvidersList.findIndex(p => p.getName() === name);
      if (index >= 0) {
        platformProvidersList.splice(index, 1);
      }
      if (platformProvidersList.length === 0) {
        this.platformProviders.delete(platform);
      }
    }

    // Remove from hostname registry
    hostnames.forEach(hostname => {
      const hostnameProvidersList = this.hostnameProviders.get(hostname);
      if (hostnameProvidersList) {
        const index = hostnameProvidersList.findIndex(p => p.getName() === name);
        if (index >= 0) {
          hostnameProvidersList.splice(index, 1);
        }
        if (hostnameProvidersList.length === 0) {
          this.hostnameProviders.delete(hostname);
        }
      }
    });

    this.logger.log(`Unregistered SCM provider: ${name}`);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): ScmProvider | null {
    return this.providers.get(name) || null;
  }

  /**
   * Get the best provider for a repository URL
   */
  getProviderForUrl(repoUrl: string): ScmProvider | null {
    try {
      const url = new URL(repoUrl);
      const hostname = url.hostname;

      // First, try exact hostname match
      const exactMatches = this.hostnameProviders.get(hostname);
      if (exactMatches && exactMatches.length > 0) {
        // Return the first provider that can handle this URL
        const capableProvider = exactMatches.find(provider => provider.canHandle(repoUrl));
        if (capableProvider) {
          this.logger.log(`Found exact hostname match for ${repoUrl}: ${capableProvider.getName()}`);
          return capableProvider;
        }
      }

      // Second, try partial hostname matching
      for (const [registeredHostname, providers] of this.hostnameProviders.entries()) {
        if (hostname.includes(registeredHostname) || registeredHostname.includes(hostname)) {
          const capableProvider = providers.find(provider => provider.canHandle(repoUrl));
          if (capableProvider) {
            this.logger.log(`Found partial hostname match for ${repoUrl}: ${capableProvider.getName()}`);
            return capableProvider;
          }
        }
      }

      // Third, ask all providers if they can handle this URL
      for (const provider of this.providers.values()) {
        if (provider.canHandle(repoUrl)) {
          this.logger.log(`Found capable provider for ${repoUrl}: ${provider.getName()}`);
          return provider;
        }
      }

      this.logger.warn(`No provider found for URL: ${repoUrl}`);
      return null;
    } catch (error) {
      this.logger.error(`Error finding provider for URL ${repoUrl}:`, error);
      return null;
    }
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): ScmProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get all healthy/available providers
   */
  async getAvailableProviders(): Promise<ScmProvider[]> {
    const providers = this.getAllProviders();
    const availableProviders: ScmProvider[] = [];

    await Promise.all(
      providers.map(async (provider) => {
        try {
          const health = await provider.healthCheck();
          if (health.isHealthy) {
            availableProviders.push(provider);
          }
        } catch (error) {
          this.logger.warn(`Health check failed for provider ${provider.getName()}:`, error);
        }
      })
    );

    return availableProviders;
  }

  /**
   * Get providers by platform
   */
  getProvidersByPlatform(platform: ScmPlatform): ScmProvider[] {
    return this.platformProviders.get(platform) || [];
  }

  /**
   * Get registry statistics
   */
  getRegistryStats(): {
    totalProviders: number;
    providersByPlatform: Record<ScmPlatform, number>;
    supportedHostnames: string[];
  } {
    const providersByPlatform: Record<ScmPlatform, number> = {} as Record<ScmPlatform, number>;
    
    for (const [platform, providers] of this.platformProviders.entries()) {
      providersByPlatform[platform] = providers.length;
    }

    return {
      totalProviders: this.providers.size,
      providersByPlatform,
      supportedHostnames: Array.from(this.hostnameProviders.keys()),
    };
  }

  /**
   * Perform health checks on all providers
   */
  async performHealthChecks(): Promise<Record<string, ProviderHealthStatus>> {
    const results: Record<string, ProviderHealthStatus> = {};
    
    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        try {
          results[name] = await provider.healthCheck();
        } catch (error) {
          results[name] = {
            isHealthy: false,
            lastChecked: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    return results;
  }

  /**
   * List supported platforms
   */
  getSupportedPlatforms(): ScmPlatform[] {
    return Array.from(this.platformProviders.keys());
  }

  /**
   * Check if a platform is supported
   */
  isPlatformSupported(platform: ScmPlatform): boolean {
    return this.platformProviders.has(platform);
  }

  /**
   * Check if a hostname is supported
   */
  isHostnameSupported(hostname: string): boolean {
    return this.hostnameProviders.has(hostname) || 
           Array.from(this.hostnameProviders.keys()).some(registeredHostname => 
             hostname.includes(registeredHostname) || registeredHostname.includes(hostname)
           );
  }

  /**
   * Get provider recommendations for a URL
   */
  getProviderRecommendations(repoUrl: string): {
    primary: ScmProvider | null;
    alternatives: ScmProvider[];
    reasons: string[];
  } {
    const primary = this.getProviderForUrl(repoUrl);
    const alternatives: ScmProvider[] = [];
    const reasons: string[] = [];

    try {
      const url = new URL(repoUrl);
      const hostname = url.hostname;

      // Find alternative providers
      for (const provider of this.providers.values()) {
        if (provider !== primary && provider.canHandle(repoUrl)) {
          alternatives.push(provider);
        }
      }

      // Add reasoning
      if (primary) {
        reasons.push(`Primary: ${primary.getName()} - Direct hostname match or capability`);
      } else {
        reasons.push('No primary provider found - URL may not be supported');
      }

      if (alternatives.length > 0) {
        reasons.push(`Alternatives: ${alternatives.map(p => p.getName()).join(', ')}`);
      }

      if (!this.isHostnameSupported(hostname)) {
        reasons.push(`Warning: Hostname ${hostname} is not explicitly supported`);
      }

    } catch (error) {
      reasons.push(`Error analyzing URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { primary, alternatives, reasons };
  }

  /**
   * Clear all providers (mainly for testing)
   */
  clearAllProviders(): void {
    this.providers.clear();
    this.platformProviders.clear();
    this.hostnameProviders.clear();
    this.logger.log('Cleared all SCM providers from registry');
  }
} 