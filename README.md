# Repository Security Scanner

## Project Overview

The Repository Security Scanner is a security analysis platform built with NestJS that automatically scans Git repositories for security vulnerabilities, secrets, and code quality issues. It features **dual scanner integration**, **change detection**, **multi-platform SCM support**, and a web interface for viewing results.

### Key Features

- **Dual Scanner Integration**: Semgrep for static analysis + Gitleaks for secret detection
- **Multi-Platform SCM Support**: GitHub, GitLab, and Bitbucket with provider selection
- **Modern Web UI**: GitHub-style interface with instant code context viewing
- **Embedded Code Context**: View code snippets directly in scan results without additional API calls
- **Change Detection**: Skip scans when no repository changes detected
- **Provider Selection**: Best SCM provider automatically chosen based on repository URL
- **Scanner Summary Dashboard**: Real-time issue counts and scanner status
- **Secure API**: API key authentication with input validation and sanitization
- **Docker Ready**: Containerization with docker-compose support
- **Cross-Platform**: Supports macOS, Linux, Windows, and Docker environments
- **Scan Statistics**: Track scanning activity and repository history
- **Force Scan Option**: Bypass change detection when needed
- **Health Monitoring**: Provider health checks and performance monitoring
- **Intelligent Caching**: Cache scan results with TTL and automatic invalidation
- **Performance Analytics**: Detailed scan duration and cache hit tracking
- **Enhanced History**: Comprehensive scan history with performance metrics

### Security Scanners

#### Semgrep (Static Analysis)
- **Purpose**: Code security vulnerabilities, OWASP patterns, custom rules
- **Features**: 1000+ built-in rules, custom rule support, high accuracy
- **Detects**: SQL injection, XSS, weak crypto, path traversal, etc.

#### Gitleaks (Secret Detection)
- **Purpose**: Hardcoded secrets, API keys, credentials
- **Features**: Entropy-based detection, custom patterns, Git history scanning
- **Detects**: AWS keys, GitHub tokens, passwords, private keys, etc.

### Security Features

- **API Key Authentication**: Secure API access control
- **Input Validation**: Request sanitization and validation
- **Path Traversal Protection**: Secure file system access
- **Safe Scanner Execution**: Isolated scanner process execution

### Caching System

The Repository Security Scanner includes a sophisticated caching system to optimize performance and reduce redundant scans:

#### **Cache Features**
- **TTL-based Caching**: Configurable time-to-live for cached results (default: 1 hour)
- **Commit-based Keys**: Cache entries keyed by repository URL and commit hash
- **Smart Cache Checking**: Check for cached results even when repository has been updated
- **Automatic Cleanup**: Periodic cleanup of expired cache entries
- **Size Management**: Automatic eviction of oldest entries when cache limit reached
- **Cache Invalidation**: Manual invalidation by repository or specific commit

#### **Performance Benefits**
- **Reduced Scan Time**: Instant results for unchanged repositories
- **Smart Cache Utilization**: Serve cached results even when repository has minor updates
- **Bandwidth Savings**: Avoid unnecessary repository cloning
- **Resource Optimization**: Reduced CPU and memory usage
- **Scalability**: Support for high-frequency scanning operations

#### **Cache Management API**
```bash
# Get cache statistics
GET /cache/statistics

# List cached repositories
GET /cache/repositories

# Clear all cache
DELETE /cache

# Invalidate specific repository cache
DELETE /cache/{repository-url}
```

#### **Enhanced Analytics**
- **Cache Hit Tracking**: Monitor cache effectiveness
- **Scan Duration Metrics**: Track performance improvements
- **Repository History**: Detailed scan history with performance data
- **Stale Repository Detection**: Identify repositories needing updates

### SCM Abstraction Layer

**Multi-provider architecture for source control integration:**

#### **Supported Platforms**
- **GitHub**: 
  - Full API integration with authentication
  - Private repository support
  - Enhanced metadata extraction
  - Rate limit handling
  
- **GitLab**:
  - **GitLab.com & Self-hosted**: Full support for both public GitLab.com and private GitLab instances
  - **Authentication**: Personal Access Token support for private repositories
  - **Metadata**: Repository details, contributor stats, commit history
  - **Private Repository Access**: Secure token-based authentication for private repos
  - **CI/CD Integration**: Compatible with GitLab CI/CD pipelines

- **Enhanced Git**: 
  - Universal Git repository support
  - Automatic authentication handling
  - Fallback for any Git hosting platform

#### **Key Capabilities**
- **Provider Selection**: Best provider automatically chosen based on URL
- **Automatic Fallback**: Graceful degradation when providers fail
- **Multi-Platform Authentication**: Token-based auth with environment variables
- **Provider Health Monitoring**: Real-time status and performance tracking
- **Extensible**: Add new providers with code changes
- **Analytics & Insights**: Provider usage statistics and recommendations

#### **Extensible Design**
```typescript
// Adding a new provider:
@Injectable()
export class BitbucketScmProvider extends BaseScmProvider {
  // Implement platform-specific logic
}
```

### Repository Platform Support

The SCM abstraction layer provides unified support for multiple platforms:

| Platform | Support Level | Features |
|----------|---------------|----------|
| **GitHub** | Full | API integration, private repos, metadata, rate limiting |
| **GitLab** | Enhanced | SaaS + self-hosted, private repos, comprehensive metadata |
| **Bitbucket** | Full | API integration, private repos, metadata, rate limiting |
| **Generic Git** | Full | Any Git repository, SSH/HTTPS, fallback support |

**Platform Detection**: Repositories are automatically routed to the optimal provider based on hostname and URL patterns.

## Quick Start

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Git**: For repository cloning
- **Semgrep**: Static analysis scanner
- **Gitleaks**: Secret detection scanner
- **Docker**: Optional, for containerized deployment

