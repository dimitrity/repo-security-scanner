# 🏗️ SCM Abstraction Layer

## Overview

The Repository Security Scanner now features a comprehensive **Source Control Management (SCM) Abstraction Layer** that provides a pluggable architecture for supporting multiple SCM platforms. This abstraction makes it easy to add new SCM providers, configure authentication, and manage multi-platform repositories.

## 🚀 Key Features

### ✅ **Multi-Provider Support**
- **GitHub**: Full API integration with authentication
- **GitLab**: Self-hosted and GitLab.com support with enhanced metadata
- **Generic Git**: Fallback support for any Git repository
- **Extensible**: Easy to add new providers (Bitbucket, Azure DevOps, Gitea, etc.)

### ✅ **Intelligent Provider Selection**
- **Automatic Detection**: Best provider automatically selected based on repository URL
- **Provider Ranking**: Specific providers preferred over generic ones
- **Fallback Support**: Graceful degradation when preferred providers fail

### ✅ **Enhanced Authentication**
- **Multiple Auth Types**: Token, Basic Auth, SSH keys
- **Platform-Specific**: Each provider handles authentication optimally
- **Environment Integration**: Automatic configuration from environment variables

### ✅ **Comprehensive Metadata**
- **Platform-Specific Data**: Repository stats, settings, contributor info
- **Unified Interface**: Common metadata structure across all platforms
- **API Integration**: Enhanced data when API access is available

## 🏛️ Architecture

### Core Components

```mermaid
graph TB
    Client[Security Scan Service] --> Manager[SCM Manager Service]
    Manager --> Registry[Provider Registry]
    Registry --> GitHub[GitHub Provider]
    Registry --> GitLab[GitLab Provider]
    Registry --> Generic[Enhanced Git Provider]
    
    GitHub --> GitHubAPI[GitHub API]
    GitLab --> GitLabAPI[GitLab API]
    Generic --> GitCMD[Git Commands]
    
    Manager --> Auth[Authentication Config]
    Manager --> Health[Health Monitoring]
```

### Interface Hierarchy

```typescript
// Base interface implemented by all providers
interface ScmProvider {
  // Provider information
  getConfig(): ScmProviderConfig;
  canHandle(repoUrl: string): boolean;
  
  // Core operations
  cloneRepository(repoUrl, targetPath, options?): Promise<void>;
  fetchRepoMetadata(repoUrl): Promise<RepositoryMetadata>;
  hasChangesSince(repoUrl, commitHash): Promise<ChangeDetectionResult>;
  
  // Authentication
  configureAuthentication(config: ScmAuthConfig): void;
  validateAuthentication(): Promise<boolean>;
  
  // Health monitoring
  healthCheck(): Promise<ProviderHealthStatus>;
}

// Abstract base class with common functionality
abstract class BaseScmProvider implements ScmProvider {
  // Common implementations for URL parsing, authentication, etc.
}

// Specific provider implementations
class GitHubScmProvider extends BaseScmProvider { /* GitHub-specific logic */ }
class GitLabScmProvider extends BaseScmProvider { /* GitLab-specific logic */ }
class EnhancedGitScmProvider extends BaseScmProvider { /* Generic Git logic */ }
```

## 🔧 Adding New SCM Providers

### Step 1: Create Provider Class

```typescript
import { Injectable } from '@nestjs/common';
import { BaseScmProvider } from './scm-git-enhanced.provider';
import { RepositoryMetadata, RepositoryInfo } from '../interfaces/scm.interface';

@Injectable()
export class BitbucketScmProvider extends BaseScmProvider {
  constructor() {
    super({
      name: 'Bitbucket Provider',
      platform: 'bitbucket',
      hostnames: ['bitbucket.org', 'bitbucket.com'],
      apiBaseUrl: 'https://api.bitbucket.org/2.0',
      supportsPrivateRepos: true,
      supportsApi: true,
      authentication: { type: 'token' }
    });
  }

  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return url.hostname.includes('bitbucket.org');
    } catch {
      return false;
    }
  }

  async fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    // Implement Bitbucket API integration
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    // ... API calls and data transformation
  }

  // Implement other required methods
}
```

