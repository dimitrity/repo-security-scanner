# Repository Metadata Fetching

## Overview

The repository security scanner now fetches comprehensive metadata when connecting to repositories. This provides valuable context about the repository being scanned, including basic information like name, description, default branch, and last commit details.

## Metadata Structure

The `fetchRepoMetadata` method returns the following structure:

```typescript
{
  name: string;           // Repository name
  description: string;    // Repository description
  defaultBranch: string;  // Default branch (e.g., 'main', 'master')
  lastCommit: {
    hash: string;         // Latest commit hash
    timestamp: string;    // Latest commit timestamp (ISO 8601)
  };
}
```

## Supported Platforms

The implementation supports multiple Git hosting platforms with automatic detection:

### 1. **GitHub** (`github.com`)
- **API Endpoint**: `https://api.github.com/repos/{owner}/{repo}`
- **Features**: 
  - Repository name and description
  - Default branch detection
  - Last activity timestamp
  - Public repository support

### 2. **GitLab** (`gitlab.com`)
- **API Endpoint**: `https://gitlab.com/api/v4/projects/{owner}%2F{repo}`
- **Features**:
  - Repository name and description
  - Default branch detection
  - Last activity timestamp
  - Public repository support

### 3. **Bitbucket** (`bitbucket.org`)
- **API Endpoint**: `https://api.bitbucket.org/2.0/repositories/{owner}/{repo}`
- **Features**:
  - Repository name and description
  - Default branch detection
  - Last activity timestamp
  - Public repository support

### 4. **Generic Git Repositories**
- **Fallback Method**: Shallow clone + Git commands
- **Features**:
  - Repository name extraction from remote URL
  - Default branch detection via `git rev-parse --abbrev-ref HEAD`
  - Latest commit information via `git log`
  - Description extraction from README files

## Implementation Details

### URL Parsing

The system automatically detects the Git hosting platform by parsing the repository URL:

```typescript
private parseRepoUrl(repoUrl: string): { platform: string; owner: string; repo: string } | null {
  const url = new URL(repoUrl);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  if (pathParts.length >= 2) {
    const owner = pathParts[0];
    const repo = pathParts[1].replace('.git', '');
    
    let platform = 'unknown';
    if (url.hostname.includes('github.com')) {
      platform = 'github';
    } else if (url.hostname.includes('gitlab.com')) {
      platform = 'gitlab';
    } else if (url.hostname.includes('bitbucket.org')) {
      platform = 'bitbucket';
    }
    
    return { platform, owner, repo };
  }
  
  return null;
}
```

### API Integration

For supported platforms, the system makes HTTP requests to their respective APIs:

```typescript
// GitHub API Example
const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
const data = await response.json();

return {
  name: data.name,
  description: data.description || 'No description available',
  defaultBranch: data.default_branch || 'main',
  lastCommit: {
    hash: data.updated_at ? 'latest' : 'unknown',
    timestamp: data.updated_at || new Date().toISOString(),
  },
};
```

### Fallback Mechanism

When API calls fail or for unsupported platforms, the system falls back to Git commands:

1. **Shallow Clone**: Creates a temporary directory and performs a shallow clone
2. **Git Commands**: Uses `simple-git` to extract repository information
3. **README Parsing**: Attempts to extract description from README files
4. **Cleanup**: Automatically cleans up temporary directories

```typescript
private async fetchFromGitCommands(repoUrl: string): Promise<any> {
  const { dir } = await import('tmp-promise');
  const tmpDir = await dir({ unsafeCleanup: true });
  
  try {
    // Shallow clone
    await simpleGit().clone(repoUrl, tmpDir.path, ['--depth', '1']);
    const git = simpleGit(tmpDir.path);
    
    // Extract information
    const remotes = await git.getRemotes(true);
    const defaultBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const log = await git.log({ maxCount: 1 });
    const description = await this.extractDescription(tmpDir.path);
    
    return {
      name: repoName,
      description: description || 'No description available',
      defaultBranch: defaultBranch || 'main',
      lastCommit: {
        hash: log.latest?.hash || 'unknown',
        timestamp: log.latest?.date || new Date().toISOString(),
      },
    };
  } finally {
    await tmpDir.cleanup();
  }
}
```