### Installation

#### 1. Clone and Setup
```bash
git clone <repository-url>
cd repo-security-scanner-app
npm install
```

#### 2. Install Security Scanners

**Semgrep:**
```bash
# macOS
brew install semgrep

# Ubuntu/Debian
pip3 install semgrep

# Windows
pip install semgrep
```

**Gitleaks:**
```bash
# macOS
brew install gitleaks

# Ubuntu/Debian
wget https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_<version>_linux_x64.tar.gz
tar -xzf gitleaks_<version>_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Windows
winget install gitleaks
```

#### 3. Configuration

**Setup:**
The application is preconfigured with a default API key. For production, you can optionally set your own:

```bash
# Optional: Create .env file for custom configuration
PORT=3000
API_KEYS=your-custom-api-key-here

# Optional: Enhanced GitHub metadata support  
GITHUB_TOKEN=your-github-token
```

**Note:** The frontend and backend are automatically synchronized with the same API key.

**Enhanced SCM Support:**
```bash
# Optional: Enhanced GitHub metadata support  
GITHUB_TOKEN=your-github-token

# Optional: GitLab support (SaaS or self-hosted)
GITLAB_TOKEN=your-gitlab-token
# Alternative GitLab token environment variable
GITLAB_ACCESS_TOKEN=your-gitlab-access-token

# Optional: Bitbucket support
BITBUCKET_TOKEN=your-bitbucket-app-password
# Alternative Bitbucket token environment variable  
BITBUCKET_APP_PASSWORD=your-bitbucket-app-password
```

### Running the Application

#### Local Development
```bash
# Start development server
npm run start:dev

# Or build and run
npm run build
npm run start:prod
```

#### Docker (Recommended)
```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Environment Configuration

The application works out of the box with sensible defaults. Optional configuration:

```bash
# Basic Configuration
export PORT="3000"                              # Application port (default: 3000)
export API_KEYS="your-custom-api-key"          # Custom API key (optional)

# SCM Platform Authentication (Optional)
export GITHUB_TOKEN="your-github-token"        # Enhanced GitHub metadata and private repos
export GITLAB_TOKEN="your-gitlab-token"        # GitLab SaaS and self-hosted support
export BITBUCKET_TOKEN="your-bitbucket-token"  # Bitbucket private repos and enhanced metadata

# Alternative environment variable names also supported:
export GITLAB_ACCESS_TOKEN="your-gitlab-token"
export BITBUCKET_APP_PASSWORD="your-bitbucket-app-password"
```

**Supported Repository Platforms:**
- **GitHub** (github.com) - Public repos work without authentication, private repos require `GITHUB_TOKEN`
- **GitLab** (gitlab.com + self-hosted) - Public repos work without authentication, private repos require `GITLAB_TOKEN`
- **Bitbucket** (bitbucket.org) - Public repos work without authentication, private repos require `BITBUCKET_TOKEN`
- **Generic Git** - Any Git repository accessible via HTTPS/SSH

For Docker deployment, you can set these in your `docker-compose.yml` or pass them as environment variables.

## Web Interface

Access the web interface at `http://localhost:3000`

### Features:
- **Repository Scanning**: Enter any Git repository URL and scan instantly
- **Real-time Results**: Live scanner progress and issue counts
- **Code Context Viewer**: Click any finding to see highlighted code snippets
- **Scanner Summary**: Overview of all scanners with issue breakdown
- **Force Scan**: Bypass change detection for rescans
- **GitHub-style UI**: Familiar, modern interface design

### Usage:
1. Navigate to `http://localhost:3000`
2. Enter a repository URL (e.g., `https://github.com/user/repo`)
3. Click "Scan Repository" or "Force Scan"
4. View results with embedded code context
5. Click on any finding to see detailed code snippets

## API Documentation

### Authentication

All API endpoints require the `x-api-key` header. The default API key is `your-secure-production-key-2025`:

```bash
curl -H "x-api-key: your-secure-production-key-2025" http://localhost:3000/scan/statistics
```

You can customize the API key by setting the `API_KEYS` environment variable.

### Endpoints

#### Scan Repository
```bash
POST /scan
Content-Type: application/json
x-api-key: your-api-key-here

{
  "repoUrl": "https://github.com/user/repository"
}
```

#### Force Scan
```bash
POST /scan/force
Content-Type: application/json
x-api-key: your-api-key-here

{
  "repoUrl": "https://github.com/user/repository"
}
```

#### Get Statistics
```bash
GET /scan/statistics
x-api-key: your-api-key-here
```

#### Get Scan Records
```bash
GET /scan/records
x-api-key: your-api-key-here
```

#### Get Scan History
```bash
GET /scan/history/{repository-url}
x-api-key: your-api-key-here
```

#### Get Stale Repositories
```bash
GET /scan/stale
x-api-key: your-api-key-here
```

#### Get Most Scanned Repositories
```bash
GET /scan/most-scanned
x-api-key: your-api-key-here
```

#### Get Most Cached Repositories
```bash
GET /scan/most-cached
x-api-key: your-api-key-here
```

#### Cache Management

##### Get Cache Statistics
```bash
GET /cache/statistics
x-api-key: your-api-key-here
```

##### Get Cached Repositories
```bash
GET /cache/repositories
x-api-key: your-api-key-here
```

##### Get Cached Results for Repository
```bash
GET /cache/repository/{repository-url}
x-api-key: your-api-key-here
```

##### Clear All Cache
```bash
DELETE /cache
x-api-key: your-api-key-here
```

##### Invalidate Repository Cache
```bash
DELETE /cache/{repository-url}
x-api-key: your-api-key-here
```

