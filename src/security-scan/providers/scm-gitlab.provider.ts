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
 * GitLab-specific SCM Provider
 */
@Injectable()
export class GitLabScmProvider extends EnhancedGitScmProvider {
  constructor() {
    super();
    this.config = {
      name: 'GitLab Provider',
      platform: 'gitlab',
      hostnames: ['gitlab.com', 'www.gitlab.com', 'gitlab.'], // gitlab. matches any gitlab subdomain
      apiBaseUrl: 'https://gitlab.com/api/v4',
      supportsPrivateRepos: true,
      supportsApi: true,
      authentication: {
        type: 'token',
      },
      rateLimit: {
        requestsPerHour: 2000, // GitLab rate limits
        burstLimit: 50,
      },
    };
  }

  /**
   * GitLab-specific URL validation
   */
  canHandle(repoUrl: string): boolean {
    try {
      const url = new URL(repoUrl);
      return (
        url.hostname.includes('gitlab.com') || url.hostname.includes('gitlab.')
      );
    } catch {
      return false;
    }
  }

  /**
   * Get GitLab API base URL for hostname
   */
  private getApiBaseUrl(hostname?: string): string {
    if (!hostname || hostname === 'gitlab.com') {
      return 'https://gitlab.com/api/v4';
    }
    return `https://${hostname}/api/v4`;
  }

  /**
   * Fetch metadata from GitLab API
   */
  protected async fetchFromApi(
    repoInfo: RepositoryInfo | null,
  ): Promise<RepositoryMetadata | null> {
    if (!repoInfo || repoInfo.platform !== 'gitlab') {
      return null;
    }

    try {
      const apiBaseUrl = this.getApiBaseUrl(repoInfo.hostname);
      const projectPath = encodeURIComponent(repoInfo.fullName);
      const headers = this.buildApiHeaders();

      const response = await fetch(`${apiBaseUrl}/projects/${projectPath}`, {
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.logger.warn(
            'GitLab API authentication failed - token may be invalid or expired',
          );
        } else if (response.status === 403) {
          this.logger.warn(
            'GitLab API access forbidden - repository may be private or token lacks permissions',
          );
        } else if (response.status === 404) {
          this.logger.warn('GitLab repository not found or access denied');
        }
        return null;
      }

      const data = await response.json();

      // Get additional data if authenticated
      let additionalData = {};
      if (this.authConfig?.token) {
        additionalData = await this.fetchAdditionalGitLabData(
          apiBaseUrl,
          projectPath,
          headers,
        );
      }

      return {
        name: data.name,
        description: data.description || 'No description available',
        defaultBranch: data.default_branch || 'main',
        lastCommit: {
          hash: additionalData['lastCommitHash'] || 'latest',
          timestamp:
            additionalData['lastCommitDate'] ||
            data.last_activity_at ||
            new Date().toISOString(),
          message: additionalData['lastCommitMessage'],
          author: additionalData['lastCommitAuthor'],
        },
        platform: {
          gitlab: {
            id: data.id,
            name: data.name,
            path: data.path,
            pathWithNamespace: data.path_with_namespace,
            namespace: {
              id: data.namespace?.id,
              name: data.namespace?.name,
              path: data.namespace?.path,
              kind: data.namespace?.kind,
              fullPath: data.namespace?.full_path,
            },
            visibility: data.visibility,
            forksCount: data.forks_count,
            starsCount: data.star_count,
            issuesEnabled: data.issues_enabled,
            mergeRequestsEnabled: data.merge_requests_enabled,
            wikiEnabled: data.wiki_enabled,
            snippetsEnabled: data.snippets_enabled,
            containerRegistryEnabled: data.container_registry_enabled,
            packagesEnabled: data.packages_enabled,
            securityAndComplianceEnabled:
              data.security_and_compliance_access_level !== 'disabled',
            analyticsEnabled: data.analytics_access_level !== 'disabled',
            buildsEnabled: data.builds_enabled,
            webUrl: data.web_url,
            sshUrlToRepo: data.ssh_url_to_repo,
            httpUrlToRepo: data.http_url_to_repo,
            readmeUrl: data.readme_url,
            avatarUrl: data.avatar_url,
            topics: data.topics || [],
            createdAt: data.created_at,
            lastActivityAt: data.last_activity_at,
            ...additionalData,
          },
        },
        common: {
          visibility:
            data.visibility === 'private'
              ? 'private'
              : data.visibility === 'internal'
                ? 'internal'
                : 'public',
          forksCount: data.forks_count,
          starsCount: data.star_count,
          issuesCount: data.open_issues_count,
          language: additionalData['mainLanguage'],
          topics: data.topics || [],
          contributorCount: additionalData['contributorCount'],
          createdAt: data.created_at,
          updatedAt: data.last_activity_at,
          pushedAt: data.last_activity_at,
          webUrl: data.web_url,
          cloneUrl: data.http_url_to_repo,
          sshUrl: data.ssh_url_to_repo,
          archived: data.archived,
          disabled: false, // GitLab doesn't have disabled concept like GitHub
        },
      };
    } catch (error) {
      this.logger.warn('GitLab API fetch failed:', error);
      return null;
    }
  }

