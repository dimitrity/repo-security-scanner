import { Injectable, Logger } from '@nestjs/common';
import { ScmProvider } from '../interfaces/scm.interface';
import simpleGit from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class GitScmProvider implements ScmProvider {
  private readonly logger = new Logger(GitScmProvider.name);
  async cloneRepository(repoUrl: string, targetPath: string): Promise<void> {
    try {
      // Parse the repository URL to determine the platform
      const repoInfo = this.parseRepoUrl(repoUrl);
      let cloneUrl = repoUrl;
      
      // If it's a GitLab repository and we have a token, use authenticated clone
      if (repoInfo?.platform === 'gitlab') {
        const gitlabToken = process.env.GITLAB_TOKEN || process.env.GITLAB_ACCESS_TOKEN;
        if (gitlabToken && repoUrl.startsWith('https://')) {
          // Convert HTTPS URL to authenticated format
          // From: https://gitlab.com/owner/repo.git
          // To: https://oauth2:TOKEN@gitlab.com/owner/repo.git
          const url = new URL(repoUrl);
          cloneUrl = `https://oauth2:${gitlabToken}@${url.hostname}${url.pathname}`;
          this.logger.log('Using GitLab token authentication for repository cloning');
        }
      }
      
      await simpleGit().clone(cloneUrl, targetPath);
      this.logger.log(`Successfully cloned repository to ${targetPath}`);
    } catch (error) {
      this.logger.error(`Failed to clone repository ${repoUrl}:`, error);
      throw error;
    }
  }

  async fetchRepoMetadata(repoUrl: string): Promise<{
    name: string;
    description: string;
    defaultBranch: string;
    lastCommit: {
      hash: string;
      timestamp: string;
    };
  }> {
    try {
      // Parse repository URL to extract owner and repo name
      const repoInfo = this.parseRepoUrl(repoUrl);
      
      // Try to fetch metadata from Git hosting platform APIs
      const apiMetadata = await this.fetchFromGitApi(repoInfo);
      if (apiMetadata) {
        return apiMetadata;
      }

      // Fallback: Use git commands to get basic information
      const gitMetadata = await this.fetchFromGitCommands(repoUrl);
      if (gitMetadata) {
        return gitMetadata;
      }
    } catch (error) {
      this.logger.warn('Failed to fetch repository metadata:', { repoUrl, error });
    }
    
    // Return fallback metadata if all else fails
    return this.getFallbackMetadata(repoUrl);
  }

  private parseRepoUrl(repoUrl: string): { platform: string; owner: string; repo: string; hostname?: string } | null {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      
      if (pathParts.length >= 2) {
        const owner = pathParts[0];
        const repo = pathParts[1].replace('.git', '');
        
        let platform = 'unknown';
        if (url.hostname.includes('github.com')) {
          platform = 'github';
        } else if (url.hostname.includes('gitlab.com') || url.hostname.includes('gitlab.')) {
          platform = 'gitlab';
        } else if (url.hostname.includes('bitbucket.org')) {
          platform = 'bitbucket';
        }
        
        return { platform, owner, repo, hostname: url.hostname };
      }
    } catch (error) {
      this.logger.warn('Failed to parse repository URL:', error);
    }
    
    return null;
  }

  private async fetchFromGitApi(repoInfo: { platform: string; owner: string; repo: string; hostname?: string } | null): Promise<any> {
    if (!repoInfo) return null;

    try {
      switch (repoInfo.platform) {
        case 'github':
          return await this.fetchFromGitHubApi(repoInfo.owner, repoInfo.repo);
        case 'gitlab':
          return await this.fetchFromGitLabApi(repoInfo.owner, repoInfo.repo, repoInfo.hostname);
        case 'bitbucket':
          return await this.fetchFromBitbucketApi(repoInfo.owner, repoInfo.repo);
        default:
          return null;
      }
    } catch (error) {
      this.logger.warn('Failed to fetch from API:', { platform: repoInfo.platform, error });
      return null;
    }
  }

  private async fetchFromGitHubApi(owner: string, repo: string): Promise<any> {
    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      
      const data = await response.json();
      return {
        name: data.name,
        description: data.description || 'No description available',
        defaultBranch: data.default_branch || 'main',
        lastCommit: {
          hash: data.updated_at ? 'latest' : 'unknown', // GitHub API doesn't provide latest commit hash directly
          timestamp: data.updated_at || new Date().toISOString(),
        },
      };
    } catch (error) {
              this.logger.warn('GitHub API fetch failed:', error);
      return null;
    }
  }

  private async fetchFromGitLabApi(owner: string, repo: string, hostname?: string): Promise<any> {
    try {
      // Support both GitLab.com and self-hosted GitLab instances
      const apiUrl = hostname ? `https://${hostname}/api/v4` : 'https://gitlab.com/api/v4';
      const projectPath = encodeURIComponent(`${owner}/${repo}`);
      
      // Try to get GitLab token from environment
      const gitlabToken = process.env.GITLAB_TOKEN || process.env.GITLAB_ACCESS_TOKEN;
      
      // Prepare headers
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'User-Agent': 'Repository-Security-Scanner/1.0'
      };
      
      // Add authentication if token is available
      if (gitlabToken) {
        headers['Authorization'] = `Bearer ${gitlabToken}`;
        this.logger.log('Using GitLab authentication token for API requests');
      } else {
        this.logger.log('No GitLab token found, attempting public repository access');
      }
      
      // Fetch project metadata
      this.logger.log(`Fetching GitLab metadata from: ${apiUrl}/projects/${projectPath}`);
      const response = await fetch(`${apiUrl}/projects/${projectPath}`, { headers });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.logger.warn('GitLab API authentication failed - token may be invalid or expired');
        } else if (response.status === 403) {
          this.logger.warn('GitLab API access forbidden - repository may be private or token lacks permissions');
        } else if (response.status === 404) {
          this.logger.warn('GitLab repository not found or access denied');
        }
        throw new Error(`GitLab API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Fetch additional metadata if authenticated
      let additionalData = {};
      if (gitlabToken) {
        try {
          // Get latest commit information
          const commitsResponse = await fetch(`${apiUrl}/projects/${projectPath}/repository/commits?per_page=1`, { headers });
          if (commitsResponse.ok) {
            const commits = await commitsResponse.json();
            if (commits.length > 0) {
              additionalData = {
                lastCommitHash: commits[0].id,
                lastCommitMessage: commits[0].message,
                lastCommitAuthor: commits[0].author_name,
                lastCommitDate: commits[0].committed_date
              };
            }
          }
          
          // Get repository statistics
          const statsResponse = await fetch(`${apiUrl}/projects/${projectPath}/repository/contributors`, { headers });
          if (statsResponse.ok) {
            const contributors = await statsResponse.json();
            additionalData = {
              ...additionalData,
              contributorCount: contributors.length
            };
          }
        } catch (error) {
          this.logger.warn('Failed to fetch additional GitLab metadata:', error);
        }
      }
      
      return {
        name: data.name,
        description: data.description || 'No description available',
        defaultBranch: data.default_branch || 'main',
        lastCommit: {
          hash: additionalData['lastCommitHash'] || data.last_activity_at ? 'latest' : 'unknown',
          timestamp: additionalData['lastCommitDate'] || data.last_activity_at || new Date().toISOString(),
          message: additionalData['lastCommitMessage'] || undefined,
          author: additionalData['lastCommitAuthor'] || undefined
        },
        // GitLab-specific metadata
        gitlab: {
          id: data.id,
          namespace: data.namespace?.name,
          visibility: data.visibility,
          forksCount: data.forks_count,
          starsCount: data.star_count,
          issuesEnabled: data.issues_enabled,
          mergeRequestsEnabled: data.merge_requests_enabled,
          wikiEnabled: data.wiki_enabled,
          snippetsEnabled: data.snippets_enabled,
          containerRegistryEnabled: data.container_registry_enabled,
          packagesEnabled: data.packages_enabled,
          contributorCount: additionalData['contributorCount'] || undefined,
          webUrl: data.web_url,
          sshUrlToRepo: data.ssh_url_to_repo,
          httpUrlToRepo: data.http_url_to_repo,
          readmeUrl: data.readme_url,
          avatarUrl: data.avatar_url,
          topics: data.topics || [],
          createdAt: data.created_at,
          lastActivityAt: data.last_activity_at
        }
      };
    } catch (error) {
      this.logger.warn('GitLab API fetch failed:', { owner, repo, hostname, error: error.message });
      return null;
    }
  }

  private async fetchFromBitbucketApi(owner: string, repo: string): Promise<any> {
    try {
      const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`);
      if (!response.ok) {
        throw new Error(`Bitbucket API returned ${response.status}`);
      }
      
      const data = await response.json();
      return {
        name: data.name,
        description: data.description || 'No description available',
        defaultBranch: data.mainbranch?.name || 'main',
        lastCommit: {
          hash: data.updated_on ? 'latest' : 'unknown',
          timestamp: data.updated_on || new Date().toISOString(),
        },
      };
    } catch (error) {
              this.logger.warn('Bitbucket API fetch failed:', error);
      return null;
    }
  }

  private async fetchFromGitCommands(repoUrl: string): Promise<any> {
    try {
      // Create a temporary directory for shallow clone
      const { dir } = await import('tmp-promise');
      const tmpDir = await dir({ unsafeCleanup: true });
      
      try {
        // Shallow clone to get basic information
        await simpleGit().clone(repoUrl, tmpDir.path, ['--depth', '1']);
        
        const git = simpleGit(tmpDir.path);
        
        // Get repository name from remote
        const remotes = await git.getRemotes(true);
        const originRemote = remotes.find(remote => remote.name === 'origin');
        const repoName = originRemote?.refs?.fetch?.split('/').pop()?.replace('.git', '') || 'unknown';
        
        // Get default branch
        const defaultBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
        
        // Get latest commit information
        const log = await git.log({ maxCount: 1 });
        const lastCommit = log.latest ? {
          hash: log.latest.hash,
          timestamp: log.latest.date,
        } : {
          hash: 'unknown',
          timestamp: new Date().toISOString(),
        };
        
        // Try to get description from README or other files
        const description = await this.extractDescription(tmpDir.path);
        
        return {
          name: repoName,
          description: description || 'No description available',
          defaultBranch: defaultBranch || 'main',
          lastCommit,
        };
      } finally {
        await tmpDir.cleanup();
      }
    } catch (error) {
      this.logger.warn('Git commands fetch failed:', error);
      return null;
    }
  }

  private async extractDescription(repoPath: string): Promise<string> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Try to read README files
      const readmeFiles = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
      
      for (const readmeFile of readmeFiles) {
        const readmePath = path.join(repoPath, readmeFile);
        if (fs.existsSync(readmePath)) {
          const content = fs.readFileSync(readmePath, 'utf8');
          // Extract first paragraph or first few lines as description
          const lines = content.split('\n').filter(line => line.trim());
          if (lines.length > 0) {
            // Remove markdown formatting and return first meaningful line
            const firstLine = lines[0].replace(/^#+\s*/, '').replace(/[*`]/g, '').trim();
            if (firstLine && firstLine.length > 10) {
              return firstLine.substring(0, 200) + (firstLine.length > 200 ? '...' : '');
            }
          }
        }
      }
      
      return 'No description available';
    } catch (error) {
              this.logger.warn('Failed to extract description:', error);
      return 'No description available';
    }
  }

  private getFallbackMetadata(repoUrl: string): any {
    // Extract repo name from URL as fallback
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'unknown';
    
    return {
      name: repoName,
      description: 'Repository information unavailable',
      defaultBranch: 'main',
      lastCommit: {
        hash: 'unknown',
        timestamp: new Date().toISOString(),
      },
    };
  }

  async getLastCommitHash(repoUrl: string): Promise<string> {
    try {
      // Use git commands for reliable commit hash
      const { dir } = await import('tmp-promise');
      const tmpDir = await dir({ unsafeCleanup: true });
      
      try {
        // Clone with depth 1 to get latest commit
        await simpleGit().clone(repoUrl, tmpDir.path, ['--depth', '1']);
        const git = simpleGit(tmpDir.path);
        const log = await git.log({ maxCount: 1 });
        return log.latest?.hash || 'unknown';
      } finally {
        await tmpDir.cleanup();
      }
    } catch (error) {
      this.logger.warn('Failed to get last commit hash:', { repoUrl, error });
      return 'unknown';
    }
  }

  async hasChangesSince(repoUrl: string, lastCommitHash: string): Promise<{
    hasChanges: boolean;
    lastCommitHash: string;
    changeSummary?: {
      filesChanged: number;
      additions: number;
      deletions: number;
      commits: number;
    };
  }> {
    try {
      // Get current last commit hash
      const currentLastCommit = await this.getLastCommitHash(repoUrl);
      
      if (currentLastCommit === 'unknown' || lastCommitHash === 'unknown') {
        return {
          hasChanges: true, // Assume changes if we can't determine
          lastCommitHash: currentLastCommit,
        };
      }

      // If hashes are the same, no changes
      if (currentLastCommit === lastCommitHash) {
        return {
          hasChanges: false,
          lastCommitHash: currentLastCommit,
        };
      }

      // Get detailed change information
      const { dir } = await import('tmp-promise');
      const tmpDir = await dir({ unsafeCleanup: true });
      
      try {
        // Clone full repository for detailed analysis
        await simpleGit().clone(repoUrl, tmpDir.path);
        const git = simpleGit(tmpDir.path);
        
        // Check if the old commit exists in the repository
        try {
          await git.show([lastCommitHash, '--oneline', '--no-patch']);
        } catch (commitError) {
          // If old commit doesn't exist, assume changes
          this.logger.warn('Old commit not found in repository', { lastCommitHash });
          return {
            hasChanges: true,
            lastCommitHash: currentLastCommit,
            changeSummary: {
              filesChanged: 0,
              additions: 0,
              deletions: 0,
              commits: 0,
            },
          };
        }

        // Get commit range - use more reliable method
        let commits = 0;
        try {
          const log = await git.log({
            from: lastCommitHash,
            to: currentLastCommit,
          });
          commits = log.total;
        } catch (logError) {
          // If log range fails, try alternative approach
          this.logger.warn('Log range failed, trying alternative method:', logError);
          try {
            const log = await git.log({
              from: `${lastCommitHash}..${currentLastCommit}`,
            });
            commits = log.total;
          } catch (altLogError) {
            this.logger.warn('Alternative log method also failed:', altLogError);
            commits = 0;
          }
        }

        // Get diff stats
        let diffStats: any = { files: [], insertions: 0, deletions: 0 };
        try {
          diffStats = await git.diffSummary([lastCommitHash, currentLastCommit]);
        } catch (diffError) {
          this.logger.warn('Diff summary failed, trying alternative method:', diffError);
          try {
            diffStats = await git.diffSummary([`${lastCommitHash}..${currentLastCommit}`]);
          } catch (altDiffError) {
            this.logger.warn('Alternative diff method also failed:', altDiffError);
            diffStats = { files: [], insertions: 0, deletions: 0 };
          }
        }
        
        return {
          hasChanges: true,
          lastCommitHash: currentLastCommit,
          changeSummary: {
            filesChanged: diffStats.files.length,
            additions: diffStats.insertions,
            deletions: diffStats.deletions,
            commits: commits,
          },
        };
      } finally {
        await tmpDir.cleanup();
      }
    } catch (error) {
      this.logger.warn('Failed to check changes:', { repoUrl, error });
      return {
        hasChanges: true, // Assume changes if we can't determine
        lastCommitHash: await this.getLastCommitHash(repoUrl),
      };
    }
  }
} 