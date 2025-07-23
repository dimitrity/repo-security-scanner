# Repository Security Scanner

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
  <a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
</p>

## Project Overview

The Repository Security Scanner is a comprehensive security analysis platform built with NestJS that automatically scans Git repositories for security vulnerabilities, secrets, and code quality issues. It features dual scanner integration, intelligent change detection, and a modern web interface for viewing results.

### 🚀 Key Features

- 🔍 **Dual Scanner Integration**: Semgrep for static analysis + Gitleaks for secret detection
- 🌐 **Modern Web UI**: GitHub-style interface with instant code context viewing
- 📱 **Embedded Code Context**: View code snippets directly in scan results without additional API calls
- 🚀 **Intelligent Change Detection**: Skip scans when no repository changes detected
- 📊 **Scanner Summary Dashboard**: Real-time issue counts and scanner status
- 🔐 **Secure API**: API key authentication with input validation and sanitization
- 🐳 **Docker Ready**: Complete containerization with docker-compose support
- 🔄 **Cross-Platform**: Supports macOS, Linux, Windows, and Docker environments
- 📈 **Scan Statistics**: Track scanning activity and repository history
- ⚡ **Force Scan Option**: Bypass change detection when needed
- 🔔 **Webhook Notifications**: Automatic notifications when scans complete or fail

### 🛡️ Security Scanners

#### Semgrep (Static Analysis)
- **Purpose**: Code security vulnerabilities, OWASP patterns, custom rules
- **Features**: 1000+ built-in rules, custom rule support, high accuracy
- **Detects**: SQL injection, XSS, weak crypto, path traversal, etc.

#### Gitleaks (Secret Detection)
- **Purpose**: Hardcoded secrets, API keys, credentials
- **Features**: Entropy-based detection, custom patterns, Git history scanning
- **Detects**: AWS keys, GitHub tokens, passwords, private keys, etc.

### 🔐 Security Features

- **API Key Authentication**: Simple and secure API access control
- **Input Validation**: Request sanitization and validation
- **Path Traversal Protection**: Secure file system access
- **Safe Scanner Execution**: Isolated scanner process execution

### 🌍 Repository Platform Support

- **GitHub**: Full API integration for metadata and commit information
- **GitLab**: API support for repository details
- **Bitbucket**: API integration for repository metadata
- **Generic Git**: Fallback support for any accessible Git repository

## 🚀 Quick Start

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

**Simple Setup:**
The application is preconfigured with a default API key. For production, you can optionally set your own:

```bash
# Optional: Create .env file for custom configuration
PORT=3000
API_KEYS=your-custom-api-key-here

# Optional: Enhanced GitHub metadata support  
GITHUB_TOKEN=your-github-token
```

**Note:** The frontend and backend are automatically synchronized with the same API key.

### 🏃‍♂️ Running the Application

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

### 🔧 Environment Configuration

The application works out of the box with sensible defaults. Optional configuration:

```bash
# Optional environment variables
export PORT="3000"                              # Application port (default: 3000)
export API_KEYS="your-custom-api-key"          # Custom API key (optional)
export GITHUB_TOKEN="your-github-token"        # Enhanced GitHub metadata (optional)
export WEBHOOK_URL="https://your-server.com/webhook"  # Webhook notification URL (optional)
export WEBHOOK_SECRET="your-webhook-secret"    # Webhook HMAC secret for verification (optional)
```

For Docker deployment, you can set these in your `docker-compose.yml` or pass them as environment variables.

## 🌐 Web Interface

Access the web interface at `http://localhost:3000`

### Features:
- **Repository Scanning**: Enter any Git repository URL and scan instantly
- **Real-time Results**: Live scanner progress and issue counts
- **Code Context Viewer**: Click any finding to see highlighted code snippets
- **Scanner Summary**: Overview of all scanners with issue breakdown
- **Force Scan**: Bypass change detection for complete rescans
- **GitHub-style UI**: Familiar, modern interface design

