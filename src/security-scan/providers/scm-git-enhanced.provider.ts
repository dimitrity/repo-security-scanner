import { Injectable, Logger } from '@nestjs/common';
import { 
  BaseScmProvider, 
  ScmProviderConfig, 
  RepositoryMetadata, 
  ChangeDetectionResult, 
  CloneOptions,
  ScmAuthConfig,
  RepositoryInfo,
  ProviderHealthStatus,
  ApiStatus,
  Contributor
} from '../interfaces/scm.interface';
import simpleGit from 'simple-git';
import * as tmp from 'tmp-promise';
import * as fs from 'fs';

/**
 * Enhanced Generic Git Provider with multi-platform support
 */
@Injectable()
export class EnhancedGitScmProvider extends BaseScmProvider {
  protected readonly logger = new Logger(EnhancedGitScmProvider.name);

  constructor() {
    super({
      name: 'Enhanced Git Provider',
      platform: 'generic',
      hostnames: [], // Will be dynamically determined
      supportsPrivateRepos: true,
      supportsApi: false, // Generic git doesn't have API, but specific implementations do
      authentication: {
        type: 'none'
      }
    });
  }

  /**
   * Enhanced URL handling - can handle any Git URL
   */
  canHandle(repoUrl: string): boolean {
    try {
      // Check if it's a valid URL
      new URL(repoUrl);
      
      // Check for common Git URL patterns
      const gitUrlPatterns = [
        /^https?:\/\/.*\.git$/,
        /^https?:\/\/.*\/.*\/.*$/,
        /^git@.*:.*\/.*\.git$/,
        /^ssh:\/\/git@.*\/.*$/
      ];

      return gitUrlPatterns.some(pattern => pattern.test(repoUrl)) ||
             repoUrl.includes('github.com') ||
             repoUrl.includes('gitlab.com') ||
             repoUrl.includes('bitbucket.org') ||
             repoUrl.includes('.git');
    } catch {
      // Try SSH-style URLs
      return /^git@.*:.*\/.*/.test(repoUrl);
    }
  }

