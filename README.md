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

The Repository Security Scanner is a powerful NestJS-based application that provides automated security scanning for Git repositories. It integrates with popular security tools like Semgrep to identify potential security vulnerabilities, code quality issues, and compliance violations in your codebase.

### Key Features

- 🔍 **Automated Security Scanning**: Scans repositories for security vulnerabilities using Semgrep
- 🚀 **Intelligent Change Detection**: Skips scans when no changes are detected, improving performance
- 📊 **Comprehensive Reporting**: Detailed findings with severity levels and remediation guidance
- 🔐 **API Key Authentication**: Secure access control for API endpoints
- 🐳 **Docker Support**: Easy deployment with containerized application
- 📈 **Scan Statistics**: Track scanning activity and repository history
- 🔄 **Force Scan Capability**: Bypass change detection when needed
- 🏗️ **NestJS Architecture**: Built with modern TypeScript and NestJS framework

### Supported Repository Platforms

- **GitHub**: Full API integration for metadata and commit information
- **GitLab**: API support for repository details
- **Bitbucket**: API integration for repository metadata
- **Generic Git**: Fallback support for any Git repository

### Security Tools Integration

- **Semgrep**: Static analysis tool for detecting security vulnerabilities
- **Extensible Scanner Architecture**: Easy to add new security scanners
- **Custom Rules Support**: Configurable scanning rules and policies

## Setup & Installation

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **Git**: For repository cloning and metadata extraction
- **Docker**: Optional, for containerized deployment

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd repo-security-scanner-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```bash
   # API Configuration
   PORT=3000
   NODE_ENV=development
   
   # Security
   API_KEY=your-secure-api-key-here
   
   # Optional: GitHub API Token (for enhanced metadata)
   GITHUB_TOKEN=your-github-token
   ```

4. **Install Semgrep** (required for security scanning)
   ```bash
   # On macOS
   brew install semgrep
   
   # On Ubuntu/Debian
   wget -qO - https://semgrep.dev/rs/checksums.txt | head -n 1 | cut -d' ' -f1
   sudo apt-get install semgrep
   
   # On Windows
   pip install semgrep
   ```

### Running the Application

#### Development Mode
```bash
# Start in development mode with hot reload
npm run start:dev
```

#### Production Mode
```bash
# Build the application
npm run build

# Start in production mode
npm run start:prod
```

#### Watch Mode
```bash
# Start with file watching
npm run start
```

### Docker Setup

#### Build the Docker Image
```bash
docker build -t repo-security-scanner .
```

#### Run the Docker Container
```bash
# Basic run
docker run -p 3000:3000 repo-security-scanner

# With custom port
docker run -p 8080:3000 -e PORT=3000 repo-security-scanner

# With environment variables
docker run -p 3000:3000 \
  -e API_KEY=your-api-key \
  -e NODE_ENV=production \
  repo-security-scanner
```

#### Docker Compose (Optional)
Create a `docker-compose.yml` file:
```yaml
version: '3.8'
services:
  security-scanner:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - API_KEY=${API_KEY}
    volumes:
      - ./logs:/app/logs
```

## API Documentation

The Repository Security Scanner provides a RESTful API for scanning repositories and managing scan results.

### Authentication

All API endpoints require authentication using an API key passed in the `X-API-Key` header:

```bash
X-API-Key: your-secure-api-key-here
```

### Base URL

```
http://localhost:3000
```

### Endpoints

#### 1. Scan Repository

**POST** `/scan`