### Step 2: Register Provider

```typescript
// In security-scan.module.ts
@Module({
  providers: [
    // ... existing providers
    BitbucketScmProvider,
    {
      provide: 'SCM_PROVIDERS_SETUP',
      useFactory: (registry, bitbucketProvider /* other providers */) => {
        // Register the new provider
        registry.registerProvider(bitbucketProvider);
        
        // Configure authentication
        const bitbucketToken = process.env.BITBUCKET_TOKEN;
        if (bitbucketToken) {
          bitbucketProvider.configureAuthentication({
            type: 'token',
            token: bitbucketToken
          });
        }
        
        return registry;
      },
      inject: [ScmProviderRegistryService, BitbucketScmProvider /* others */]
    }
  ]
})
```

### Step 3: Add Environment Configuration

```typescript
// docker-compose.yml
environment:
  - BITBUCKET_TOKEN=${BITBUCKET_TOKEN:-}

// README.md
| `BITBUCKET_TOKEN` | Bitbucket App Password | - | No |
```

## 📚 Usage Examples

### Basic Repository Operations

```typescript
import { ScmManagerService } from './providers/scm-manager.service';

@Injectable()
export class MyService {
  constructor(private readonly scmManager: ScmManagerService) {}

  async analyzeRepository(repoUrl: string) {
    // Clone repository
    const cloneResult = await this.scmManager.cloneRepository(repoUrl, '/tmp/repo');
    console.log(`Cloned using: ${cloneResult.provider}`);

    // Get metadata
    const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
    console.log(`Repository: ${metadataResult.metadata?.name}`);

    // Check for changes
    const changesResult = await this.scmManager.hasChangesSince(repoUrl, 'abc123');
    console.log(`Has changes: ${changesResult.result?.hasChanges}`);
  }
}
```

### Provider Management

```typescript
// Get provider recommendations
const recommendations = scmManager.getProviderRecommendations(repoUrl);
console.log(`Primary: ${recommendations.primary?.getName()}`);
console.log(`Alternatives: ${recommendations.alternatives.map(p => p.getName())}`);

// Check provider health
const healthResults = await scmManager.performHealthChecks();
Object.entries(healthResults).forEach(([name, health]) => {
  console.log(`${name}: ${health.isHealthy ? 'Healthy' : 'Unhealthy'}`);
});

// Get registry statistics
const stats = scmManager.getRegistryStatistics();
console.log(`Total providers: ${stats.totalProviders}`);
console.log(`Supported platforms: ${Object.keys(stats.providersByPlatform)}`);
```

### Authentication Configuration

```typescript
// Configure GitHub authentication
scmManager.configureAuthentication('GitHub Provider', {
  type: 'token',
  token: 'ghp_your_token_here'
});

// Configure authentication for all GitLab providers
scmManager.configurePlatformAuthentication('gitlab', {
  type: 'token',
  token: 'glpat_your_token_here'
});
```

### Advanced Repository Analysis

```typescript
const analysis = await scmManager.analyzeRepository(repoUrl);

console.log(`Repository: ${analysis.metadata?.name}`);
console.log(`Branches: ${analysis.branches?.length}`);
console.log(`Contributors: ${analysis.contributors?.length}`);
console.log(`Primary language: ${analysis.analysis?.primaryLanguage}`);
console.log(`Security status: ${analysis.analysis?.securityStatus}`);
```

## 🔐 Authentication Configuration

### Environment Variables

| Variable | Provider | Description | Example |
|----------|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub | Personal Access Token | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| `GITLAB_TOKEN` | GitLab | Personal Access Token | `glpat-xxxxxxxxxxxxxxxxxxxx` |
| `GITLAB_ACCESS_TOKEN` | GitLab | Alternative token variable | `glpat-xxxxxxxxxxxxxxxxxxxx` |
| `BITBUCKET_TOKEN` | Bitbucket | App Password | `your-app-password` |

### Authentication Types