#### Get Code Context
```bash
POST /scan/context
Content-Type: application/json
x-api-key: your-api-key-here

{
  "repoUrl": "https://github.com/user/repository",
  "filePath": "src/file.js",
  "line": 25,
  "context": 5
}
```

**Authentication:**
- Use API key `your-secure-production-key-2025` in the `x-api-key` header
- Customize by setting the `API_KEYS` environment variable
- All API endpoints require authentication (except static UI)

## Postman Collection

A Postman collection is included for API testing and development.

#### Quick Start

1. **Import the Collection:**
   ```bash
   # In Postman: File → Import → Upload Files
   # Select: Repository-Security-Scanner.postman_collection.json
   ```

2. **Configure Variables:**
   - `base_url`: `http://localhost:3000` (or your server URL)
   - `api_key`: `your-secure-production-key-2025` (or your custom key)

3. **Start Testing:**
   - Use individual requests or run the entire collection
   - Test various repository platforms (GitHub, GitLab, Bitbucket)
   - Validate error handling and edge cases

#### Collection Features

**Repository Scanning:**
- GitHub repository scanning
- GitLab repository scanning  
- Bitbucket repository scanning
- Force scan capabilities
- Custom repository testing

**Code Context:**
- Get code context around specific lines
- Configurable context window
- Multiple file format support

**Statistics & Records:**
- Scan statistics retrieval
- Historical scan records
- Provider health monitoring
- Enhanced analytics and performance metrics

**Cache Management:**
- Cache statistics and monitoring
- Repository cache invalidation
- Cache performance analytics
- Cache cleanup operations

**Error Testing:**
- Authentication validation
- Input validation testing
- URL format verification
- Non-existent repository handling

**Pre-configured Test Cases:**
- **Load Testing**: Multiple concurrent scans
- **URL Format Testing**: Various repository URL patterns
- **Error Scenarios**: Error handling validation
- **Multi-Platform**: GitHub, GitLab, Bitbucket, and generic Git

#### Advanced Usage

**Environment Variables:**
```json
{
  "base_url": "http://localhost:3000",
  "api_key": "your-secure-production-key-2025",
  "test_repo_github": "https://github.com/OWASP/NodeGoat",
  "test_repo_gitlab": "https://gitlab.com/gitlab-org/gitlab-foss",
  "test_repo_bitbucket": "https://bitbucket.org/atlassian/atlassian-frontend"
}
```

**Collection Runner:**
- Use Postman Runner for automated testing
- Configure iterations for load testing
- Monitor response times and success rates
- Export results for performance analysis

**Newman CLI Integration:**
```bash
# Install Newman (Postman CLI)
npm install -g newman

# Run collection from command line
newman run Repository-Security-Scanner.postman_collection.json \
  --env-var "base_url=http://localhost:3000" \
  --env-var "api_key=your-api-key"
```

### API Response Format

The API returns structured results with embedded code context:

```json
{
  "repository": {
    "name": "repository-name",
    "description": "Repository description",
    "defaultBranch": "main",
    "lastCommit": {
      "hash": "abc123...",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  },
  "summary": {
    "totalSecurityIssues": 8,
    "scanners": [
      {
        "name": "Semgrep",
        "version": "latest",
        "securityIssuesFound": 5,
        "summary": "Semgrep found 5 security issues"
      },
      {
        "name": "Gitleaks",
        "version": "latest", 
        "securityIssuesFound": 3,
        "summary": "Gitleaks found 3 security issues"
      }
    ]
  },
  "details": {
    "scanners": [
      {
        "name": "Semgrep",
        "version": "latest",
        "totalSecurityIssues": 5,
        "severityBreakdown": {
          "high": 2,
          "medium": 2,
          "low": 1,
          "info": 0
        },
        "securityIssues": {
          "high": [
            {
              "ruleId": "javascript.lang.security.audit.sqli.pg-sqli",
              "message": "Detected string concatenation with a non-literal variable in a pg query",
              "filePath": "src/database/queries.js",
              "line": 45,
              "severity": "high",
              "scanner": "Semgrep",
              "codeContext": {
                "filePath": "src/database/queries.js",
                "line": 45,
                "startLine": 40,
                "endLine": 50,
                "context": [
                  {
                    "lineNumber": 40,
                    "content": "// User query function",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 41,
                    "content": "function getUserData(userId) {",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 42,
                    "content": "  const client = new pg.Client();",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 43,
                    "content": "  ",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 44,
                    "content": "  // Vulnerable SQL injection",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 45,
                    "content": "  const query = 'SELECT * FROM users WHERE id = ' + userId;",
                    "isTargetLine": true
                  },
                  {
                    "lineNumber": 46,
                    "content": "  ",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 47,
                    "content": "  return client.query(query);",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 48,
                    "content": "}",
                    "isTargetLine": false
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "name": "Gitleaks",
        "version": "latest",
        "totalSecurityIssues": 3,
        "severityBreakdown": {
          "high": 2,
          "medium": 0,
          "low": 0,
          "info": 1
        },
        "securityIssues": {
          "high": [
            {
              "ruleId": "gitleaks.aws-access-key-id",
              "message": "AWS Access Key ID detected",
              "filePath": "config/aws.js", 
              "line": 3,
              "severity": "high",
              "scanner": "Gitleaks",
              "secret": "AKIAIOSFODNN7EXAMPLE",
              "codeContext": {
                "filePath": "config/aws.js",
                "line": 3,
                "startLine": 1,
                "endLine": 8,
                "context": [
                  {
                    "lineNumber": 1,
                    "content": "// AWS Configuration",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 2,
                    "content": "",
                    "isTargetLine": false  
                  },
                  {
                    "lineNumber": 3,
                    "content": "const AWS_ACCESS_KEY = 'AKIAIOSFODNN7EXAMPLE';",
                    "isTargetLine": true
                  },
                  {
                    "lineNumber": 4,
                    "content": "const AWS_SECRET = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 5,
                    "content": "",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 6,
                    "content": "module.exports = {",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 7,
                    "content": "  accessKey: AWS_ACCESS_KEY,",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 8,
                    "content": "  secretKey: AWS_SECRET",
                    "isTargetLine": false
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  },
  "allSecurityIssues": {
    "Semgrep": [...],
    "Gitleaks": [...]
  },
  "changeDetection": {
    "hasChanges": true,
    "lastCommitHash": "abc123...",
    "scanSkipped": false
  }
}
```