Scans a repository for security vulnerabilities with intelligent change detection.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/user/repository"
}
```

**Response (First Scan):**
```json
{
  "repository": {
    "name": "repository",
    "description": "Repository description",
    "defaultBranch": "main",
    "lastCommit": {
      "hash": "abc123def456",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  },
  "summary": {
    "totalIssues": 5,
    "scanners": [
      {
        "name": "Semgrep",
        "version": "latest",
        "issuesFound": 2,
        "summary": "Semgrep found 2 issues"
      },
      {
        "name": "Gitleaks",
        "version": "latest",
        "issuesFound": 3,
        "summary": "Gitleaks found 3 issues"
      }
    ]
  },
  "details": {
    "scanners": [
      {
        "name": "Semgrep",
        "version": "latest",
        "totalIssues": 2,
        "severityBreakdown": {
          "high": 2,
          "medium": 0,
          "low": 0,
          "info": 0
        },
        "findings": {
          "high": [
            {
              "ruleId": "security.weak-crypto",
              "message": "Weak cryptographic algorithm detected",
              "filePath": "src/auth.js",
              "line": 15,
              "severity": "high",
              "scanner": "Semgrep",
              "codeContext": {
                "filePath": "src/auth.js",
                "line": 15,
                "startLine": 12,
                "endLine": 18,
                "context": [
                  {
                    "lineNumber": 12,
                    "content": "// Weak crypto example",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 13,
                    "content": "const crypto = require('crypto');",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 14,
                    "content": "",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 15,
                    "content": "const hash = crypto.createHash('md5').update('password').digest('hex');",
                    "isTargetLine": true
                  },
                  {
                    "lineNumber": 16,
                    "content": "",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 17,
                    "content": "// This is vulnerable to rainbow table attacks",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 18,
                    "content": "console.log('Hash:', hash);",
                    "isTargetLine": false
                  }
                ]
              }
            }
          ],
          "medium": [],
          "low": [],
          "info": []
        }
      },
      {
        "name": "Gitleaks",
        "version": "latest",
        "totalIssues": 3,
        "severityBreakdown": {
          "high": 2,
          "medium": 0,
          "low": 0,
          "info": 1
        },
        "findings": {
          "high": [
            {
              "ruleId": "gitleaks.aws-access-token",
              "message": "const awsKey = 'AKIAIOSFODNN7EXAMPLE';",
              "filePath": "config/aws.js",
              "line": 3,
              "severity": "high",
              "secret": "AKIAIOSFODNN7EXAMPLE",
              "scanner": "Gitleaks",
              "codeContext": {
                "filePath": "config/aws.js",
                "line": 3,
                "startLine": 1,
                "endLine": 6,
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
                    "content": "const awsKey = 'AKIAIOSFODNN7EXAMPLE';",
                    "isTargetLine": true
                  },
                  {
                    "lineNumber": 4,
                    "content": "const awsSecret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 5,
                    "content": "",
                    "isTargetLine": false
                  },
                  {
                    "lineNumber": 6,
                    "content": "module.exports = { awsKey, awsSecret };",
                    "isTargetLine": false
                  }
                ]
              }
            }
          ],
          "medium": [],
          "low": [],
          "info": [
            {
              "ruleId": "gitleaks.scan-summary",
              "message": "Gitleaks scan completed - found 2 potential secret(s)",
              "filePath": "N/A",
              "line": 0,
              "severity": "info",
              "scanner": "Gitleaks",
              "scanStatus": "completed_with_secrets",
              "exitCode": 1,
              "secretsFound": 2,
              "codeContext": null
            }
          ]
        }
      }
    ]
  },
  "changeDetection": {
    "hasChanges": true,
    "lastCommitHash": "abc123def456",
    "scanSkipped": false
  },
  "scanner": {
    "name": "Multiple Scanners",
    "version": "latest"
  },
  "findings": [
    // ... all findings in flat array (backward compatibility)
  ]
}
```

**Response (No Changes Detected):**
```json
{
  "repository": {
    "name": "repository",
    "description": "Repository description",
    "defaultBranch": "main",
    "lastCommit": {
      "hash": "abc123def456",
      "timestamp": "2024-01-01T12:00:00Z"
    }
  },
  "scanner": {
    "name": "Change Detection",
    "version": "1.0"
  },
  "findings": [
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
    "lastCommitHash": "abc123def456",
    "scanSkipped": true,
    "reason": "No changes detected since last scan"
  }
}
```

### Response Format

The API now returns a structured output with two main sections:

#### Summary Section
Provides a high-level overview of all scan results:
- **totalIssues**: Total number of issues found across all scanners
- **scanners**: Array of scanner summaries with issue counts and human-readable summaries

#### Details Section
Organized by scanner and severity for easy navigation:
- **scanners**: Array of detailed scanner results
  - **name**: Scanner name (e.g., "Semgrep", "Gitleaks")
  - **version**: Scanner version
  - **totalIssues**: Total issues found by this scanner
  - **severityBreakdown**: Count of issues by severity (high, medium, low, info)
  - **findings**: Issues grouped by severity level

#### Code Context
Each finding includes clickable code context when available:
- **filePath**: Path to the file containing the issue
- **line**: Line number where the issue was found
- **codeContext**: Enhanced context with:
  - **startLine/endLine**: Range of lines shown
  - **context**: Array of lines with line numbers and highlighting
  - **isTargetLine**: Boolean indicating the problematic line

#### AllFindings Dictionary (NEW)
The response now includes an `allFindings` object that organizes findings by scanner name:
```json
{
  "allFindings": {
    "Semgrep": [
      {
        "ruleId": "security.weak-crypto",
        "message": "Weak cryptographic algorithm detected",
        "filePath": "src/auth.js",
        "line": 15,
        "severity": "high",
        "scanner": "Semgrep"
      }
    ],
    "Gitleaks": [
      {
        "ruleId": "gitleaks.aws-access-token",
        "message": "AWS access key detected",
        "filePath": "config/aws.js",
        "line": 3,
        "severity": "high",
        "scanner": "Gitleaks",
        "secret": "AKIAIOSFODNN7EXAMPLE"
      }
    ]
  }
}
```

**Benefits of Dictionary Structure:**
- **Easy Scanner Access**: Get findings for a specific scanner: `response.allFindings['Semgrep']`
- **Clear Organization**: Findings are naturally grouped by their source scanner
- **Extensible**: Easy to add new scanners without affecting existing structure
- **Type Safety**: Predictable structure for frontend applications

#### Backward Compatibility
The response maintains backward compatibility with the original `findings` array and `scanner` object.

#### 2. Force Scan Repository

**POST** `/scan/force`

Bypasses change detection and performs a full security scan.

**Request Body:**
```json
{
  "repoUrl": "https://github.com/user/repository"
}
```

**Response:** Same as regular scan but always performs full security analysis.

#### 3. Get Scan Statistics

**GET** `/scan/statistics`

Returns overview statistics of all scans performed.

**Response:**
```json
{
  "totalRepositories": 15,
  "totalScans": 42,
  "lastScanTimestamp": "2024-01-01T12:00:00Z"
}
```

#### 4. Get All Scan Records

**GET** `/scan/records`

Returns detailed records of all repository scans.

**Response:**
```json
[
  {
    "repoUrl": "https://github.com/user/repo1",
    "lastCommitHash": "abc123def456",
    "lastScanTimestamp": "2024-01-01T12:00:00Z",
    "scanCount": 3
  },
  {
    "repoUrl": "https://github.com/user/repo2",
    "lastCommitHash": "def456ghi789",
    "lastScanTimestamp": "2024-01-01T11:30:00Z",
    "scanCount": 1
  }
]
```

### Error Responses

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

#### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

### Usage Examples

#### Using cURL

```bash
# Scan a repository
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World"}'