```typescript
interface ScmAuthConfig {
  type: 'token' | 'basic' | 'ssh' | 'none';
  token?: string;           // For token authentication
  username?: string;        // For basic authentication
  password?: string;        // For basic authentication
  privateKey?: string;      // For SSH authentication
  publicKey?: string;       // For SSH authentication
}
```

### Provider-Specific Authentication

#### GitHub
```bash
# Create token at: https://github.com/settings/tokens
export GITHUB_TOKEN=ghp_your_token_here
```

#### GitLab
```bash
# Create token at: https://gitlab.com/-/profile/personal_access_tokens
export GITLAB_TOKEN=glpat-your-token-here
```

#### Self-hosted GitLab
```bash
# For self-hosted instances
export GITLAB_TOKEN=glpat-your-token-here
# Repository URL: https://gitlab.company.com/team/project
```

## 🏥 Health Monitoring

### Provider Health Checks

```typescript
// Individual provider health
const provider = scmManager.getProvider('GitHub Provider');
const health = await provider.healthCheck();

console.log(`Provider: ${provider.getName()}`);
console.log(`Healthy: ${health.isHealthy}`);
console.log(`Response time: ${health.responseTime}ms`);
console.log(`API available: ${health.apiAvailable}`);
console.log(`Auth valid: ${health.authenticationValid}`);
```

### Registry Health Dashboard

```typescript
const healthResults = await scmManager.performHealthChecks();

// Generate health report
const healthReport = Object.entries(healthResults).map(([name, health]) => ({
  provider: name,
  status: health.isHealthy ? 'Healthy' : 'Unhealthy',
  responseTime: health.responseTime,
  lastChecked: health.lastChecked,
  error: health.error
}));

console.table(healthReport);
```

## 📊 Monitoring and Observability

### Registry Statistics

```typescript
const stats = scmManager.getRegistryStatistics();

console.log(`Registry Statistics:`);
console.log(`- Total providers: ${stats.totalProviders}`);
console.log(`- Platforms: ${Object.keys(stats.providersByPlatform).join(', ')}`);
console.log(`- Hostnames: ${stats.supportedHostnames.join(', ')}`);

// Provider breakdown by platform
Object.entries(stats.providersByPlatform).forEach(([platform, count]) => {
  console.log(`- ${platform}: ${count} provider(s)`);
});
```

### Provider Selection Analytics

```typescript
// Log provider usage for analytics
const trackProviderUsage = (repoUrl: string) => {
  const recommendations = scmManager.getProviderRecommendations(repoUrl);
  
  console.log(`Repository: ${repoUrl}`);
  console.log(`Selected provider: ${recommendations.primary?.getName()}`);
  console.log(`Selection reasons: ${recommendations.reasons.join(', ')}`);
  
  // Track metrics
  // analytics.track('provider.selected', {
  //   provider: recommendations.primary?.getName(),
  //   platform: recommendations.primary?.getPlatform(),
  //   hasAlternatives: recommendations.alternatives.length > 0
  // });
};
```

## 🧪 Testing New Providers

### Unit Testing

```typescript
// bitbucket-provider.spec.ts
describe('BitbucketScmProvider', () => {
  let provider: BitbucketScmProvider;

  beforeEach(() => {
    provider = new BitbucketScmProvider();
  });

  it('should handle Bitbucket URLs', () => {
    expect(provider.canHandle('https://bitbucket.org/user/repo')).toBe(true);
    expect(provider.canHandle('https://github.com/user/repo')).toBe(false);
  });

  it('should parse Bitbucket repository info', () => {
    const repoInfo = provider.parseRepositoryUrl('https://bitbucket.org/atlassian/bitbucket');
    expect(repoInfo?.platform).toBe('bitbucket');
    expect(repoInfo?.owner).toBe('atlassian');
    expect(repoInfo?.repository).toBe('bitbucket');
  });

  // Add more tests for authentication, metadata fetching, etc.
});
```

### Integration Testing