### Change Detection Response

When no changes are detected:
```json
{
  "repository": {...},
  "scanner": {
    "name": "Change Detection",
    "version": "1.0"
  },
  "securityIssues": [
    {
      "ruleId": "CHANGE-DETECTION-001",
      "message": "No changes detected for the repo",
      "filePath": "N/A",
      "line": 0,
      "severity": "info"
    }
  ],
  "changeDetection": {
    "hasChanges": false,
    "lastCommitHash": "abc123...",
    "scanSkipped": true,
    "reason": "No changes detected since last scan"
  }
}
```

## Testing

### Run Tests
```bash
# Unit tests
npm run test

# Integration tests  
npm run test:integration

# E2E tests
npm run test:e2e

# All tests with coverage
npm run test:cov

# CI mode
npm run test:ci
```

### Test Coverage
The project includes testing:
- **Unit Tests**: All services, providers, and utilities
- **Integration Tests**: API endpoints and scanner integration
- **E2E Tests**: Workflow testing
- **Change Detection Tests**: Repository change tracking

## Architecture & Project Structure

### System Overview

The Repository Security Scanner follows a **modular, layered architecture** built on NestJS principles, emphasizing security, scalability, and maintainability. The system features a **SCM abstraction layer** that provides multi-platform repository support.

```mermaid
graph TD
    A[Web UI] --> B[Security Scan Controller]
    B --> C[API Key Guard]
    C --> D[Security Scan Service]
    D --> E[SCM Manager Service]
    E --> F[SCM Provider Registry]
    F --> G[GitHub Provider]
    F --> H[GitLab Provider] 
    F --> I[Enhanced Git Provider]
    D --> J[Scanner Services]
    D --> K[Scan Storage Service]
    J --> L[Semgrep Scanner]
    J --> M[Gitleaks Scanner]
    D --> N[Code Context Extraction]
    
    style E fill:#e1f5fe
    style F fill:#e8f5e8
    style G fill:#f3e5f5
    style H fill:#fff3e0
    style I fill:#fce4ec
```

### Enhanced Project Structure

```
repo-security-scanner-app/
├── src/                              # Backend application source
│   ├── security-scan/                # Core security scanning module
│   │   ├── dto/                      # Data Transfer Objects & validation
│   │   │   ├── scan-request.dto.ts          # Scan request validation
│   │   │   ├── scan-result.dto.ts           # Scan response structure  
│   │   │   └── code-context-request.dto.ts  # Code context requests
│   │   ├── guards/                   # Authentication & authorization
│   │   │   ├── api-key.guard.ts             # API key authentication
│   │   │   └── api-key.guard.spec.ts        # Comprehensive guard tests
│   │   ├── interfaces/               # TypeScript contracts
│   │   │   ├── scanners.interface.ts        # Scanner service contracts
│   │   │   └── scm.interface.ts             # Enhanced SCM abstractions
│   │   ├── providers/                # Service implementations
│   │   │   ├── SCM Abstraction Layer
│   │   │   ├── scm-provider.registry.ts     # Provider registry & selection
│   │   │   ├── scm-manager.service.ts       # High-level SCM operations  
│   │   │   ├── scm-git-enhanced.provider.ts # Enhanced Git provider
│   │   │   ├── scm-github.provider.ts       # GitHub API integration
│   │   │   ├── scm-gitlab.provider.ts       # GitLab API integration
│   │   │   ├── Security Scanners
│   │   │   ├── scanner-semgrep.service.ts   # Semgrep static analysis
│   │   │   ├── scanner-gitleaks.service.ts  # Gitleaks secret detection
│   │   │   └── scan-storage.service.ts      # In-memory scan history
│   │   ├── security-scan.controller.ts      # REST API endpoints
│   │   ├── security-scan.service.ts         # Core business logic
│   │   └── security-scan.module.ts          # Module configuration
│   ├── config/                       # Configuration management
│   │   ├── config.service.ts                # Environment & API key config
│   │   └── config.module.ts                 # Configuration module
│   ├── app.module.ts                 # Root application module
│   └── main.ts                      # Application bootstrap
├── public/                           # Frontend web interface
│   ├── index.html                   # Main UI application
│   ├── script.js                   # Frontend JavaScript logic
│   └── style.css                   # GitHub-inspired styling
├── test/                            # Test suites
│   ├── integration/                 # Integration test scenarios
│   │   ├── security-scan.integration.spec.ts  # API integration tests
│   │   ├── change-detection.integration.spec.ts # Change detection tests
│   │   └── gitlab-support.integration.spec.ts   # GitLab integration tests
│   ├── app.e2e-spec.ts             # End-to-end workflow tests
│   ├── setup.ts                    # Test environment setup
│   └── jest-e2e.json              # E2E test configuration
├── docker-compose.yml              # Container orchestration
├── Dockerfile                      # Multi-stage container build
├── Documentation
├── SCM_ABSTRACTION_LAYER.md        # SCM architecture guide
├── GITLAB_SUPPORT.md               # GitLab integration documentation
└── README.md                       # Documentation
```

### Enhanced Architectural Layers

#### 1. **Presentation Layer**
- **Web UI**: Modern GitHub-style interface with real-time updates
- **REST Controller**: Type-safe API endpoints with validation
- **Authentication Guard**: Multi-key API authentication with ConfigService