# Force scan
curl -X POST http://localhost:3000/scan/force \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World"}'

# Get statistics
curl -X GET http://localhost:3000/scan/statistics \
  -H "X-API-Key: your-api-key"

# Get scan records
curl -X GET http://localhost:3000/scan/records \
  -H "X-API-Key: your-api-key"
```

#### Using JavaScript/Node.js

```javascript
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY
};

// Scan repository
async function scanRepository(repoUrl) {
  try {
    const response = await axios.post(`${API_BASE_URL}/scan`, {
      repoUrl
    }, { headers });
    
    console.log('Scan results:', response.data);
    return response.data;
  } catch (error) {
    console.error('Scan failed:', error.response?.data || error.message);
  }
}

// Get statistics
async function getStatistics() {
  try {
    const response = await axios.get(`${API_BASE_URL}/scan/statistics`, { headers });
    console.log('Statistics:', response.data);
    return response.data;
  } catch (error) {
    console.error('Failed to get statistics:', error.response?.data || error.message);
  }
}

// Usage
scanRepository('https://github.com/octocat/Hello-World');
getStatistics();
```

## Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Specific test suites
npm run test:unit -- --testPathPattern=security-scan
npm run test:e2e -- --testPathPattern=change-detection
```

### Test Coverage

The project includes comprehensive test coverage for:
- Unit tests for all services and components
- Integration tests for API endpoints
- E2E tests for complete workflows
- Change detection functionality tests