### Usage:
1. Navigate to `http://localhost:3000`
2. Enter a repository URL (e.g., `https://github.com/user/repo`)
3. Click "🔍 Scan Repository" or "⚡ Force Scan"
4. View results with embedded code context
5. Click on any finding to see detailed code snippets

## 🔔 Webhook Notifications

The Repository Security Scanner can send HTTP webhook notifications when scans complete or fail. This is useful for integrating with CI/CD pipelines, notification systems, or other automation tools.

### Webhook Configuration

Configure webhook notifications using environment variables:

```bash
# Basic webhook configuration
export WEBHOOK_URL="https://your-server.com/webhook"
export WEBHOOK_SECRET="your-webhook-secret-for-verification"

# Multiple webhooks (comma-separated)
export WEBHOOK_URL="https://webhook1.com,https://webhook2.com"
```

### Webhook Payload

Webhooks are sent as HTTP POST requests with the following JSON payload:

#### Successful Scan
```json
{
  "event": "scan.completed",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "scanId": "scan_1704110400000_abc123",
  "repository": {
    "name": "owner/repository",
    "url": "https://github.com/owner/repository",
    "branch": "main"
  },
  "summary": {
    "totalSecurityIssues": 5,
    "scanDuration": 30000,
    "scanners": [
      {
        "name": "Semgrep",
        "securityIssuesFound": 3
      },
      {
        "name": "Gitleaks", 
        "securityIssuesFound": 2
      }
    ]
  },
  "status": "success"
}
```

#### Failed Scan
```json
{
  "event": "scan.failed",
  "timestamp": "2024-01-01T12:00:00.000Z", 
  "scanId": "scan_1704110400000_def456",
  "repository": {
    "name": "owner/repository",
    "url": "https://github.com/owner/repository"
  },
  "summary": {
    "totalSecurityIssues": 0,
    "scanDuration": 5000,
    "scanners": []
  },
  "status": "failed",
  "error": "Repository not accessible"
}
```

### Webhook Security

Webhooks include security headers for verification:

- **`X-Webhook-Signature`**: HMAC-SHA256 signature of the payload (when `WEBHOOK_SECRET` is configured)
- **`X-Webhook-Timestamp`**: ISO timestamp of when the webhook was sent
- **`X-Webhook-Event`**: Event type (`scan.completed` or `scan.failed`)
- **`User-Agent`**: `repo-security-scanner/1.0`

#### Verifying Webhook Signatures

If you configure a `WEBHOOK_SECRET`, verify the signature:

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Webhook Examples

#### Slack Integration
```bash
# Send notifications to Slack
export WEBHOOK_URL="https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK"
```

#### Discord Integration  
```bash
# Send notifications to Discord
export WEBHOOK_URL="https://discord.com/api/webhooks/YOUR/DISCORD/WEBHOOK"
```

#### Custom Server
```bash
# Send to your custom endpoint
export WEBHOOK_URL="https://your-api.com/security-scan-webhook"
export WEBHOOK_SECRET="your-secret-key"
```

## 🔌 API Documentation

### 🔐 Authentication

All API endpoints require the `x-api-key` header. The default API key is `your-secure-production-key-2025`:

```bash
curl -H "x-api-key: your-secure-production-key-2025" http://localhost:3000/scan/statistics
```

You can customize the API key by setting the `API_KEYS` environment variable.

### Endpoints

#### 🔍 Scan Repository
```bash
POST /scan
Content-Type: application/json
x-api-key: your-api-key-here

{
  "repoUrl": "https://github.com/user/repository"
}
```

#### ⚡ Force Scan
```bash
POST /scan/force
Content-Type: application/json
x-api-key: your-api-key-here

{
  "repoUrl": "https://github.com/user/repository"
}
```

#### 📊 Get Statistics
```bash
GET /scan/statistics
x-api-key: your-api-key-here
```

#### 📋 Get Scan Records
```bash
GET /scan/records
x-api-key: your-api-key-here
```

