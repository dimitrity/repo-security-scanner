# 🦊 Enhanced GitLab Support

## Overview

The Repository Security Scanner now provides comprehensive GitLab support with enhanced features for both GitLab.com and self-hosted GitLab instances. This includes authentication, private repository access, and GitLab-specific metadata extraction.

## Features

### ✅ Core Capabilities
- **GitLab.com Support**: Full integration with GitLab.com public and private repositories
- **Self-hosted GitLab**: Complete support for GitLab CE/EE instances
- **Authentication**: Personal Access Token support for private repositories
- **Comprehensive Metadata**: Enhanced repository information extraction
- **Private Repository Access**: Secure token-based authentication
- **Robust Error Handling**: Graceful fallbacks when API access fails

### ✅ GitLab-Specific Features
- **Project Metadata**: Complete project information including visibility, statistics
- **Contributor Information**: Automatic contributor count extraction
- **Commit History**: Latest commit details with author and message
- **GitLab Features**: Issues, merge requests, wiki, container registry status
- **Repository Statistics**: Forks, stars, and activity metrics
- **Multiple URL Formats**: Support for various GitLab URL structures

## Configuration

### Environment Variables

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `GITLAB_TOKEN` | GitLab Personal Access Token | `glpat-xxxxxxxxxxxxxxxxxxxx` | No* |
| `GITLAB_ACCESS_TOKEN` | Alternative token variable | `glpat-xxxxxxxxxxxxxxxxxxxx` | No* |

*Required for private repositories and enhanced metadata

### Personal Access Token Setup

#### 1. Create GitLab Personal Access Token
1. **Login to GitLab**: Go to your GitLab instance (GitLab.com or self-hosted)
2. **Navigate to Settings**: User Settings → Access Tokens
3. **Create New Token**:
   - **Name**: `Repository Security Scanner`
   - **Expiration**: Set appropriate expiration date
   - **Scopes**: Select `read_repository` (minimum required)
   - **Optional Scopes**: `read_api` for enhanced metadata

4. **Copy Token**: Save the generated token (starts with `glpat-`)

#### 2. Configure Environment

**Option A: Environment Variable**
```bash
export GITLAB_TOKEN=glpat-your-token-here
```

**Option B: .env File**
```bash
echo "GITLAB_TOKEN=glpat-your-token-here" > .env
```

**Option C: Docker**
```bash
docker run -e GITLAB_TOKEN=glpat-your-token-here repo-security-scanner
```

**Option D: Docker Compose**
```yaml
services:
  security-scanner:
    environment:
      - GITLAB_TOKEN=glpat-your-token-here
```

## Usage Examples

### Public Repository (No Authentication)
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.com/gitlab-org/gitlab-foss"}'
```

### Private Repository (With Authentication)
```bash
# Set token first
export GITLAB_TOKEN=glpat-your-token-here

curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.com/private-org/private-repo"}'
```

### Self-hosted GitLab Instance
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.company.com/team/project"}'
```