#### 2. **Business Logic Layer**
- **Security Scan Service**: Orchestrates scanning workflows with multi-provider support
- **SCM Manager Service**: High-level SCM operations across all providers
- **Change Detection**: Repository change tracking with provider-specific optimizations
- **Code Context Extraction**: Embedded code snippet generation with enhanced metadata
- **Result Aggregation**: Multi-scanner result synthesis with structured output

#### 3. **SCM Abstraction Layer**
- **Provider Registry**: Automatic provider selection and health monitoring
- **GitHub Provider**: Full GitHub API integration with authentication
- **GitLab Provider**: Enhanced GitLab support (SaaS + self-hosted)
- **Enhanced Git Provider**: Universal Git repository support with fallback capabilities
- **Authentication Management**: Multi-platform token-based authentication
- **Health Monitoring**: Provider status tracking and performance analytics

#### 4. **Service Layer**
- **Scanner Services**: Pluggable security scanner implementations (Semgrep, Gitleaks)
- **Storage Service**: Scan history and statistics management
- **Configuration Service**: Environment-based configuration management

#### 5. **Infrastructure Layer**
- **Temporary File Management**: Secure repository cloning and cleanup
- **Process Execution**: Sandboxed scanner process management
- **Error Handling**: Error recovery and logging

### Enhanced Core Components

#### **SCM Manager Service**
```typescript
@Injectable()
export class ScmManagerService {
  // High-level SCM operations
  // Automatic provider selection
  // Multi-repository operations
  // Provider health monitoring
}
```

#### **SCM Provider Registry**
```typescript
@Injectable()
export class ScmProviderRegistryService {
  // Provider registration and management
  // Provider selection
  // Health monitoring and analytics
}
```

#### **Enhanced Git Provider**
```typescript
@Injectable()
export class EnhancedGitScmProvider extends BaseScmProvider {
  // Universal Git repository support
  // Authentication handling
  // Metadata extraction
}
```

#### **SecurityScanController**
```typescript
@Controller()
@UseGuards(ApiKeyGuard)
export class SecurityScanController {
  // REST endpoints with input validation
  // Supports scan, force-scan, context, statistics
}
```

#### **SecurityScanService** 
```typescript
@Injectable()
export class SecurityScanService {
  // Core scanning orchestration with SCM abstraction
  // Change detection logic
  // Multi-scanner coordination
  // Code context embedding
}
```

#### **ConfigService**
```typescript
@Injectable() 
export class ConfigService implements OnModuleInit {
  // Environment variable management
  // API key validation and storage
  // Development/production modes
}
```

#### **Scanner Services**
```typescript
export interface SecurityScanner {
  scan(targetPath: string): Promise<Finding[]>;
  getName(): string;
  getVersion(): string;
}
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant UI as Web UI
    participant C as Controller
    participant G as ApiKeyGuard
    participant S as ScanService
    participant SCM as GitProvider
    participant SCAN as Scanners
    participant STORE as Storage

    UI->>C: POST /scan {repoUrl}
    C->>G: Validate API Key
    G-->>C: Authenticated
    C->>S: scanRepository(repoUrl)
    S->>STORE: Check last scan
    S->>SCM: Clone repository
    S->>SCAN: Run all scanners
    SCAN-->>S: Security findings
    S->>S: Extract code context
    S->>STORE: Update scan record
    S-->>C: Structured results
    C-->>UI: JSON response
```

### Security Architecture

#### **Authentication Flow**
1. **API Key Validation**: Multi-key support with format validation
2. **Request Sanitization**: Input validation and path traversal protection  
3. **Validation**: API key checking
4. **Environment Separation**: Development fallback vs production enforcement

#### **Scanner Isolation**
1. **Process Sandboxing**: Isolated scanner execution
2. **Temporary Directory Management**: Secure file system access
3. **Resource Limiting**: Timeout and memory controls
4. **Output Sanitization**: Safe result parsing and validation

#### **Data Protection**
1. **No Persistent Storage**: Temporary file cleanup
2. **Memory Management**: Efficient resource utilization
3. **Secret Detection**: Integrated credential scanning
4. **Code Context Embedding**: Reduced API call exposure

### Module Dependencies

```typescript
@Module({
  imports: [ConfigModule],                    // Configuration management
  controllers: [SecurityScanController],      // REST API endpoints
  providers: [
    SecurityScanService,                      // Core business logic
    ApiKeyGuard,                             // Authentication
    GitScmProvider,                          // Repository management
    SemgrepScanner,                          // Static analysis
    GitleaksScanner,                         // Secret detection
    ScanStorageService,                      // Data persistence
    {
      provide: 'SCANNERS',                   // Scanner dependency injection
      useFactory: (semgrep, gitleaks) => [semgrep, gitleaks],
      inject: [SemgrepScanner, GitleaksScanner],
    },
  ],
  exports: [SecurityScanService],            // External service access
})
export class SecurityScanModule {}
```

### Performance Architecture

#### **Optimization Strategies**
- **Change Detection**: Skip unnecessary scans for unchanged repositories
- **Parallel Processing**: Concurrent scanner execution
- **Code Context Embedding**: Reduced round-trip API calls
- **In-Memory Caching**: Fast scan history and statistics access
- **Temporary File Management**: Efficient cleanup and resource management

#### **Scalability Considerations**
- **Stateless Design**: Horizontal scaling ready
- **Pluggable Scanners**: Addition of new security tools
- **Configurable Timeouts**: Resource limit management
- **Docker Support**: Container orchestration ready
- **Cloud-Native Configuration**: Environment-based setup

## Docker Deployment

