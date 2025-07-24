/**
 * SCM Platform Types
 */
export type ScmPlatform =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure-devops'
  | 'gitea'
  | 'forgejo'
  | 'codeberg'
  | 'generic';

/**
 * Repository Information Structure
 */
export interface RepositoryInfo {
  platform: ScmPlatform;
  hostname: string;
  owner: string;
  repository: string;
  fullName: string; // owner/repository
  originalUrl: string;
  isPrivate?: boolean;
}

/**
 * Enhanced Repository Metadata
 */
export interface RepositoryMetadata {
  name: string;
  description: string;
  defaultBranch: string;
  lastCommit: {
    hash: string;
    timestamp: string;
    message?: string;
    author?: string;
  };
  // Platform-specific metadata
  platform?: {
    [key: string]: any;
  };
  // Common metadata across platforms
  common?: {
    visibility?: 'public' | 'private' | 'internal';
    forksCount?: number;
    starsCount?: number;
    issuesCount?: number;
    language?: string;
    license?: string;
    topics?: string[];
    size?: number;
    contributorCount?: number;
    createdAt?: string;
    updatedAt?: string;
    pushedAt?: string;
    webUrl?: string;
    cloneUrl?: string;
    sshUrl?: string;
    archived?: boolean;
    disabled?: boolean;
  };
}

/**
 * Change Detection Result
 */
export interface ChangeDetectionResult {
  hasChanges: boolean;
  lastCommitHash: string;
  changeSummary?: {
    filesChanged: number;
    additions: number;
    deletions: number;
    commits: number;
    commitRange?: string;
  };
  error?: string;
}

/**
 * Authentication Configuration
 */
export interface ScmAuthConfig {
  token?: string;
  username?: string;
  password?: string;
  privateKey?: string;
  publicKey?: string;
  type: 'token' | 'basic' | 'ssh' | 'none';
}

/**
 * SCM Provider Configuration
 */
export interface ScmProviderConfig {
  name: string;
  platform: ScmPlatform;
  hostnames: string[]; // Supported hostnames for this provider
  apiBaseUrl?: string;
  supportsPrivateRepos: boolean;
  supportsApi: boolean;
  authentication?: ScmAuthConfig;
  rateLimit?: {
    requestsPerHour: number;
    burstLimit: number;
  };
}

/**
 * Enhanced SCM Provider Interface
 */
export interface ScmProvider {
  /**
   * Provider configuration and metadata
   */
  getConfig(): ScmProviderConfig;
  getName(): string;
  getPlatform(): ScmPlatform;
  getSupportedHostnames(): string[];

  /**
   * Repository URL parsing and validation
   */
  canHandle(repoUrl: string): boolean;
  parseRepositoryUrl(repoUrl: string): RepositoryInfo | null;
  normalizeRepositoryUrl(repoUrl: string): string;

  /**
   * Authentication management
   */
  configureAuthentication(config: ScmAuthConfig): void;
  isAuthenticated(): boolean;
  validateAuthentication(): Promise<boolean>;

  /**
   * Core repository operations
   */
  cloneRepository(
    repoUrl: string,
    targetPath: string,
    options?: CloneOptions,
  ): Promise<void>;
  fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata>;
  getLastCommitHash(repoUrl: string): Promise<string>;
  hasChangesSince(
    repoUrl: string,
    lastCommitHash: string,
  ): Promise<ChangeDetectionResult>;

  /**
   * Advanced repository operations (optional)
   */
  getBranches?(repoUrl: string): Promise<string[]>;
  getTags?(repoUrl: string): Promise<string[]>;
  getContributors?(repoUrl: string): Promise<Contributor[]>;
  searchRepositories?(query: string): Promise<SearchResult[]>;

  /**
   * Health and status
   */
  healthCheck(): Promise<ProviderHealthStatus>;
  getApiStatus?(): Promise<ApiStatus>;
}