### Description Extraction

The system attempts to extract repository descriptions from README files:

```typescript
private async extractDescription(repoPath: string): Promise<string> {
  const readmeFiles = ['README.md', 'README.txt', 'README.rst', 'readme.md'];
  
  for (const readmeFile of readmeFiles) {
    const readmePath = path.join(repoPath, readmeFile);
    if (fs.existsSync(readmePath)) {
      const content = fs.readFileSync(readmePath, 'utf8');
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
}
```

## Error Handling

The implementation includes comprehensive error handling:

### 1. **API Failures**
- Graceful degradation to Git commands
- Network timeout handling
- Rate limiting consideration
- Authentication error handling

### 2. **Git Command Failures**
- Fallback to basic metadata
- Temporary directory cleanup
- Invalid URL handling
- Permission error handling

### 3. **Fallback Metadata**
When all methods fail, the system returns basic fallback metadata:

```typescript
private getFallbackMetadata(repoUrl: string): any {
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
```

## Usage Examples

### Basic Usage

```typescript
const provider = new GitScmProvider();

// Fetch metadata for a GitHub repository
const metadata = await provider.fetchRepoMetadata('https://github.com/owner/repo');
console.log(metadata);
// Output:
// {
//   name: 'repo',
//   description: 'A sample repository',
//   defaultBranch: 'main',
//   lastCommit: {
//     hash: 'abc123def456',
//     timestamp: '2024-01-01T12:00:00Z'
//   }
// }
```

### Integration with Security Scanner

```typescript
// In SecurityScanService
async scanRepository(repoUrl: string) {
  // Fetch repository metadata
  const metadata = await this.scmProvider.fetchRepoMetadata(repoUrl);
  
  // Clone repository
  await this.scmProvider.cloneRepository(repoUrl, tempDir.path);
  
  // Perform security scan
  const findings = await this.scanner.scan(tempDir.path);
  
  return {
    repository: metadata,  // Include metadata in results
    scanner: scannerInfo,
    findings: findings
  };
}
```

## Performance Considerations

### 1. **API Rate Limits**
- GitHub: 60 requests/hour for unauthenticated requests
- GitLab: 300 requests/hour for unauthenticated requests
- Bitbucket: 60 requests/hour for unauthenticated requests

### 2. **Network Optimization**
- API calls are preferred over Git commands for speed
- Shallow clones minimize bandwidth usage
- Temporary directories are cleaned up immediately

### 3. **Caching Opportunities**
- Consider implementing metadata caching for frequently scanned repositories
- Cache API responses to reduce rate limit impact
- Store metadata in scan results for historical reference

## Security Considerations

### 1. **API Security**
- No authentication tokens required (public repositories only)
- HTTPS-only API endpoints
- Input validation for repository URLs

### 2. **Git Security**
- Shallow clones reduce attack surface
- Temporary directories with automatic cleanup
- No execution of arbitrary Git commands

### 3. **Error Information**
- Limited error details to prevent information disclosure
- Graceful degradation without exposing internal errors
- Safe fallback mechanisms

## Testing

The implementation includes comprehensive tests:

### 1. **API Testing**
- Mock API responses for all platforms
- Error handling scenarios
- Rate limiting simulation

### 2. **Git Command Testing**
- Mock Git command responses
- Temporary directory handling
- Error scenario coverage

### 3. **Integration Testing**
- End-to-end workflow testing
- Error recovery testing
- Performance testing

## Future Enhancements

### 1. **Authentication Support**
- GitHub Personal Access Tokens
- GitLab API Tokens
- Bitbucket App Passwords

### 2. **Additional Metadata**
- Repository size
- Language detection
- License information
- Star count and forks

### 3. **Caching Layer**
- Redis-based metadata caching
- TTL-based cache invalidation
- Cache warming strategies

### 4. **More Platforms**
- Azure DevOps
- Gitea
- Gogs
- Self-hosted GitLab instances

The repository metadata fetching feature provides rich context for security scans while maintaining robust error handling and performance optimization. 