### Using Docker Compose (Recommended)
```bash
# Clone repository
git clone <repository-url>
cd repo-security-scanner-app

# Optional: Set custom API key
echo "API_KEYS=your-custom-api-key" > .env

# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker Build
```bash
# Build image
docker build -t repo-security-scanner .

# Run container
docker run -d \
  --name security-scanner \
  -p 3000:3000 \
  -e API_KEYS=your-custom-api-key \
  repo-security-scanner

# View logs
docker logs -f security-scanner
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Application port | `3000` | No |
| `API_KEYS` | Custom API key | `your-secure-production-key-2025` | No |
| **SCM Provider Authentication** |
| `GITHUB_TOKEN` | GitHub API token for enhanced metadata | - | No |
| `GITLAB_TOKEN` | GitLab Personal Access Token for private repos | - | No |
| `GITLAB_ACCESS_TOKEN` | Alternative GitLab token variable name | - | No |

#### **SCM Provider Configuration**

The repository scanner uses an **SCM abstraction layer** that automatically selects the best provider based on repository URLs:

**Automatic Provider Selection:**
- `https://github.com/user/repo` → **GitHub Provider** (with API integration)
- `https://gitlab.com/user/repo` → **GitLab Provider** (with enhanced metadata)
- `https://gitlab.company.com/team/project` → **GitLab Provider** (self-hosted support)
- `https://any-git-server.com/repo.git` → **Enhanced Git Provider** (universal fallback)

**Authentication Benefits:**
- **Without tokens**: Public repositories work without authentication
- **With tokens**: Private repositories + enhanced metadata + higher rate limits
- **Auto-detection**: No manual provider configuration needed
- **Fallback support**: Always works even if API fails

**Provider Health Monitoring:**
```bash
# Check provider health status
curl -X GET http://localhost:3000/scan/statistics \
  -H "x-api-key: your-api-key"

# Returns provider health information and usage statistics
```

### GitLab Configuration

#### For GitLab.com (Public Repositories)
No configuration needed - public repositories work out of the box.

#### For Private Repositories or Self-hosted GitLab
1. **Create Personal Access Token**:
   - Go to GitLab → User Settings → Access Tokens
   - Create token with `read_repository` scope
   - Copy the generated token

2. **Configure Environment**:
```bash
# Option 1: Environment variable
export GITLAB_TOKEN=glpat-your-token-here

# Option 2: Docker
docker run -e GITLAB_TOKEN=glpat-your-token-here repo-security-scanner

# Option 3: .env file
echo "GITLAB_TOKEN=glpat-your-token-here" >> .env
```

3. **Self-hosted GitLab Instances**:
```bash
# Scan from self-hosted GitLab
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.your-company.com/team/project"}'
```

#### GitLab Features Supported
- **Public & Private Repositories**: Full access with proper authentication
- **Self-hosted Instances**: Any GitLab instance (CE/EE)
- **Metadata**: Project details, contributors, commit history
- **GitLab-specific Data**: Issues, merge requests, CI/CD status, container registry
- **Security Scanning**: Works with all GitLab repository types

## Security Features

### Input Validation & Sanitization
- **Path Validation**: Prevents directory traversal attacks
- **URL Validation**: Validates repository URLs using class-validator
- **Command Injection Prevention**: Sanitized scanner arguments
- **Format String Protection**: Structured logging prevents injection

### Authentication & Authorization
- **API Key Authentication**: Secure API access control
- **Request Validation**: Input validation
- **CORS Configuration**: Proper cross-origin resource sharing

### Secure File Handling
- **Temporary Directory Cleanup**: Automatic cleanup of cloned repositories
- **Cross-Platform Path Handling**: Secure path resolution across OS
- **Scanner Output Sanitization**: Safe parsing of scanner results

## Performance Features

- **Change Detection**: Skip scans when no changes detected
- **Concurrent Scanning**: Multiple scanners run in parallel
- **Temporary Storage**: Efficient temporary directory management
- **Memory Management**: Automatic cleanup and garbage collection
- **Caching**: In-memory scan history and metadata caching

## Development

### Prerequisites for Development
```bash
# Install Node.js dependencies
npm install

# Install security scanners
brew install semgrep gitleaks  # macOS
# or appropriate installation for your OS

# Set up development environment
cp .env.example .env
# Edit .env with your configuration
```

### Development Workflow
```bash
# Start development server
npm run start:dev

# Run tests during development
npm run test:watch

# Lint and format code
npm run lint
npm run format

# Build for production
npm run build
```

### Adding New Scanners

1. **Create Scanner Service**:
```typescript
// src/security-scan/providers/scanner-newscan.service.ts
@Injectable()
export class NewScanScanner implements SecurityScanner {
  getName(): string { return 'NewScan'; }
  getVersion(): string { return 'latest'; }
  async scan(targetPath: string): Promise<any[]> {
    // Implementation
  }
}
```

2. **Register in Module**:
```typescript
// src/security-scan/security-scan.module.ts
providers: [
  // ... existing providers
  NewScanScanner,
  {
    provide: 'SCANNERS',
    useFactory: (semgrep, gitleaks, newscan) => [semgrep, gitleaks, newscan],
    inject: [SemgrepScanner, GitleaksScanner, NewScanScanner],
  },
]
```

## Troubleshooting

### Common Issues

#### Scanner Not Found
```bash
# Check if scanners are installed
semgrep --version
gitleaks version

# Install missing scanners
brew install semgrep gitleaks  # macOS
```

#### API Key Issues
```bash
# Test API connection
curl -H "x-api-key: your-secure-production-key-2025" http://localhost:3000/scan/statistics

# Common API key errors:
# 401 "Missing API key" - No x-api-key header provided
# 401 "Invalid API key" - Key doesn't match configured key
```

