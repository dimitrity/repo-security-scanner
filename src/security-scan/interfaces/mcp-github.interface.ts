// Basic MCP interfaces (avoiding SDK dependency issues)
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface GitHubRepository {
  owner: string;
  repo: string;
  fullName: string;
  description?: string;
  defaultBranch: string;
  private: boolean;
  cloneUrl: string;
  htmlUrl: string;
  language?: string;
  stars: number;
  forks: number;
  createdAt: string;
  updatedAt: string;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  htmlUrl: string;
  files?: Array<{
    filename: string;
    status: 'added' | 'modified' | 'removed';
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  author: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  baseBranch: string;
  headBranch: string;
  htmlUrl: string;
  draft: boolean;
  mergeable?: boolean;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  labels: string[];
  assignees: string[];
  htmlUrl: string;
}

export interface GitHubMCPTool extends MCPTool {
  name: 'github_get_repository' | 'github_list_commits' | 'github_get_commit' | 
        'github_list_pull_requests' | 'github_get_pull_request' | 'github_list_issues' |
        'github_create_issue' | 'github_search_repositories' | 'github_get_file_content';
}

export interface GitHubMCPResource extends MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

export interface MCPGitHubConfig {
  token?: string;
  appId?: number;
  privateKey?: string;
  installationId?: number;
  baseUrl?: string;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  content: string;
  encoding: 'base64' | 'utf-8';
  size: number;
  sha: string;
  htmlUrl: string;
  downloadUrl: string;
} 