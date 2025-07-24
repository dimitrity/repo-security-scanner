import { Injectable, Logger } from '@nestjs/common';
import { EnhancedGitScmProvider } from './scm-git-enhanced.provider';
import {
  RepositoryMetadata,
  RepositoryInfo,
  ApiStatus,
  Contributor,
  SearchResult,
  ProviderHealthStatus,
} from '../interfaces/scm.interface';

/**
 * GitHub-specific SCM Provider
 */
@Injectable()
export class GitHubScmProvider extends EnhancedGitScmProvider {
  private readonly apiBaseUrl = 'https://api.github.com';

  constructor() {
    super();
    this.config = {
      name: 'GitHub Provider',
      platform: 'github',
      hostnames: ['github.com', 'www.github.com'],
      apiBaseUrl: 'https://api.github.com',
      supportsPrivateRepos: true,
      supportsApi: true,
      authentication: {
        type: 'token',
      },
      rateLimit: {
        requestsPerHour: 5000, // For authenticated requests
        burstLimit: 100,
      },
    };
  }

  /**
   * GitHub-specific URL validation
   */
  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return url.hostname === 'github.com' || url.hostname === 'www.github.com';
    } catch {
      return false;
    }
  }

  /**
   * Fetch metadata from GitHub API
   */
  protected async fetchFromApi(
    repoInfo: RepositoryInfo | null,
  ): Promise<RepositoryMetadata | null> {
    if (!repoInfo || repoInfo.platform !== 'github') {
      return null;
    }

    try {
      const headers = this.buildApiHeaders();
      const apiUrl = `${this.apiBaseUrl}/repos/${repoInfo.fullName}`;

      this.logger.log(`Fetching GitHub metadata from: ${apiUrl}`);

      const response = await fetch(apiUrl, { headers });

      if (!response.ok) {
        if (response.status === 401) {
          this.logger.warn(
            'GitHub API authentication failed - token may be invalid',
          );
        } else if (response.status === 403) {
          this.logger.warn(
            'GitHub API rate limit exceeded or repository is private',
          );
        } else if (response.status === 404) {
          this.logger.warn('GitHub repository not found');
        }
        return null;
      }

      const data = await response.json();

      // Get additional data if authenticated
      let additionalData = {};
      if (this.authConfig?.token) {
        additionalData = await this.fetchAdditionalGitHubData(
          repoInfo.fullName,
          headers,
        );
      }

      return {
        name: data.name,
        description: data.description || 'No description available',
        defaultBranch: data.default_branch || 'main',
        lastCommit: {
          hash: additionalData['lastCommitHash'] || 'latest',
          timestamp: data.updated_at || new Date().toISOString(),
          message: additionalData['lastCommitMessage'],
          author: additionalData['lastCommitAuthor'],
        },
        platform: {
          github: {
            id: data.id,
            nodeId: data.node_id,
            owner: {
              login: data.owner.login,
              id: data.owner.id,
              type: data.owner.type,
              avatarUrl: data.owner.avatar_url,
              url: data.owner.html_url,
            },
            fullName: data.full_name,
            isPrivate: data.private,
            htmlUrl: data.html_url,
            cloneUrl: data.clone_url,
            gitUrl: data.git_url,
            sshUrl: data.ssh_url,
            size: data.size,
            language: data.language,
            hasIssues: data.has_issues,
            hasProjects: data.has_projects,
            hasWiki: data.has_wiki,
            hasPages: data.has_pages,
            hasDownloads: data.has_downloads,
            archived: data.archived,
            disabled: data.disabled,
            openIssuesCount: data.open_issues_count,
            license: data.license?.name,
            allowForking: data.allow_forking,
            isTemplate: data.is_template,
            topics: data.topics || [],
            visibility: data.visibility,
            defaultBranch: data.default_branch,
            ...additionalData,
          },
        },
        common: {
          visibility: data.private ? 'private' : 'public',
          forksCount: data.forks_count,
          starsCount: data.stargazers_count,
          issuesCount: data.open_issues_count,
          language: data.language,
          license: data.license?.name,
          topics: data.topics || [],
          size: data.size,
          contributorCount: additionalData['contributorCount'],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          pushedAt: data.pushed_at,
          webUrl: data.html_url,
          cloneUrl: data.clone_url,
          sshUrl: data.ssh_url,
          archived: data.archived,
          disabled: data.disabled,
        },
      };
    } catch (error) {
      this.logger.warn('GitHub API fetch failed:', error);
      return null;
    }
  }

  /**
   * Build API headers with authentication
   */
  private buildApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Repository-Security-Scanner/1.0',
    };

    if (this.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.authConfig.token}`;
    }

    return headers;
  }

  /**
   * Fetch additional GitHub data for authenticated requests
   */
  private async fetchAdditionalGitHubData(
    fullName: string,
    headers: Record<string, string>,
  ): Promise<Record<string, any>> {
    const additionalData: Record<string, any> = {};

    try {
      // Get latest commit
      const commitsResponse = await fetch(
        `${this.apiBaseUrl}/repos/${fullName}/commits?per_page=1`,
        { headers },
      );
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        if (commits.length > 0) {
          const latestCommit = commits[0];
          additionalData.lastCommitHash = latestCommit.sha;
          additionalData.lastCommitMessage = latestCommit.commit.message;
          additionalData.lastCommitAuthor = latestCommit.commit.author.name;
          additionalData.lastCommitDate = latestCommit.commit.author.date;
        }
      }

      // Get contributors count
      const contributorsResponse = await fetch(
        `${this.apiBaseUrl}/repos/${fullName}/contributors?per_page=1`,
        { headers },
      );
      if (contributorsResponse.ok) {
        const linkHeader = contributorsResponse.headers.get('Link');
        if (linkHeader) {
          const lastPageMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
          if (lastPageMatch) {
            additionalData.contributorCount = parseInt(lastPageMatch[1]);
          }
        } else {
          // If no Link header, get the actual contributors
          const contributors = await contributorsResponse.json();
          additionalData.contributorCount = contributors.length;
        }
      }

      // Get release information
      const releasesResponse = await fetch(
        `${this.apiBaseUrl}/repos/${fullName}/releases/latest`,
        { headers },
      );
      if (releasesResponse.ok) {
        const latestRelease = await releasesResponse.json();
        additionalData.latestRelease = {
          tagName: latestRelease.tag_name,
          name: latestRelease.name,
          publishedAt: latestRelease.published_at,
          isPrerelease: latestRelease.prerelease,
        };
      }
    } catch (error) {
      this.logger.warn('Failed to fetch additional GitHub data:', error);
    }

    return additionalData;
  }

  /**
   * Get repository branches
   */
  async getBranches(repoUrl: string): Promise<string[]> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo) return [];

    try {
      const headers = this.buildApiHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/repos/${repoInfo.fullName}/branches`,
        { headers },
      );

      if (response.ok) {
        const branches = await response.json();
        return branches.map((branch: any) => branch.name);
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitHub branches:', error);
    }

    return [];
  }

  /**
   * Get repository tags
   */
  async getTags(repoUrl: string): Promise<string[]> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo) return [];

    try {
      const headers = this.buildApiHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/repos/${repoInfo.fullName}/tags`,
        { headers },
      );

      if (response.ok) {
        const tags = await response.json();
        return tags.map((tag: any) => tag.name);
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitHub tags:', error);
    }

    return [];
  }

  /**
   * Get repository contributors
   */
  async getContributors(repoUrl: string): Promise<Contributor[]> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    if (!repoInfo) return [];

    try {
      const headers = this.buildApiHeaders();
      const response = await fetch(
        `${this.apiBaseUrl}/repos/${repoInfo.fullName}/contributors`,
        { headers },
      );

      if (response.ok) {
        const contributors = await response.json();
        return contributors.map((contributor: any) => ({
          name: contributor.login,
          username: contributor.login,
          avatarUrl: contributor.avatar_url,
          contributions: contributor.contributions,
          type: contributor.type === 'Bot' ? 'bot' : 'user',
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitHub contributors:', error);
    }

    return [];
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string): Promise<SearchResult[]> {
    try {
      const headers = this.buildApiHeaders();
      const searchUrl = `${this.apiBaseUrl}/search/repositories?q=${encodeURIComponent(query)}`;
      const response = await fetch(searchUrl, { headers });

      if (response.ok) {
        const data = await response.json();
        return data.items.map((repo: any) => ({
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          url: repo.html_url,
          isPrivate: repo.private,
          language: repo.language,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          updatedAt: repo.updated_at,
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to search GitHub repositories:', error);
    }

    return [];
  }

  /**
   * Get GitHub API status
   */
  async getApiStatus(): Promise<ApiStatus> {
    try {
      const headers = this.buildApiHeaders();
      const response = await fetch(`${this.apiBaseUrl}/rate_limit`, {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          available: true,
          rateLimit: {
            remaining: data.rate.remaining,
            total: data.rate.limit,
            resetTime: new Date(data.rate.reset * 1000).toISOString(),
          },
          features: [
            'repositories',
            'commits',
            'branches',
            'tags',
            'contributors',
            'search',
          ],
        };
      }
    } catch (error) {
      this.logger.warn('Failed to get GitHub API status:', error);
    }

    return {
      available: false,
      error: 'Unable to connect to GitHub API',
    };
  }

  /**
   * Validate GitHub authentication
   */
  async validateAuthentication(): Promise<boolean> {
    if (!this.authConfig?.token) return false;

    try {
      const headers = this.buildApiHeaders();
      const response = await fetch(`${this.apiBaseUrl}/user`, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enhanced health check with GitHub-specific checks
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      // Check GitHub API availability
      const response = await fetch(`${this.apiBaseUrl}/zen`);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const authValid = await this.validateAuthentication();
        const apiStatus = await this.getApiStatus();

        return {
          isHealthy: true,
          responseTime,
          lastChecked: new Date().toISOString(),
          apiAvailable: apiStatus.available,
          authenticationValid: authValid,
        };
      } else {
        return {
          isHealthy: false,
          lastChecked: new Date().toISOString(),
          error: `GitHub API returned status ${response.status}`,
          apiAvailable: false,
          authenticationValid: false,
        };
      }
    } catch (error) {
      return {
        isHealthy: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        apiAvailable: false,
        authenticationValid: false,
      };
    }
  }
}
