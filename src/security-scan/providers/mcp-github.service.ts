import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { 
  GitHubRepository, 
  GitHubCommit, 
  GitHubPullRequest, 
  GitHubIssue,
  GitHubFileContent,
  MCPGitHubConfig 
} from '../interfaces/mcp-github.interface';

@Injectable()
export class MCPGitHubService {
  private readonly logger = new Logger(MCPGitHubService.name);
  private octokit: Octokit;
  private config: MCPGitHubConfig;

  constructor() {
    this.initializeGitHubClient();
  }

  /**
   * Initialize GitHub client with authentication
   */
  private initializeGitHubClient(): void {
    this.config = this.loadGitHubConfig();
    
    if (!this.config.token && !this.config.appId) {
      this.logger.warn('No GitHub authentication configured. Some features may be limited.');
      this.octokit = new Octokit();
      return;
    }

    if (this.config.token) {
      // Personal Access Token authentication
      this.octokit = new Octokit({
        auth: this.config.token,
        baseUrl: this.config.baseUrl || 'https://api.github.com'
      });
      this.logger.log('GitHub MCP initialized with token authentication');
    } else if (this.config.appId && this.config.privateKey) {
      // GitHub App authentication
      this.octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.config.appId,
          privateKey: this.config.privateKey,
          installationId: this.config.installationId
        },
        baseUrl: this.config.baseUrl || 'https://api.github.com'
      });
      this.logger.log('GitHub MCP initialized with App authentication');
    }
  }

  /**
   * Load GitHub configuration from environment
   */
  private loadGitHubConfig(): MCPGitHubConfig {
    return {
      token: process.env.GITHUB_TOKEN,
      appId: process.env.GITHUB_APP_ID ? parseInt(process.env.GITHUB_APP_ID) : undefined,
      privateKey: process.env.GITHUB_PRIVATE_KEY,
      installationId: process.env.GITHUB_INSTALLATION_ID ? parseInt(process.env.GITHUB_INSTALLATION_ID) : undefined,
      baseUrl: process.env.GITHUB_BASE_URL
    };
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      this.logger.log(`Fetching repository information for ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.repos.get({ owner, repo });
      
      // Get latest commit information
      let lastCommit;
      try {
        const commits = await this.octokit.rest.repos.listCommits({
          owner,
          repo,
          per_page: 1
        });
        
        if (commits.data.length > 0) {
          const commit = commits.data[0];
          lastCommit = {
            sha: commit.sha,
            message: commit.commit.message,
            author: commit.commit.author?.name || 'Unknown',
            date: commit.commit.author?.date || new Date().toISOString()
          };
        }
      } catch (error) {
        this.logger.warn(`Failed to fetch latest commit for ${owner}/${repo}: ${error.message}`);
      }

      return {
        owner: data.owner.login,
        repo: data.name,
        fullName: data.full_name,
        description: data.description,
        defaultBranch: data.default_branch,
        private: data.private,
        cloneUrl: data.clone_url,
        htmlUrl: data.html_url,
        language: data.language,
        stars: data.stargazers_count,
        forks: data.forks_count,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        lastCommit
      };
    } catch (error) {
      this.logger.error(`Failed to fetch repository ${owner}/${repo}: ${error.message}`);
      throw new Error(`Repository not found or access denied: ${owner}/${repo}`);
    }
  }

  /**
   * List commits for a repository
   */
  async listCommits(owner: string, repo: string, options?: {
    branch?: string;
    since?: string;
    until?: string;
    per_page?: number;
  }): Promise<GitHubCommit[]> {
    try {
      this.logger.log(`Fetching commits for ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        sha: options?.branch,
        since: options?.since,
        until: options?.until,
        per_page: options?.per_page || 30
      });

      return data.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: {
          name: commit.commit.author?.name || 'Unknown',
          email: commit.commit.author?.email || '',
          date: commit.commit.author?.date || new Date().toISOString()
        },
        committer: {
          name: commit.commit.committer?.name || 'Unknown',
          email: commit.commit.committer?.email || '',
          date: commit.commit.committer?.date || new Date().toISOString()
        },
        url: commit.url,
        htmlUrl: commit.html_url
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch commits for ${owner}/${repo}: ${error.message}`);
      throw new Error(`Failed to fetch commits: ${error.message}`);
    }
  }

  /**
   * Get specific commit details
   */
  async getCommit(owner: string, repo: string, sha: string): Promise<GitHubCommit> {
    try {
      this.logger.log(`Fetching commit ${sha} for ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.repos.getCommit({ owner, repo, ref: sha });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: {
          name: data.commit.author?.name || 'Unknown',
          email: data.commit.author?.email || '',
          date: data.commit.author?.date || new Date().toISOString()
        },
        committer: {
          name: data.commit.committer?.name || 'Unknown',
          email: data.commit.committer?.email || '',
          date: data.commit.committer?.date || new Date().toISOString()
        },
        url: data.url,
        htmlUrl: data.html_url,
        files: data.files?.map(file => ({
          filename: file.filename,
          status: file.status as 'added' | 'modified' | 'removed',
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes
        }))
      };
    } catch (error) {
      this.logger.error(`Failed to fetch commit ${sha} for ${owner}/${repo}: ${error.message}`);
      throw new Error(`Commit not found: ${sha}`);
    }
  }

  /**
   * List pull requests for a repository
   */
  async listPullRequests(owner: string, repo: string, options?: {
    state?: 'open' | 'closed' | 'all';
    sort?: 'created' | 'updated' | 'popularity';
    direction?: 'asc' | 'desc';
    per_page?: number;
  }): Promise<GitHubPullRequest[]> {
    try {
      this.logger.log(`Fetching pull requests for ${owner}/${repo}`);
      
      const { data } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: options?.state || 'open',
        sort: options?.sort || 'created',
        direction: options?.direction || 'desc',
        per_page: options?.per_page || 30
      });

      return data.map(pr => ({
        number: pr.number,
        title: pr.title,
        state: pr.state as 'open' | 'closed',
        author: pr.user?.login || 'Unknown',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        mergedAt: pr.merged_at,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        htmlUrl: pr.html_url,
        draft: pr.draft || false,
        mergeable: pr.mergeable
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch pull requests for ${owner}/${repo}: ${error.message}`);
      throw new Error(`Failed to fetch pull requests: ${error.message}`);
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFileContent> {
    try {
      this.logger.log(`Fetching file content: ${owner}/${repo}/${path}`);
      
      const { data } = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref
      });

      if (Array.isArray(data) || data.type !== 'file') {
        throw new Error('Path is not a file');
      }

      const content = data.encoding === 'base64' 
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;

      return {
        name: data.name,
        path: data.path,
        content,
        encoding: data.encoding === 'base64' ? 'base64' : 'utf-8',
        size: data.size,
        sha: data.sha,
        htmlUrl: data.html_url,
        downloadUrl: data.download_url
      };
    } catch (error) {
      this.logger.error(`Failed to fetch file content ${owner}/${repo}/${path}: ${error.message}`);
      throw new Error(`File not found or access denied: ${path}`);
    }
  }

  /**
   * Search repositories
   */
  async searchRepositories(query: string, options?: {
    sort?: 'stars' | 'forks' | 'updated';
    order?: 'desc' | 'asc';
    per_page?: number;
  }): Promise<GitHubRepository[]> {
    try {
      this.logger.log(`Searching repositories: ${query}`);
      
      const { data } = await this.octokit.rest.search.repos({
        q: query,
        sort: options?.sort,
        order: options?.order || 'desc',
        per_page: options?.per_page || 30
      });

      return data.items.map(repo => ({
        owner: repo.owner.login,
        repo: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        defaultBranch: repo.default_branch,
        private: repo.private,
        cloneUrl: repo.clone_url,
        htmlUrl: repo.html_url,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      this.logger.error(`Failed to search repositories: ${error.message}`);
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Parse GitHub URL to extract owner and repo
   */
  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      const patterns = [
        // HTTPS URLs
        /https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
        // SSH URLs
        /git@github\.com:([^\/]+)\/([^\/]+?)(?:\.git)?$/,
        // API URLs
        /https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return {
            owner: match[1],
            repo: match[2]
          };
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to parse GitHub URL: ${url}`);
      return null;
    }
  }

  /**
   * Check if GitHub client is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.octokit.rest.users.getAuthenticated();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  }> {
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      
      return {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
        used: data.rate.used
      };
    } catch (error) {
      this.logger.error(`Failed to get rate limit: ${error.message}`);
      throw new Error(`Failed to get rate limit information`);
    }
  }
} 