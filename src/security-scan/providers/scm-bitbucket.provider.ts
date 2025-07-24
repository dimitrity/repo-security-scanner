import { Injectable, Logger } from '@nestjs/common';
import { EnhancedGitScmProvider } from './scm-git-enhanced.provider';
import { 
  RepositoryMetadata, 
  RepositoryInfo, 
  ApiStatus, 
  Contributor,
  SearchResult,
  ProviderHealthStatus 
} from '../interfaces/scm.interface';

/**
 * Bitbucket-specific SCM Provider
 */
@Injectable()
export class BitbucketScmProvider extends EnhancedGitScmProvider {
  private readonly apiBaseUrl = 'https://api.bitbucket.org/2.0';

  constructor() {
    super();
    this.config = {
      name: 'Bitbucket Provider',
      platform: 'bitbucket',
      hostnames: ['bitbucket.org', 'www.bitbucket.org'],
      apiBaseUrl: 'https://api.bitbucket.org/2.0',
      supportsPrivateRepos: true,
      supportsApi: true,
      authentication: {
        type: 'token'
      },
      rateLimit: {
        requestsPerHour: 1000, // Bitbucket rate limits
        burstLimit: 60
      }
    };
  }

  /**
   * Bitbucket-specific URL validation
   */
  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return url.hostname === 'bitbucket.org' || url.hostname === 'www.bitbucket.org';
    } catch {
      return false;
    }
  }

  /**
   * Parse Bitbucket repository URL to extract owner and repo name
   */
  parseRepositoryUrl(repoUrl: string): RepositoryInfo | null {
    try {
      const url = new URL(repoUrl);
      if (!this.canHandle(repoUrl)) {
        return null;
      }

      // Bitbucket URL pattern: https://bitbucket.org/owner/repo
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      
      if (pathParts.length < 2) {
        return null;
      }

      const [owner, repo] = pathParts;
      const cleanRepo = repo.replace(/\.git$/, ''); // Remove .git suffix if present

      return {
        platform: 'bitbucket',
        hostname: url.hostname,
        owner,
        repository: cleanRepo,
        fullName: `${owner}/${cleanRepo}`,
        originalUrl: repoUrl
      };
    } catch (error) {
      this.logger.error(`Failed to parse Bitbucket URL: ${repoUrl}`, error);
      return null;
    }
  }

  /**
   * Fetch repository metadata from Bitbucket API
   */
  async fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo) {
      throw new Error(`Invalid Bitbucket repository URL: ${repoUrl}`);
    }

    try {
      // Try API first if authenticated
      if (this.isAuthenticated()) {
        return await this.fetchMetadataFromApi(repoInfo);
      }

      // Fallback to basic metadata from URL parsing
      return this.createBasicMetadata(repoInfo);
    } catch (error) {
      this.logger.warn(`Bitbucket API failed, using basic metadata: ${error.message}`);
      return this.createBasicMetadata(repoInfo);
    }
  }

  /**
   * Fetch metadata from Bitbucket API
   */
  private async fetchMetadataFromApi(repoInfo: RepositoryInfo): Promise<RepositoryMetadata> {
    const apiUrl = `${this.apiBaseUrl}/repositories/${repoInfo.owner}/${repoInfo.repository}`;
    const response = await fetch(apiUrl, {
      headers: this.getApiHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Bitbucket API authentication failed');
      }
      if (response.status === 404) {
        throw new Error('Repository not found on Bitbucket');
      }
      throw new Error(`Bitbucket API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Get latest commit from separate API call
    let lastCommit = {
      hash: 'unknown',
      timestamp: new Date().toISOString(),
      author: 'unknown',
      message: 'Unknown commit'
    };

    try {
      const commitsResponse = await fetch(`${apiUrl}/commits?pagelen=1`, {
        headers: this.getApiHeaders(),
      });
      
      if (commitsResponse.ok) {
        const commitsData = await commitsResponse.json();
        if (commitsData.values && commitsData.values.length > 0) {
          const commit = commitsData.values[0];
          lastCommit = {
            hash: commit.hash,
            timestamp: commit.date,
            author: commit.author?.display_name || commit.author?.raw || 'unknown',
            message: commit.message || 'No commit message'
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch Bitbucket commits: ${error.message}`);
    }

    return {
      name: data.name,
      description: data.description || 'No description provided',
      defaultBranch: data.mainbranch?.name || 'main',
      lastCommit,
      // Platform-specific metadata
      platform: {
        bitbucket: {
          id: data.uuid,
          fullName: data.full_name,
          isPrivate: data.is_private,
          language: data.language,
          size: data.size,
          createdAt: data.created_on,
          updatedAt: data.updated_on,
          hasIssues: data.has_issues,
          hasWiki: data.has_wiki,
          forksCount: data.fork_policy ? 1 : 0, // Bitbucket doesn't provide fork count directly
          watchersCount: 0, // Not available in Bitbucket API v2.0
          webUrl: data.links?.html?.href || `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repository}`,
          cloneUrl: data.links?.clone?.find((link: any) => link.name === 'https')?.href || `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repository}.git`,
          sshUrl: data.links?.clone?.find((link: any) => link.name === 'ssh')?.href,
          owner: {
            username: data.owner?.username || repoInfo.owner,
            displayName: data.owner?.display_name || repoInfo.owner,
            type: data.owner?.type || 'user',
            uuid: data.owner?.uuid
          }
        }
      },
      // Common metadata
      common: {
        language: data.language,
        size: data.size,
        visibility: data.is_private ? 'private' : 'public',
        createdAt: data.created_on,
        updatedAt: data.updated_on,
        webUrl: data.links?.html?.href || `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repository}`
      }
    };
  }

  /**
   * Create basic metadata when API is not available
   */
  private createBasicMetadata(repoInfo: RepositoryInfo): RepositoryMetadata {
    return {
      name: repoInfo.repository,
      description: 'Repository metadata unavailable (no API access)',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'unknown',
        timestamp: new Date().toISOString(),
        author: 'unknown',
        message: 'Commit information unavailable'
      },
      common: {
        webUrl: `https://bitbucket.org/${repoInfo.owner}/${repoInfo.repository}`
      }
    };
  }

  /**
   * Get API headers for authenticated requests
   */
  private getApiHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'User-Agent': 'Repository-Security-Scanner/1.0'
    };

    if (this.authConfig?.token) {
      // Bitbucket uses App passwords or OAuth2
      headers['Authorization'] = `Bearer ${this.authConfig.token}`;
    }

    return headers;
  }

  /**
   * Get repository branches
   */
  async getBranches(repoUrl: string): Promise<string[]> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo || !this.isAuthenticated()) {
      return [];
    }

    try {
      const apiUrl = `${this.apiBaseUrl}/repositories/${repoInfo.owner}/${repoInfo.repository}/refs/branches`;
      const response = await fetch(apiUrl, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.values?.map((branch: any) => branch.name) || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch Bitbucket branches: ${error.message}`);
      return [];
    }
  }

  /**
   * Get repository tags
   */
  async getTags(repoUrl: string): Promise<string[]> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo || !this.isAuthenticated()) {
      return [];
    }

    try {
      const apiUrl = `${this.apiBaseUrl}/repositories/${repoInfo.owner}/${repoInfo.repository}/refs/tags`;
      const response = await fetch(apiUrl, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.values?.map((tag: any) => tag.name) || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch Bitbucket tags: ${error.message}`);
      return [];
    }
  }

  /**
   * Get repository contributors
   */
  async getContributors(repoUrl: string): Promise<Contributor[]> {
    // Bitbucket API v2.0 doesn't have a direct contributors endpoint
    // We would need to aggregate from commits, which is expensive
    return [];
  }

  /**
   * Search repositories on Bitbucket
   */
  async searchRepositories(query: string): Promise<SearchResult[]> {
    if (!this.isAuthenticated()) {
      return [];
    }

    try {
      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(`${this.apiBaseUrl}/repositories?q=name~"${encodedQuery}"`, {
        headers: this.getApiHeaders(),
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.values?.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.links?.html?.href || '',
        language: repo.language,
        stars: 0, // Not available in Bitbucket API v2.0
        forks: 0,  // Not directly available
        isPrivate: repo.is_private,
        updatedAt: repo.updated_on
      })) || [];
    } catch (error) {
      this.logger.warn(`Failed to search Bitbucket repositories: ${error.message}`);
      return [];
    }
  }

  /**
   * Check API status
   */
  async getApiStatus(): Promise<ApiStatus> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/user`, {
        headers: this.getApiHeaders(),
      });

      return {
        available: response.ok,
        rateLimit: {
          remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
          total: parseInt(response.headers.get('X-RateLimit-Limit') || '1000'),
          resetTime: response.headers.get('X-RateLimit-Reset') || new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }

  /**
   * Health check for Bitbucket provider
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const start = Date.now();
    
    try {
      const apiStatus = await this.getApiStatus();
      const responseTime = Date.now() - start;

      return {
        isHealthy: apiStatus.available,
        responseTime,
        lastChecked: new Date().toISOString(),
        apiAvailable: apiStatus.available,
        authenticationValid: this.isAuthenticated() && apiStatus.available
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: Date.now() - start,
        lastChecked: new Date().toISOString(),
        error: error.message,
        apiAvailable: false,
        authenticationValid: false
      };
    }
  }
} 