### Group and Subgroup Repositories
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.com/group/subgroup/project"}'
```

## Response Format

### Enhanced Repository Metadata
```json
{
  "repository": {
    "name": "project-name",
    "description": "Project description",
    "defaultBranch": "main",
    "lastCommit": {
      "hash": "abc123def456",
      "timestamp": "2024-01-01T12:00:00Z",
      "message": "Latest commit message",
      "author": "Developer Name"
    },
    "gitlab": {
      "id": 12345,
      "namespace": "group-name",
      "visibility": "private",
      "forksCount": 42,
      "starsCount": 123,
      "issuesEnabled": true,
      "mergeRequestsEnabled": true,
      "wikiEnabled": true,
      "snippetsEnabled": true,
      "containerRegistryEnabled": true,
      "packagesEnabled": true,
      "contributorCount": 15,
      "webUrl": "https://gitlab.com/group/project",
      "sshUrlToRepo": "git@gitlab.com:group/project.git",
      "httpUrlToRepo": "https://gitlab.com/group/project.git",
      "readmeUrl": "https://gitlab.com/group/project/-/blob/main/README.md",
      "avatarUrl": "https://gitlab.com/uploads/project/avatar/123/avatar.png",
      "topics": ["javascript", "security", "scanning"],
      "createdAt": "2023-01-01T00:00:00Z",
      "lastActivityAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

## Supported URL Formats

The scanner supports various GitLab URL formats:

### GitLab.com
- `https://gitlab.com/user/repo`
- `https://gitlab.com/user/repo.git`
- `https://gitlab.com/group/project`
- `https://gitlab.com/group/subgroup/project`
- `https://gitlab.com/group/subgroup/project.git`

### Self-hosted GitLab
- `https://gitlab.company.com/team/project`
- `https://code.organization.org/group/repo`
- `https://git.internal.net/department/app.git`

### Authentication Formats
With tokens, both HTTPS and authenticated URLs work:
- `https://gitlab.com/private/repo` (token added automatically)
- `https://oauth2:token@gitlab.com/private/repo` (explicit auth)

## Error Handling

### Graceful Fallbacks
1. **API Failure**: Falls back to Git commands for basic metadata
2. **Authentication Issues**: Attempts public access, then Git fallback
3. **Network Timeouts**: Provides error message with context
4. **Invalid Tokens**: Logs warning and continues with public access
5. **Repository Not Found**: Clear error message with suggestions

### Common Error Scenarios

#### Private Repository Without Token
```json
{
  "error": "Failed to clone repository",
  "message": "Authentication required for private repository",
  "suggestion": "Set GITLAB_TOKEN environment variable"
}
```

#### Invalid Token
```json
{
  "repository": {
    "name": "repo-name",
    "description": "Repository information unavailable",
    "defaultBranch": "main"
  },
  "warning": "GitLab API authentication failed, using Git fallback"
}
```

#### Self-hosted Instance Not Accessible
```json
{
  "error": "Failed to connect to GitLab instance",
  "message": "Could not reach https://gitlab.internal.com",
  "suggestion": "Verify network connectivity and URL"
}
```

## Security Considerations

### Token Security
- **Environment Variables**: Store tokens in environment variables, not code
- **Docker Secrets**: Use Docker secrets for production deployments
- **Token Rotation**: Regularly rotate Personal Access Tokens
- **Minimal Scopes**: Use `read_repository` scope only when possible

### Network Security
- **HTTPS Only**: All GitLab communication uses HTTPS
- **Token Transmission**: Tokens sent via secure Authorization header
- **Local Processing**: Repository content processed locally, not transmitted

### Access Control
- **Repository Permissions**: Respects GitLab repository permissions
- **Token Permissions**: Limited by token scope and user permissions
- **Audit Trail**: All API requests logged for security auditing

## Troubleshooting

### Common Issues

#### Issue: "GitLab API returned 401"
**Solution**: Check token validity and permissions
```bash
# Test token manually
curl -H "Authorization: Bearer $GITLAB_TOKEN" \
  https://gitlab.com/api/v4/user
```

#### Issue: "Repository not found"
**Solutions**:
1. Verify repository URL is correct
2. Check if repository is private (requires token)
3. Ensure token has access to the repository

#### Issue: "Self-hosted GitLab not accessible"
**Solutions**:
1. Verify network connectivity
2. Check if GitLab instance is running
3. Confirm API is enabled on the instance

#### Issue: Slow response times
**Solutions**:
1. Use tokens for faster API access
2. Check network connectivity to GitLab
3. Monitor GitLab API rate limits

### Debug Mode
Enable debug logging to troubleshoot issues:
```bash
export LOG_LEVEL=debug
npm run start:dev
```

## CI/CD Integration

### GitLab CI/CD Pipeline
```yaml
# .gitlab-ci.yml
security-scan:
  stage: test
  image: node:20
  script:
    - npm install -g @repo-security/scanner
    - security-scan --repo $CI_PROJECT_URL --token $GITLAB_TOKEN
  variables:
    GITLAB_TOKEN: $GITLAB_ACCESS_TOKEN
  artifacts:
    reports:
      security: security-report.json
```

### GitHub Actions with GitLab
```yaml
# .github/workflows/security.yml
- name: Scan GitLab Repository
  env:
    GITLAB_TOKEN: ${{ secrets.GITLAB_TOKEN }}
  run: |
    curl -X POST ${{ secrets.SCANNER_URL }}/scan \
      -H "x-api-key: ${{ secrets.API_KEY }}" \
      -d '{"repoUrl": "https://gitlab.com/org/repo"}'
```

## Performance Optimization

### Token Usage Benefits
- **Faster API Access**: Authenticated requests have higher rate limits
- **Enhanced Metadata**: Additional repository information
- **Private Repository Support**: Access to private repositories
- **Contributor Information**: Detailed contributor statistics

### Caching Strategy
- **Metadata Caching**: Repository metadata cached for change detection
- **Token Validation**: Token validity cached to reduce API calls
- **Network Optimization**: Efficient API request batching

## Migration Guide

### From Basic GitLab Support
1. **Add Token**: Set `GITLAB_TOKEN` environment variable
2. **Update URLs**: Ensure URL format is correct
3. **Test Access**: Verify private repository access works
4. **Monitor Logs**: Check for authentication success messages

### Configuration Updates
```bash
# Before (basic support)
export REPO_URL=https://gitlab.com/org/repo

# After (enhanced support)
export GITLAB_TOKEN=glpat-your-token-here
export REPO_URL=https://gitlab.com/org/repo
```

## API Reference

### GitLab-Specific Endpoints
All standard endpoints work with GitLab repositories:

- `POST /scan` - Scan GitLab repository
- `POST /scan/force` - Force scan (bypass change detection)
- `GET /scan/statistics` - View scan statistics
- `GET /scan/records` - View scan history

### GitLab Metadata Fields
When using tokens, additional GitLab-specific metadata is available in the response under the `gitlab` object.

## Support Matrix

| Feature | GitLab.com | Self-hosted CE | Self-hosted EE |
|---------|------------|----------------|----------------|
| Public Repository Scanning | ✅ | ✅ | ✅ |
| Private Repository Scanning | ✅ | ✅ | ✅ |
| Basic Metadata | ✅ | ✅ | ✅ |
| Enhanced Metadata | ✅ | ✅ | ✅ |
| Contributor Statistics | ✅ | ✅ | ✅ |
| GitLab-specific Features | ✅ | ✅ | ✅ |
| API Authentication | ✅ | ✅ | ✅ |

## Contributing

### Testing GitLab Support
```bash
# Run GitLab-specific tests
npm run test:integration -- gitlab-support

# Test with real GitLab repository
export GITLAB_TOKEN=your-token
npm run test:e2e
```

### Adding Features
1. Update `GitScmProvider` class
2. Add tests in `gitlab-support.integration.spec.ts`
3. Update documentation
4. Test with both GitLab.com and self-hosted instances

---

For additional support or questions about GitLab integration, please check the main README.md or create an issue in the repository. 