/**
 * Clone Options
 */
export interface CloneOptions {
  depth?: number;
  branch?: string;
  singleBranch?: boolean;
  recursive?: boolean;
  timeout?: number;
}

/**
 * Contributor Information
 */
export interface Contributor {
  name: string;
  email?: string;
  username?: string;
  avatarUrl?: string;
  contributions: number;
  type?: 'user' | 'bot';
}

/**
 * Search Result
 */
export interface SearchResult {
  name: string;
  fullName: string;
  description: string;
  url: string;
  isPrivate: boolean;
  language?: string;
  stars: number;
  forks: number;
  updatedAt: string;
}

/**
 * Provider Health Status
 */
export interface ProviderHealthStatus {
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: string;
  error?: string;
  apiAvailable?: boolean;
  authenticationValid?: boolean;
}

/**
 * API Status
 */
export interface ApiStatus {
  available: boolean;
  version?: string;
  rateLimit?: {
    remaining: number;
    total: number;
    resetTime: string;
  };
  features?: string[];
  error?: string;
}

/**
 * SCM Provider Registry Interface
 */
export interface ScmProviderRegistry {
  registerProvider(provider: ScmProvider): void;
  unregisterProvider(name: string): void;
  getProvider(name: string): ScmProvider | null;
  getProviderForUrl(repoUrl: string): ScmProvider | null;
  getAllProviders(): ScmProvider[];
  getAvailableProviders(): Promise<ScmProvider[]>;
  getProvidersByPlatform(platform: ScmPlatform): ScmProvider[];
}

/**
 * Abstract Base SCM Provider
 */
export abstract class BaseScmProvider implements ScmProvider {
  protected config: ScmProviderConfig;
  protected authConfig?: ScmAuthConfig;

  constructor(config: ScmProviderConfig) {
    this.config = config;
  }

  // Required implementations
  abstract cloneRepository(
    repoUrl: string,
    targetPath: string,
    options?: CloneOptions,
  ): Promise<void>;
  abstract fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata>;
  abstract getLastCommitHash(repoUrl: string): Promise<string>;
  abstract hasChangesSince(
    repoUrl: string,
    lastCommitHash: string,
  ): Promise<ChangeDetectionResult>;

  // Default implementations
  getConfig(): ScmProviderConfig {
    return this.config;
  }

  getName(): string {
    return this.config.name;
  }

  getPlatform(): ScmPlatform {
    return this.config.platform;
  }

  getSupportedHostnames(): string[] {
    return this.config.hostnames;
  }

  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return this.config.hostnames.some(
        (hostname) =>
          url.hostname === hostname || url.hostname.includes(hostname),
      );
    } catch {
      return false;
    }
  }

  parseRepositoryUrl(repoUrl: string): RepositoryInfo | null {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repository = pathParts[1].replace('.git', '');

        return {
          platform: this.config.platform,
          hostname: url.hostname,
          owner,
          repository,
          fullName: `${owner}/${repository}`,
          originalUrl: repoUrl,
        };
      }
    } catch {
      // Invalid URL
    }
    return null;
  }

  normalizeRepositoryUrl(repoUrl: string): string {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo) return repoUrl;

    return `https://${repoInfo.hostname}/${repoInfo.fullName}`;
  }

  configureAuthentication(config: ScmAuthConfig): void {
    this.authConfig = config;
  }

  isAuthenticated(): boolean {
    return !!this.authConfig?.token || !!this.authConfig?.username;
  }

  async validateAuthentication(): Promise<boolean> {
    if (!this.isAuthenticated()) return false;

    try {
      // Default implementation - can be overridden by specific providers
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      // Basic health check - can be enhanced by specific providers
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: true,
        responseTime,
        lastChecked: new Date().toISOString(),
        authenticationValid: await this.validateAuthentication(),
      };
    } catch (error) {
      return {
        isHealthy: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        authenticationValid: false,
      };
    }
  }
}
