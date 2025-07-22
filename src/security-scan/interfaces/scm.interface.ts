export interface ScmProvider {
  cloneRepository(repoUrl: string, targetPath: string): Promise<void>;
  fetchRepoMetadata(repoUrl: string): Promise<{
    name: string;
    description: string;
    defaultBranch: string;
    lastCommit: {
      hash: string;
      timestamp: string;
    };
  }>;
  getLastCommitHash(repoUrl: string): Promise<string>;
  hasChangesSince(repoUrl: string, lastCommitHash: string): Promise<{
    hasChanges: boolean;
    lastCommitHash: string;
    changeSummary?: {
      filesChanged: number;
      additions: number;
      deletions: number;
      commits: number;
    };
  }>;
} 