#### 🔍 Get Code Context
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

**🔐 Authentication:**
- Use API key `your-secure-production-key-2025` in the `x-api-key` header
- Customize by setting the `API_KEYS` environment variable
- All API endpoints require authentication (except static UI)

### 📄 API Response Format

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

### 🔄 Change Detection Response

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

## 🧪 Testing

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
The project includes comprehensive testing:
- **Unit Tests**: All services, providers, and utilities
- **Integration Tests**: API endpoints and scanner integration
- **E2E Tests**: Complete workflow testing
- **Change Detection Tests**: Repository change tracking

## 🏗️ Architecture & Project Structure

### 🎯 System Overview

The Repository Security Scanner follows a **modular, layered architecture** built on NestJS principles, emphasizing security, scalability, and maintainability.

```mermaid
graph TD
    A[Web UI] --> B[Security Scan Controller]
    B --> C[API Key Guard]
    C --> D[Security Scan Service]
    D --> E[Git SCM Provider]
    D --> F[Scanner Services]
    D --> G[Scan Storage Service]
    E --> H[Repository Cloning]
    F --> I[Semgrep Scanner]
    F --> J[Gitleaks Scanner]
    D --> K[Code Context Extraction]
```

### 📁 Project Structure

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
│   │   │   ├── scm.interface.ts             # SCM provider contracts
│   │   │   └── webhook.interface.ts         # Webhook notification contracts
│   │   ├── providers/                # Service implementations
│   │   │   ├── scm-git.provider.ts          # Git repository management
│   │   │   ├── scanner-semgrep.service.ts   # Semgrep static analysis
│   │   │   ├── scanner-gitleaks.service.ts  # Gitleaks secret detection
│   │   │   ├── scan-storage.service.ts      # In-memory scan history
│   │   │   └── webhook.service.ts           # Webhook notification delivery
│   │   ├── security-scan.controller.ts      # REST API endpoints
│   │   ├── security-scan.service.ts         # Core business logic
│   │   └── security-scan.module.ts          # Module configuration
│   ├── config/                       # Configuration management
│   │   ├── config.service.ts                # Environment & API key config
│   │   └── config.module.ts                 # Configuration module
│   ├── ui/                           # Frontend web interface
│   │   ├── index.html               # Main UI application
│   │   ├── script.js               # Frontend JavaScript logic
│   │   └── style.css               # GitHub-inspired styling
│   ├── app.module.ts                 # Root application module
│   └── main.ts                      # Application bootstrap
├── test/                            # Comprehensive test suites
│   ├── integration/                 # Integration test scenarios
│   │   ├── security-scan.integration.spec.ts  # API integration tests
│   │   └── change-detection.integration.spec.ts # Change detection tests
│   ├── app.e2e-spec.ts             # End-to-end workflow tests
│   ├── setup.ts                    # Test environment setup
│   └── jest-e2e.json              # E2E test configuration
├── docker-compose.yml              # Container orchestration
├── Dockerfile                      # Multi-stage container build
├── ENVIRONMENT_CONFIGURATION.md    # Deployment guide
└── README.md                       # Comprehensive documentation
```

### 🏛️ Architectural Layers

#### 1. **Presentation Layer**
- **Web UI**: Modern GitHub-style interface with real-time updates
- **REST Controller**: Type-safe API endpoints with validation
- **Authentication Guard**: Simple API key authentication

#### 2. **Business Logic Layer**  
- **Security Scan Service**: Orchestrates scanning workflows
- **Change Detection**: Intelligent repository change tracking
- **Code Context Extraction**: Embedded code snippet generation
- **Result Aggregation**: Multi-scanner result synthesis

#### 3. **Service Layer**
- **Scanner Services**: Pluggable security scanner implementations
- **SCM Provider**: Repository cloning and metadata extraction  
- **Storage Service**: Scan history and statistics management
- **Configuration Service**: Environment-based configuration management

#### 4. **Infrastructure Layer**
- **Temporary File Management**: Secure repository cloning and cleanup
- **Process Execution**: Sandboxed scanner process management
- **Error Handling**: Comprehensive error recovery and logging

### 🔧 Core Components

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
  // Core scanning orchestration
  // Change detection logic
  // Multi-scanner coordination
  // Code context embedding
}
```