  /**
   * Enhanced repository URL parsing
   */
  parseRepositoryUrl(repoUrl: string): RepositoryInfo | null {
    try {
      // Handle HTTPS URLs
      if (repoUrl.startsWith('http')) {
        const url = new URL(repoUrl);
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        if (pathParts.length >= 2) {
          const owner = pathParts[0];
          const repository = pathParts[pathParts.length - 1].replace('.git', '');
          
          // Determine platform based on hostname
          let platform = this.determinePlatform(url.hostname);
          
          return {
            platform,
            hostname: url.hostname,
            owner,
            repository,
            fullName: `${owner}/${repository}`,
            originalUrl: repoUrl,
          };
        }
      }
      
      // Handle SSH URLs (git@hostname:owner/repo.git)
      if (repoUrl.startsWith('git@') || repoUrl.startsWith('ssh://')) {
        const sshMatch = repoUrl.match(/git@([^:]+):(.+)\/(.+)\.git$/) ||
                        repoUrl.match(/ssh:\/\/git@([^\/]+)\/(.+)\/(.+)\.git$/);
        
        if (sshMatch) {
          const hostname = sshMatch[1];
          const owner = sshMatch[2];
          const repository = sshMatch[3];
          const platform = this.determinePlatform(hostname);
          
          return {
            platform,
            hostname,
            owner,
            repository,
            fullName: `${owner}/${repository}`,
            originalUrl: repoUrl,
          };
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to parse repository URL: ${repoUrl}`, error);
    }
    
    return null;
  }

  /**
   * Determine platform based on hostname
   */
  private determinePlatform(hostname: string): any {
    if (hostname.includes('github.com')) return 'github';
    if (hostname.includes('gitlab.com') || hostname.includes('gitlab.')) return 'gitlab';
    if (hostname.includes('bitbucket.org')) return 'bitbucket';
    if (hostname.includes('dev.azure.com') || hostname.includes('visualstudio.com')) return 'azure-devops';
    if (hostname.includes('gitea.')) return 'gitea';
    if (hostname.includes('forgejo.')) return 'forgejo';
    if (hostname.includes('codeberg.org')) return 'codeberg';
    return 'generic';
  }

  /**
   * Enhanced clone with authentication support
   */
  async cloneRepository(repoUrl: string, targetPath: string, options: CloneOptions = {}): Promise<void> {
    // Validate repository URL
    if (!this.isValidRepositoryUrl(repoUrl)) {
      throw new Error(`Invalid repository URL: ${repoUrl}. Please provide a valid Git repository URL.`);
    }

    try {
      let cloneUrl = repoUrl;
      
      // Apply authentication if available
      if (this.authConfig && this.authConfig.token) {
        cloneUrl = this.applyTokenAuthentication(repoUrl, this.authConfig.token);
      }

      const cloneOptions = this.buildCloneOptions(options);
      
      this.logger.log(`Cloning repository ${repoUrl} to ${targetPath} with options:`, cloneOptions);
      
      await simpleGit().clone(cloneUrl, targetPath, cloneOptions);
      
      this.logger.log(`Successfully cloned repository to ${targetPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clone repository ${repoUrl}:`, error);
      
      // Provide more specific error messages for common issues
      if (errorMessage.includes('Repository not found') || errorMessage.includes('not found')) {
        throw new Error(`Repository not found: ${repoUrl}. Please verify the repository exists and you have access to it.`);
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('authentication failed')) {
        throw new Error(`Authentication failed for ${repoUrl}. Please check your credentials or token permissions.`);
      } else if (errorMessage.includes('Network is unreachable') || errorMessage.includes('timeout')) {
        throw new Error(`Network error cloning ${repoUrl}. Please check your internet connection.`);
      } else {
        throw new Error(`Clone failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Validate if the provided URL is a valid repository URL
   */
  private isValidRepositoryUrl(repoUrl: string): boolean {
    if (!repoUrl || typeof repoUrl !== 'string') {
      return false;
    }

    // Check for basic URL format
    const urlRegex = /^(https?:\/\/|git@|ssh:\/\/)/;
    if (!urlRegex.test(repoUrl)) {
      return false;
    }

    // Check for common test/example URLs that don't exist
    const testUrls = [
      'github.com/user/repo',
      'github.com/example/repo',
      'github.com/test/repo',
      'gitlab.com/user/repo',
      'bitbucket.org/user/repo'
    ];

    return !testUrls.some(testUrl => repoUrl.includes(testUrl));
  }

  /**
   * Apply token authentication to URL
   */
  private applyTokenAuthentication(repoUrl: string, token: string): string {
    try {
      if (repoUrl.startsWith('https://')) {
        const url = new URL(repoUrl);
        const hostname = url.hostname;
        
        // Apply platform-specific token authentication
        if (hostname.includes('github.com')) {
          return `https://${token}@${hostname}${url.pathname}`;
        } else if (hostname.includes('gitlab.com') || hostname.includes('gitlab.')) {
          return `https://oauth2:${token}@${hostname}${url.pathname}`;
        } else if (hostname.includes('bitbucket.org')) {
          return `https://x-token-auth:${token}@${hostname}${url.pathname}`;
        } else {
          // Generic token authentication
          return `https://${token}@${hostname}${url.pathname}`;
        }
      }
      
      return repoUrl; // Return original URL if can't apply authentication
    } catch {
      return repoUrl;
    }
  }

  /**
   * Build clone options
   */
  private buildCloneOptions(options: CloneOptions): string[] {
    const cloneArgs: string[] = [];
    
    if (options.depth) {
      cloneArgs.push('--depth', options.depth.toString());
    }
    
    if (options.branch) {
      cloneArgs.push('--branch', options.branch);
    }
    
    if (options.singleBranch) {
      cloneArgs.push('--single-branch');
    }
    
    if (options.recursive) {
      cloneArgs.push('--recursive');
    }
    
    return cloneArgs;
  }

  /**
   * Enhanced metadata fetching with fallbacks
   */
  async fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata> {
    const repoInfo = this.parseRepositoryUrl(repoUrl);
    
    try {
      // Try API-based metadata first (if available)
      const apiMetadata = await this.fetchFromApi(repoInfo);
      if (apiMetadata) {
        return apiMetadata;
      }
    } catch (error) {
      this.logger.warn('API metadata fetch failed, falling back to Git commands:', error);
    }
    
    // Fallback to Git commands
    return this.fetchFromGitCommands(repoUrl, repoInfo);
  }

  /**
   * Fetch metadata from platform APIs (abstract - to be implemented by specific providers)
   */
  protected async fetchFromApi(repoInfo: RepositoryInfo | null): Promise<RepositoryMetadata | null> {
    // Base implementation returns null - specific providers can override
    return null;
  }

  /**
   * Fetch metadata using Git commands
   */
  private async fetchFromGitCommands(repoUrl: string, repoInfo: RepositoryInfo | null): Promise<RepositoryMetadata> {
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    
    try {
      // Shallow clone for metadata
      await this.cloneRepository(repoUrl, tmpDir.path, { depth: 1 });
      
      const git = simpleGit(tmpDir.path);
      
      // Get repository name
      const name = repoInfo?.repository || this.extractRepoNameFromUrl(repoUrl);
      
      // Get default branch
      let defaultBranch = 'main';
      try {
        defaultBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
      } catch {
        // Fallback to common branch names
        const branches = await git.branch(['-r']);
        if (branches.all.includes('origin/main')) {
          defaultBranch = 'main';
        } else if (branches.all.includes('origin/master')) {
          defaultBranch = 'master';
        }
      }
      
      // Get latest commit
      const log = await git.log({ maxCount: 1 });
      const latestCommit = log.latest;
      
      // Get description from README
      const description = await this.extractDescription(tmpDir.path);
      
      return {
        name,
        description: description || 'No description available',
        defaultBranch: defaultBranch.replace('origin/', ''),
        lastCommit: {
          hash: latestCommit?.hash || 'unknown',
          timestamp: latestCommit?.date || new Date().toISOString(),
          message: latestCommit?.message,
          author: latestCommit?.author_name,
        },
        common: {
          webUrl: this.convertToWebUrl(repoUrl),
          cloneUrl: repoUrl,
        }
      };
    } finally {
      await tmpDir.cleanup();
    }
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoNameFromUrl(repoUrl: string): string {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      return pathParts[pathParts.length - 1].replace('.git', '');
    } catch {
      // Handle SSH URLs
      const match = repoUrl.match(/\/([^\/]+)\.git$/);
      return match ? match[1] : 'unknown';
    }
  }

  /**
   * Convert clone URL to web URL
   */
  private convertToWebUrl(repoUrl: string): string {
    if (repoUrl.startsWith('http')) {
      return repoUrl.replace('.git', '');
    }
    
    // Convert SSH to HTTPS
    const sshMatch = repoUrl.match(/git@([^:]+):(.+)\.git$/);
    if (sshMatch) {
      return `https://${sshMatch[1]}/${sshMatch[2]}`;
    }
    
    return repoUrl;
  }

  /**
   * Extract description from README files
   */
  private async extractDescription(repoPath: string): Promise<string | null> {
    const readmeFiles = ['README.md', 'README.txt', 'README.rst', 'readme.md', 'Readme.md'];
    
    for (const readmeFile of readmeFiles) {
      const readmePath = require('path').join(repoPath, readmeFile);
      
      if (fs.existsSync(readmePath)) {
        try {
          const content = fs.readFileSync(readmePath, 'utf8');
          const lines = content.split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            // Remove markdown formatting
            const firstLine = lines[0].replace(/^#+\s*/, '').replace(/[*`]/g, '').trim();
            if (firstLine && firstLine.length > 10) {
              return firstLine.substring(0, 200) + (firstLine.length > 200 ? '...' : '');
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to read ${readmeFile}:`, error);
        }
      }
    }
    
    return null;
  }

  /**
   * Get last commit hash
   */
  async getLastCommitHash(repoUrl: string): Promise<string> {
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    
    try {
      await this.cloneRepository(repoUrl, tmpDir.path, { depth: 1 });
      const git = simpleGit(tmpDir.path);
      const log = await git.log({ maxCount: 1 });
      return log.latest?.hash || 'unknown';
    } catch (error) {
      this.logger.warn(`Failed to get last commit hash for ${repoUrl}:`, error);
      return 'unknown';
    } finally {
      await tmpDir.cleanup();
    }
  }

  /**
   * Enhanced change detection
   */
  async hasChangesSince(repoUrl: string, lastCommitHash: string): Promise<ChangeDetectionResult> {
    try {
      const currentCommitHash = await this.getLastCommitHash(repoUrl);
      
      if (currentCommitHash === 'unknown' || lastCommitHash === 'unknown') {
        return {
          hasChanges: true,
          lastCommitHash: currentCommitHash,
          error: 'Unable to determine commit hashes'
        };
      }
      
      if (currentCommitHash === lastCommitHash) {
        return {
          hasChanges: false,
          lastCommitHash: currentCommitHash,
        };
      }
      
      // Get detailed change information
      const changeSummary = await this.getChangeSummary(repoUrl, lastCommitHash, currentCommitHash);
      
      return {
        hasChanges: true,
        lastCommitHash: currentCommitHash,
        changeSummary,
      };
    } catch (error) {
      this.logger.warn(`Failed to check changes for ${repoUrl}:`, error);
      return {
        hasChanges: true,
        lastCommitHash: await this.getLastCommitHash(repoUrl),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get detailed change summary
   */
  private async getChangeSummary(repoUrl: string, fromCommit: string, toCommit: string) {
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    
    try {
      await this.cloneRepository(repoUrl, tmpDir.path);
      const git = simpleGit(tmpDir.path);
      
      // Get commit count
      let commits = 0;
      try {
        const log = await git.log({ from: fromCommit, to: toCommit });
        commits = log.total;
      } catch {
        // Fallback method
        try {
          const log = await git.log({ from: `${fromCommit}..${toCommit}` });
          commits = log.total;
        } catch {
          commits = 0;
        }
      }
      
      // Get diff stats
      let diffStats: any = { files: [], insertions: 0, deletions: 0 };
      try {
        diffStats = await git.diffSummary([fromCommit, toCommit]);
      } catch {
        // Fallback method
        try {
          diffStats = await git.diffSummary([`${fromCommit}..${toCommit}`]);
        } catch {
          // Return minimal info
        }
      }
      
      return {
        filesChanged: diffStats.files.length,
        additions: diffStats.insertions,
        deletions: diffStats.deletions,
        commits,
        commitRange: `${fromCommit.substring(0, 7)}..${toCommit.substring(0, 7)}`
      };
    } finally {
      await tmpDir.cleanup();
    }
  }

  /**
   * Enhanced health check
   */
  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Test git command availability
      const git = simpleGit();
      await git.version();
      
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
        error: error instanceof Error ? error.message : 'Git command not available',
        authenticationValid: false,
      };
    }
  }

  /**
   * Validate authentication
   */
  async validateAuthentication(): Promise<boolean> {
    if (!this.isAuthenticated()) return true; // No auth needed for public repos
    
    // For generic Git provider, we can't easily validate tokens without knowing the platform
    // Specific platform providers should override this method
    return true;
  }
} 