  /**
   * Build API headers with authentication
   */
  private buildApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Repository-Security-Scanner/1.0',
    };

    if (this.authConfig?.token) {
      headers['Authorization'] = `Bearer ${this.authConfig.token}`;
    }

    return headers;
  }

  /**
   * Fetch additional GitLab data for authenticated requests
   */
  private async fetchAdditionalGitLabData(
    apiBaseUrl: string,
    projectPath: string,
    headers: Record<string, string>,
  ): Promise<Record<string, any>> {
    const additionalData: Record<string, any> = {};

    try {
      // Get latest commit
      const commitsResponse = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/repository/commits?per_page=1`,
        { headers },
      );
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        if (commits.length > 0) {
          const latestCommit = commits[0];
          additionalData.lastCommitHash = latestCommit.id;
          additionalData.lastCommitMessage = latestCommit.message;
          additionalData.lastCommitAuthor = latestCommit.author_name;
          additionalData.lastCommitDate = latestCommit.committed_date;
        }
      }

      // Get contributors
      const contributorsResponse = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/repository/contributors`,
        { headers },
      );
      if (contributorsResponse.ok) {
        const contributors = await contributorsResponse.json();
        additionalData.contributorCount = contributors.length;
        additionalData.topContributors = contributors
          .slice(0, 5)
          .map((c: any) => ({
            name: c.name,
            email: c.email,
            commits: c.commits,
            additions: c.additions,
            deletions: c.deletions,
          }));
      }

      // Get languages
      const languagesResponse = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/languages`,
        { headers },
      );
      if (languagesResponse.ok) {
        const languages = await languagesResponse.json();
        const languageEntries = Object.entries(languages);
        if (languageEntries.length > 0) {
          // Sort by percentage and get the main language
          languageEntries.sort((a, b) => (b[1] as number) - (a[1] as number));
          additionalData.mainLanguage = languageEntries[0][0];
          additionalData.languages = languages;
        }
      }

      // Get merge requests count
      const mergeRequestsResponse = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/merge_requests?state=opened&per_page=1`,
        { headers },
      );
      if (mergeRequestsResponse.ok) {
        const totalHeader = mergeRequestsResponse.headers.get('X-Total');
        if (totalHeader) {
          additionalData.openMergeRequestsCount = parseInt(totalHeader);
        }
      }

      // Get pipeline status
      const pipelinesResponse = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/pipelines?per_page=1`,
        { headers },
      );
      if (pipelinesResponse.ok) {
        const pipelines = await pipelinesResponse.json();
        if (pipelines.length > 0) {
          additionalData.latestPipeline = {
            id: pipelines[0].id,
            status: pipelines[0].status,
            ref: pipelines[0].ref,
            sha: pipelines[0].sha,
            createdAt: pipelines[0].created_at,
            updatedAt: pipelines[0].updated_at,
          };
        }
      }
    } catch (error) {
      this.logger.warn('Failed to fetch additional GitLab data:', error);
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
      const apiBaseUrl = this.getApiBaseUrl(repoInfo.hostname);
      const projectPath = encodeURIComponent(repoInfo.fullName);
      const headers = this.buildApiHeaders();

      const response = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/repository/branches`,
        { headers },
      );

      if (response.ok) {
        const branches = await response.json();
        return branches.map((branch: any) => branch.name);
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitLab branches:', error);
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
      const apiBaseUrl = this.getApiBaseUrl(repoInfo.hostname);
      const projectPath = encodeURIComponent(repoInfo.fullName);
      const headers = this.buildApiHeaders();

      const response = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/repository/tags`,
        { headers },
      );

      if (response.ok) {
        const tags = await response.json();
        return tags.map((tag: any) => tag.name);
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitLab tags:', error);
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
      const apiBaseUrl = this.getApiBaseUrl(repoInfo.hostname);
      const projectPath = encodeURIComponent(repoInfo.fullName);
      const headers = this.buildApiHeaders();

      const response = await fetch(
        `${apiBaseUrl}/projects/${projectPath}/repository/contributors`,
        { headers },
      );

      if (response.ok) {
        const contributors = await response.json();
        return contributors.map((contributor: any) => ({
          name: contributor.name,
          email: contributor.email,
          contributions: contributor.commits,
          type: 'user', // GitLab doesn't distinguish bots in contributors API
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to fetch GitLab contributors:', error);
    }

    return [];
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string): Promise<SearchResult[]> {
    try {
      const headers = this.buildApiHeaders();
      const searchUrl = `https://gitlab.com/api/v4/projects?search=${encodeURIComponent(query)}&visibility=public`;
      const response = await fetch(searchUrl, { headers });

      if (response.ok) {
        const projects = await response.json();
        return projects.map((project: any) => ({
          name: project.name,
          fullName: project.path_with_namespace,
          description: project.description || '',
          url: project.web_url,
          isPrivate: project.visibility === 'private',
          language: '', // Would need additional API call to get main language
          stars: project.star_count,
          forks: project.forks_count,
          updatedAt: project.last_activity_at,
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to search GitLab repositories:', error);
    }

    return [];
  }

  /**
   * Get GitLab API status
   */
  async getApiStatus(): Promise<ApiStatus> {
    try {
      const headers = this.buildApiHeaders();
      const response = await fetch('https://gitlab.com/api/v4/version', {
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        return {
          available: true,
          version: data.version,
          features: [
            'repositories',
            'commits',
            'branches',
            'tags',
            'contributors',
            'merge_requests',
            'pipelines',
          ],
        };
      }
    } catch (error) {
      this.logger.warn('Failed to get GitLab API status:', error);
    }

    return {
      available: false,
      error: 'Unable to connect to GitLab API',
    };
  }

  /**
   * Validate GitLab authentication
   */
  async validateAuthentication(): Promise<boolean> {
    if (!this.authConfig?.token) return false;

    try {
      const headers = this.buildApiHeaders();
      const response = await fetch('https://gitlab.com/api/v4/user', {
        headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Enhanced health check with GitLab-specific checks
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      // Check GitLab API availability
      const response = await fetch('https://gitlab.com/api/v4/version');
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
          error: `GitLab API returned status ${response.status}`,
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