#### Permission Issues
```bash
# Fix file permissions
chmod +x /usr/local/bin/gitleaks
chmod +x /usr/local/bin/semgrep

# Fix temp directory access
sudo chmod 755 /tmp
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

## Monitoring & Production

### Health Checks
```bash
# Application health
GET http://localhost:3000/
# Returns 200 if application is running

# API statistics
GET http://localhost:3000/scan/statistics
x-api-key: your-api-key
```

### Logging
The application provides structured logging for production monitoring:

```bash
# Application startup
Repository Security Scanner started successfully!
Server running on: http://localhost:3000  
Environment: production
API Keys configured: 3

# Security events
[ApiKeyGuard] Invalid API key attempt { keyPrefix: 'inva****', ip: '192.168.1.100' }
[ConfigService] Loaded 3 API keys from API_KEYS environment variable
```

### Metrics & Monitoring
Track these key metrics in production:
- **Scan Success Rate**: Percentage of successful scans
- **Response Times**: API endpoint performance
- **Authentication Failures**: Security monitoring
- **Scanner Performance**: Individual scanner execution times
- **Repository Coverage**: Number of unique repositories scanned

### Deployment Checklist
- [ ] **Environment**: Configure custom API key if needed
- [ ] **Security**: Enable HTTPS for production
- [ ] **Monitoring**: Set up basic health checks
- [ ] **Access**: Ensure scanners (Semgrep, Gitleaks) are installed

## Design Challenges

Building a universal repository security scanner presented several significant architectural challenges. Here's how we solved them:

### **Challenge 1: Multi-Platform SCM Abstraction**

**Problem**: Different Git platforms (GitHub, GitLab, Bitbucket) have varying APIs, authentication methods, and URL formats.

**Solution**: 
- **SCM Abstraction Layer**: Created a unified interface (`ScmProvider`) with platform-specific implementations
- **Provider Registry**: Automatic provider selection based on URL patterns and capabilities
- **Graceful Fallback**: Enhanced Git provider handles any Git repository when specific providers fail

```typescript
// Unified interface for all SCM platforms
interface ScmProvider {
  canHandle(repoUrl: string): boolean;
  fetchRepoMetadata(repoUrl: string): Promise<RepositoryMetadata>;
  cloneRepository(repoUrl: string, targetPath: string): Promise<void>;
}
```

### **Challenge 2: Scanner Integration & Output Normalization**

**Problem**: Semgrep and Gitleaks produce different output formats, error codes, and finding structures.

**Solution**:
- **Scanner Interface**: Common interface for all security scanners
- **Output Normalization**: Transform scanner-specific outputs into unified finding format
- **Error Handling**: Graceful handling when scanners fail or produce unexpected output

```typescript
interface SecurityScanner {
  scan(repositoryPath: string): Promise<Finding[]>;
  getName(): string;
  getVersion(): string;
}
```

### **Challenge 3: Efficient Change Detection**

**Problem**: Avoid expensive rescans when repository hasn't changed since last scan.

**Solution**:
- **Commit Hash Tracking**: Store last scanned commit hash per repository
- **Change Detection**: Compare current HEAD with stored hash
- **Force Scan Option**: Override change detection when needed
- **Metadata Caching**: Cache repository metadata to reduce API calls

### **Challenge 4: Temporary File Management**

**Problem**: Safely clone repositories, perform scans, and cleanup without conflicts or leaks.

**Solution**:
- **Isolated Temporary Directories**: Each scan gets a unique temp directory
- **Automatic Cleanup**: Ensure cleanup happens even if scan fails
- **Process Isolation**: Prevent concurrent scans from interfering
- **Security**: Restrict file permissions and prevent path traversal

```typescript
// Safe temporary directory management
const tmpDir = await tmp.dir({ unsafeCleanup: true });
try {
  await this.cloneRepository(repoUrl, tmpDir.path);
  return await this.performScan(tmpDir.path);
} finally {
  await tmpDir.cleanup(); // Always cleanup
}
```

### **Challenge 5: Authentication & Rate Limiting**

**Problem**: Different platforms have varying authentication methods and rate limits.

**Solution**:
- **Flexible Authentication**: Support tokens, OAuth, and anonymous access
- **Rate Limit Awareness**: Track and respect platform-specific rate limits
- **Authentication Fallback**: Gracefully degrade to anonymous access
- **Token Validation**: Verify authentication status and provide clear errors

### **Challenge 6: Concurrent Scan Management**

**Problem**: Handle multiple simultaneous scans without resource exhaustion or conflicts.

**Solution**:
- **Process Isolation**: Each scan runs in isolated environment
- **Resource Limits**: Control memory and CPU usage per scan
- **Queue Management**: Handle scan requests efficiently
- **Timeout Protection**: Prevent hung scans from blocking others

### **Challenge 7: Code Context Embedding**

**Problem**: Provide code snippets around security findings without additional API calls.

**Solution**:
- **Embedded Context**: Include code snippets directly in scan results
- **Context Window**: Configurable lines before/after findings
- **File Caching**: Cache file contents during scan for efficient context retrieval
- **Fallback Mechanism**: Handle binary files, large files, and encoding issues

### **Challenge 8: UI/API Consistency**

**Problem**: Ensure web UI and REST API provide consistent experiences and data formats.

**Solution**:
- **Shared DTOs**: Common data transfer objects for both UI and API
- **Unified Validation**: Same validation rules across all interfaces
- **Error Standardization**: Consistent error formats and HTTP status codes
- **Real-time Updates**: WebSocket support for long-running scans

### **Challenge 9: Scalability & Performance**

**Problem**: Maintain performance as the number of repositories and scan frequency increases.

**Solution**:
- **Async Processing**: Non-blocking scan operations
- **Caching**: Cache metadata, scan results, and file contents
- **Database Optimization**: Efficient storage and retrieval of scan records
- **Resource Monitoring**: Track memory, CPU, and disk usage

### **Challenge 10: Security & Input Validation**

**Problem**: Prevent malicious repositories from compromising the scanner.

**Solution**:
- **Input Sanitization**: Validate all repository URLs and parameters
- **Sandboxed Execution**: Isolate scanner processes from main application
- **Resource Limits**: Prevent resource exhaustion attacks
- **API Security**: Authentication, rate limiting, and input validation

### **Lessons Learned**

1. **Abstraction Benefits**: The SCM abstraction layer simplified adding new platforms
2. **Fail Fast, Fail Safe**: Aggressive error handling prevents cascade failures
3. **Observability First**: Built-in logging and metrics saved countless debugging hours
4. **Testing Strategies**: Comprehensive mocking enabled reliable unit tests
5. **Performance Matters**: Early optimization of hot paths prevented scaling issues

### **Future Improvements**

- **Background Processing**: Queue-based scanning for better resource management
- **Distributed Scanning**: Multi-node deployment for high-throughput environments
- **Advanced Caching**: Redis-based caching for improved performance
- **Real-time Notifications**: WebSocket/SSE for live scan progress updates
- **Plugin Architecture**: Allow custom scanners and processors

## Additional Resources

- **[SCM_ABSTRACTION_LAYER.md](./SCM_ABSTRACTION_LAYER.md)**: Complete guide to the SCM abstraction layer
- **[GITLAB_SUPPORT.md](./GITLAB_SUPPORT.md)**: Enhanced GitLab integration documentation
- **[Semgrep Documentation](https://semgrep.dev/)**: Static analysis scanner
- **[Gitleaks Documentation](https://github.com/gitleaks/gitleaks)**: Secret detection scanner
- **[NestJS Documentation](https://nestjs.com/)**: Backend framework
- **[Docker Documentation](https://docs.docker.com/)**: Container deployment

## What's New: SCM Abstraction Layer

### **Multi-Provider Architecture**

The Repository Security Scanner features a **SCM abstraction layer** that handles source control management:

#### **Key Features**

- **Automatic Provider Selection**: No configuration needed - the system automatically chooses the optimal provider based on repository URLs
- **Fallback**: Graceful degradation when specific providers fail
- **Extensible Design**: Adding new SCM providers requires code changes
- **Multi-Platform Authentication**: Unified authentication across GitHub, GitLab, and more
- **Health Monitoring**: Real-time provider status and performance tracking
- **Performance**: Provider-specific optimizations for speed and reliability

#### **Usage Examples**

```bash
# Works automatically with any supported platform:
curl -X POST http://localhost:3000/scan \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://github.com/user/repo"}'      # → GitHub Provider