```typescript
// provider-integration.spec.ts
describe('Provider Integration', () => {
  let scmManager: ScmManagerService;

  it('should register and use new provider', async () => {
    const testProvider = new BitbucketScmProvider();
    scmManager.registerProvider(testProvider);

    const provider = scmManager.getProviderForUrl('https://bitbucket.org/user/repo');
    expect(provider?.getName()).toBe('Bitbucket Provider');
  });

  it('should handle provider priority correctly', () => {
    // Test that specific providers are preferred over generic ones
    const githubProvider = scmManager.getProviderForUrl('https://github.com/user/repo');
    expect(githubProvider?.getPlatform()).toBe('github');
  });
});
```

## 🔧 Configuration Options

### Provider Configuration

```typescript
interface ScmProviderConfig {
  name: string;                    // Provider display name
  platform: ScmPlatform;          // Platform type
  hostnames: string[];             // Supported hostnames
  apiBaseUrl?: string;             // API endpoint
  supportsPrivateRepos: boolean;   // Private repo support
  supportsApi: boolean;            // API availability
  authentication?: ScmAuthConfig;  // Auth requirements
  rateLimit?: {                    // Rate limiting info
    requestsPerHour: number;
    burstLimit: number;
  };
}
```

### Clone Options

```typescript
interface CloneOptions {
  depth?: number;         // Shallow clone depth
  branch?: string;        // Specific branch
  singleBranch?: boolean; // Single branch only
  recursive?: boolean;    // Include submodules
  timeout?: number;       // Clone timeout
}

// Usage
await scmManager.cloneRepository(repoUrl, targetPath, {
  depth: 1,
  branch: 'develop',
  singleBranch: true,
  timeout: 30000
});
```

## 🚀 Performance Optimization

### Provider Caching

```typescript
// Providers automatically cache repository metadata and authentication status
// Manual cache management (if needed):

const provider = scmManager.getProvider('GitHub Provider');
// Cache is managed internally - no manual intervention needed
```

### Bulk Operations

```typescript
// Clone multiple repositories efficiently
const repositories = [
  { url: 'https://github.com/user/repo1', targetPath: '/tmp/repo1' },
  { url: 'https://gitlab.com/user/repo2', targetPath: '/tmp/repo2' },
  { url: 'https://bitbucket.org/user/repo3', targetPath: '/tmp/repo3' }
];

const results = await scmManager.cloneMultipleRepositories(repositories);
results.forEach(result => {
  console.log(`${result.url}: ${result.success ? 'Success' : 'Failed'} (${result.provider})`);
});

// Fetch metadata for multiple repositories
const metadataResults = await scmManager.fetchMultipleRepositoryMetadata(urls);
```

## 🔮 Future Extensions

### Planned Providers
- **Azure DevOps**: Microsoft Azure Repos support
- **Gitea**: Self-hosted Git service
- **Forgejo**: Gitea fork with enhanced features
- **Codeberg**: European alternative to GitHub
- **SourceForge**: Legacy project hosting
- **Custom Git**: Enterprise Git solutions

### Advanced Features
- **Provider Plugins**: Runtime provider registration
- **Webhook Integration**: Real-time repository updates
- **Backup Providers**: Automatic failover between providers
- **Load Balancing**: Distribute requests across provider instances
- **Metrics Collection**: Detailed performance analytics

## 📝 Migration Guide

### From Old Git Provider

If you're migrating from the old `GitScmProvider`:

```typescript
// Before
constructor(private readonly gitProvider: GitScmProvider) {}

async scanRepo(repoUrl: string) {
  await this.gitProvider.cloneRepository(repoUrl, targetPath);
  const metadata = await this.gitProvider.fetchRepoMetadata(repoUrl);
}

// After  
constructor(private readonly scmManager: ScmManagerService) {}

async scanRepo(repoUrl: string) {
  const cloneResult = await this.scmManager.cloneRepository(repoUrl, targetPath);
  const metadataResult = await this.scmManager.fetchRepositoryMetadata(repoUrl);
  const metadata = metadataResult.metadata;
}
```

### Configuration Updates

```typescript
// No configuration changes needed - authentication is automatically 
// configured from environment variables (GITHUB_TOKEN, GITLAB_TOKEN, etc.)
```

---

The SCM Abstraction Layer provides a robust, extensible foundation for supporting multiple source control platforms while maintaining a simple, unified interface for the security scanning application. 