#### **ApiKeyGuard**
```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  // Simple API key validation
}
```

#### **ConfigService** (New)
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

### 🔄 Data Flow Architecture

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
    G-->>C: ✅ Authenticated
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

### 🛡️ Security Architecture

#### **Authentication Flow**
1. **API Key Validation**: Multi-key support with format validation
2. **Request Sanitization**: Input validation and path traversal protection  
3. **Simple Validation**: Basic API key checking
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

### 🧩 Module Dependencies

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

### 📊 Performance Architecture

#### **Optimization Strategies**
- **Change Detection**: Skip unnecessary scans for unchanged repositories
- **Parallel Processing**: Concurrent scanner execution
- **Code Context Embedding**: Reduced round-trip API calls
- **In-Memory Caching**: Fast scan history and statistics access
- **Temporary File Management**: Efficient cleanup and resource management

#### **Scalability Considerations**
- **Stateless Design**: Horizontal scaling ready
- **Pluggable Scanners**: Easy addition of new security tools
- **Configurable Timeouts**: Resource limit management
- **Docker Support**: Container orchestration ready
- **Cloud-Native Configuration**: Environment-based setup

## 🐳 Docker Deployment

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
docker run -p 3000:3000  repo-security-scanner

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
| `GITHUB_TOKEN` | GitHub API token for enhanced metadata | - | No |
| `WEBHOOK_URL` | Webhook notification URL(s) | - | No |
| `WEBHOOK_SECRET` | Webhook HMAC verification secret | - | No |

## 🔒 Security Features

### Input Validation & Sanitization
- **Path Validation**: Prevents directory traversal attacks
- **URL Validation**: Validates repository URLs using class-validator
- **Command Injection Prevention**: Sanitized scanner arguments
- **Format String Protection**: Structured logging prevents injection

### Authentication & Authorization
- **API Key Authentication**: Secure API access control
- **Request Validation**: Comprehensive input validation
- **CORS Configuration**: Proper cross-origin resource sharing

### Secure File Handling
- **Temporary Directory Cleanup**: Automatic cleanup of cloned repositories
- **Cross-Platform Path Handling**: Secure path resolution across OS
- **Scanner Output Sanitization**: Safe parsing of scanner results

## 📊 Performance Features

- **Change Detection**: Skip scans when no changes detected
- **Concurrent Scanning**: Multiple scanners run in parallel
- **Temporary Storage**: Efficient temporary directory management
- **Memory Management**: Automatic cleanup and garbage collection
- **Caching**: In-memory scan history and metadata caching

## 🛠️ Development

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

## 🚨 Troubleshooting

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

## 📊 Monitoring & Production

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
🚀 Repository Security Scanner started successfully!
📡 Server running on: http://localhost:3000  
🌍 Environment: production
🔑 API Keys configured: 3

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

## 📚 Additional Resources

- **[Semgrep Documentation](https://semgrep.dev/)**: Static analysis scanner
- **[Gitleaks Documentation](https://github.com/gitleaks/gitleaks)**: Secret detection scanner
- **[NestJS Documentation](https://nestjs.com/)**: Backend framework
- **[Docker Documentation](https://docs.docker.com/)**: Container deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<p align="center">
  <strong>🔒 Secure by Design | ⚡ Easy to Use | 🧪 Thoroughly Tested</strong>
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

## 🆘 Support

- **Issues**: [Create GitHub issues](https://github.com/your-org/repo-security-scanner/issues) for bugs and feature requests
- **Security**: Report security vulnerabilities privately to maintainers
- **Community**: Join discussions for questions and contributions

---

**Built with ❤️ using NestJS, TypeScript, and modern security scanning tools.**