curl -X POST http://localhost:3000/scan \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://gitlab.com/user/repo"}'      # → GitLab Provider

curl -X POST http://localhost:3000/scan \
  -H "x-api-key: your-api-key" \
  -d '{"repoUrl": "https://git.company.com/repo.git"}'  # → Enhanced Git Provider
```

#### **Developer Benefits**

- **Backward Compatibility**: Existing API endpoints work unchanged
- **Enhanced Metadata**: Richer repository information from platform APIs
- **Error Handling**: Informative error messages and automatic retries
- **Future-Proof**: Ready for additional platforms and custom providers

#### **Enterprise Features**

- **Self-hosted GitLab**: Full support for GitLab CE/EE instances
- **Private Repository Support**: Token-based authentication for all platforms
- **Scalable Architecture**: Provider registry supports load balancing and failover
- **Monitoring**: Health checks and performance metrics for all providers

> **Result**: A robust, flexible, and maintainable security scanning platform that works with any Git repository.

## Additional Resources

### **Adding New SCM Providers**
```typescript
// Adding a new provider:
@Injectable()
export class BitbucketScmProvider extends BaseScmProvider {
  constructor() {
    super({
      name: 'Bitbucket Provider',
      platform: 'bitbucket',
      hostnames: ['bitbucket.org'],
      supportsApi: true
    });
  }
  
  canHandle(repoUrl: string): boolean {
    return repoUrl.includes('bitbucket.org');
  }
  
  // Implement platform-specific methods...
}
```

See **[SCM_ABSTRACTION_LAYER.md](./SCM_ABSTRACTION_LAYER.md)** for detailed guidance.

### **General Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm run test:all`)
6. Update documentation if needed
7. Submit a pull request

### **Testing New Providers**
```bash
# Test your new provider
npm run test:unit -- --testPathPattern=your-provider.spec.ts
npm run test:integration -- --testPathPattern=your-provider
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">
  <strong>Secure by Design | Easy to Use | Well Tested</strong>
</p>

#### Repository Access Issues
```bash
# Test repository access
git clone https://github.com/user/repository.git /tmp/test-clone
rm -rf /tmp/test-clone

# Check network connectivity
curl -I https://github.com
```

#### Docker Issues
```bash
# Check container logs
docker-compose logs security-scanner

# Rebuild container
docker-compose down
docker-compose up --build -d
```

### Debug Mode
```bash
# Enable debug logging
NODE_ENV=development npm run start:dev

# Check application logs for detailed information about:
# - Repository cloning process
# - Scanner execution and output
# - Change detection results
# - Error details and stack traces
```

### Performance Issues
- Use force scan sparingly (bypasses change detection)
- Monitor memory usage during large repository scans
- Check temporary directory cleanup
- Verify scanner timeout settings

## Support

- **Issues**: [Create GitHub issues](https://github.com/your-org/repo-security-scanner/issues) for bugs and feature requests
- **Security**: Report security vulnerabilities privately to maintainers
- **Community**: Join discussions for questions and contributions

---

**Built with love using NestJS, TypeScript, and modern security scanning tools.**