## Deployment

### Production Deployment

The Repository Security Scanner can be deployed to various cloud platforms:

#### Docker Deployment
```bash
# Build production image
docker build -t repo-security-scanner:latest .

# Run with production environment
docker run -d \
  --name security-scanner \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e API_KEY=your-production-api-key \
  repo-security-scanner:latest
```

#### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: security-scanner
spec:
  replicas: 3
  selector:
    matchLabels:
      app: security-scanner
  template:
    metadata:
      labels:
        app: security-scanner
    spec:
      containers:
      - name: security-scanner
        image: repo-security-scanner:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: api-key-secret
              key: api-key
```

#### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Application port | `3000` | No |
| `NODE_ENV` | Environment mode | `development` | No |
| `API_KEY` | API authentication key | - | Yes |
| `GITHUB_TOKEN` | GitHub API token | - | No |

## Architecture

### Project Structure

```
src/
├── config/                 # Configuration management
├── security-scan/         # Main security scanning module
│   ├── dto/              # Data Transfer Objects
│   ├── guards/           # Authentication guards
│   ├── interfaces/       # TypeScript interfaces
│   ├── providers/        # Service providers
│   │   ├── scm-git.provider.ts      # Git repository provider
│   │   ├── scanner-semgrep.service.ts # Semgrep scanner
│   │   └── scan-storage.service.ts   # Scan history storage
│   ├── security-scan.controller.ts  # API endpoints
│   ├── security-scan.service.ts     # Main business logic
│   └── security-scan.module.ts      # Module definition
├── app.module.ts         # Root application module
└── main.ts              # Application entry point
```

### Key Components

- **SecurityScanController**: Handles HTTP requests and responses
- **SecurityScanService**: Core business logic for scanning and change detection
- **GitScmProvider**: Manages repository cloning and metadata extraction
- **SemgrepScanner**: Integrates with Semgrep for security analysis
- **ScanStorageService**: Manages scan history and statistics
- **ApiKeyGuard**: Provides API key authentication

## Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Run tests: `npm run test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature/your-feature`
7. Submit a pull request

### Code Style

- Follow TypeScript best practices
- Use NestJS decorators and patterns
- Write comprehensive tests for new features
- Update documentation for API changes

## Troubleshooting

### Common Issues

#### Semgrep Not Found
```bash
# Install Semgrep
brew install semgrep  # macOS
pip install semgrep   # Python
```

#### Git Clone Failures
- Ensure the repository URL is accessible
- Check network connectivity
- Verify repository permissions

#### API Key Issues
- Ensure the API key is set in environment variables
- Check the `X-API-Key` header in requests
- Verify the key matches the configured value

### Logs and Debugging

Enable debug logging by setting `NODE_ENV=development` and check the console output for detailed information about:
- Repository cloning process
- Change detection results
- Scanner execution
- Error details

## Security Considerations

- **API Key Security**: Use strong, unique API keys and rotate them regularly
- **Repository Access**: Ensure the scanner has appropriate access to repositories
- **Network Security**: Use HTTPS in production and secure network connections
- **Data Privacy**: Be aware that repository content is temporarily cloned for scanning

## Performance Optimization

- **Change Detection**: Leverages intelligent change detection to avoid unnecessary scans
- **Temporary Storage**: Uses temporary directories that are automatically cleaned up
- **Concurrent Scans**: Supports multiple concurrent repository scans
- **Caching**: Implements in-memory caching for scan results and metadata

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the troubleshooting section above
