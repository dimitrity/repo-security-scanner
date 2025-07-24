import { Injectable, Logger } from '@nestjs/common';
import { MCPGitHubService } from './mcp-github.service';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

@Injectable()
export class MCPToolsService {
  private readonly logger = new Logger(MCPToolsService.name);

  constructor(private readonly githubService: MCPGitHubService) {}

  /**
   * Get all available MCP tools
   */
  getAvailableTools(): MCPTool[] {
    return [
      {
        name: 'github_get_repository',
        description: 'Get detailed information about a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (username or organization)'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            }
          },
          required: ['owner', 'repo']
        }
      },
      {
        name: 'github_list_commits',
        description: 'List commits from a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            branch: {
              type: 'string',
              description: 'Branch name (optional)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of commits to return (default: 30)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['owner', 'repo']
        }
      },
      {
        name: 'github_get_commit',
        description: 'Get detailed information about a specific commit',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            sha: {
              type: 'string',
              description: 'Commit SHA hash'
            }
          },
          required: ['owner', 'repo', 'sha']
        }
      },
      {
        name: 'github_list_pull_requests',
        description: 'List pull requests from a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            state: {
              type: 'string',
              enum: ['open', 'closed', 'all'],
              description: 'Pull request state filter (default: open)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of PRs to return (default: 30)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['owner', 'repo']
        }
      },
      {
        name: 'github_get_file_content',
        description: 'Get the content of a file from a GitHub repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner'
            },
            repo: {
              type: 'string',
              description: 'Repository name'
            },
            path: {
              type: 'string',
              description: 'File path within the repository'
            },
            ref: {
              type: 'string',
              description: 'Git reference (branch, tag, or commit SHA) - optional'
            }
          },
          required: ['owner', 'repo', 'path']
        }
      },
      {
        name: 'github_search_repositories',
        description: 'Search GitHub repositories',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (can include qualifiers like language:javascript)'
            },
            sort: {
              type: 'string',
              enum: ['stars', 'forks', 'updated'],
              description: 'Sort order (default: stars)'
            },
            limit: {
              type: 'number',
              description: 'Maximum number of repositories to return (default: 30)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['query']
        }
      },
      {
        name: 'github_parse_url',
        description: 'Parse a GitHub URL to extract owner and repository information',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'GitHub repository URL (HTTPS, SSH, or API format)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'github_get_rate_limit',
        description: 'Get current GitHub API rate limit information',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  /**
   * Execute an MCP tool call
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      this.logger.log(`Executing MCP tool: ${toolCall.name}`);
      
      switch (toolCall.name) {
        case 'github_get_repository':
          return await this.executeGetRepository(toolCall.arguments);
        
        case 'github_list_commits':
          return await this.executeListCommits(toolCall.arguments);
        
        case 'github_get_commit':
          return await this.executeGetCommit(toolCall.arguments);
        
        case 'github_list_pull_requests':
          return await this.executeListPullRequests(toolCall.arguments);
        
        case 'github_get_file_content':
          return await this.executeGetFileContent(toolCall.arguments);
        
        case 'github_search_repositories':
          return await this.executeSearchRepositories(toolCall.arguments);
        
        case 'github_parse_url':
          return await this.executeParseUrl(toolCall.arguments);
        
        case 'github_get_rate_limit':
          return await this.executeGetRateLimit();
        
        default:
          throw new Error(`Unknown tool: ${toolCall.name}`);
      }
    } catch (error) {
      this.logger.error(`MCP tool execution failed: ${error.message}`);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool ${toolCall.name}: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  private async executeGetRepository(args: any): Promise<MCPToolResult> {
    const { owner, repo } = args;
    const repository = await this.githubService.getRepository(owner, repo);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(repository, null, 2)
        }
      ]
    };
  }

  private async executeListCommits(args: any): Promise<MCPToolResult> {
    const { owner, repo, branch, limit } = args;
    const commits = await this.githubService.listCommits(owner, repo, {
      branch,
      per_page: limit || 30
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(commits, null, 2)
        }
      ]
    };
  }

  private async executeGetCommit(args: any): Promise<MCPToolResult> {
    const { owner, repo, sha } = args;
    const commit = await this.githubService.getCommit(owner, repo, sha);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(commit, null, 2)
        }
      ]
    };
  }

  private async executeListPullRequests(args: any): Promise<MCPToolResult> {
    const { owner, repo, state, limit } = args;
    const pullRequests = await this.githubService.listPullRequests(owner, repo, {
      state: state || 'open',
      per_page: limit || 30
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(pullRequests, null, 2)
        }
      ]
    };
  }

  private async executeGetFileContent(args: any): Promise<MCPToolResult> {
    const { owner, repo, path, ref } = args;
    const fileContent = await this.githubService.getFileContent(owner, repo, path, ref);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(fileContent, null, 2)
        }
      ]
    };
  }

  private async executeSearchRepositories(args: any): Promise<MCPToolResult> {
    const { query, sort, limit } = args;
    const repositories = await this.githubService.searchRepositories(query, {
      sort: sort || 'stars',
      per_page: limit || 30
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(repositories, null, 2)
        }
      ]
    };
  }

  private async executeParseUrl(args: any): Promise<MCPToolResult> {
    const { url } = args;
    const parsed = this.githubService.parseGitHubUrl(url);
    
    if (!parsed) {
      throw new Error('Invalid GitHub URL format');
    }
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(parsed, null, 2)
        }
      ]
    };
  }

  private async executeGetRateLimit(): Promise<MCPToolResult> {
    const rateLimit = await this.githubService.getRateLimit();
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(rateLimit, null, 2)
        }
      ]
    };
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.getAvailableTools().find(tool => tool.name === name);
  }

  /**
   * Check if GitHub service is authenticated
   */
  async isGitHubAuthenticated(): Promise<boolean> {
    return await this.githubService.isAuthenticated();
  }
} 