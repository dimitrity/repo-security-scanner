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
} 