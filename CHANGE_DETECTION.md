# Change Detection Feature

## Overview

The repository security scanner now includes intelligent change detection to avoid unnecessary scans when no code changes have been made since the last security check. This feature improves performance, reduces resource usage, and provides better user experience.

## How It Works

### 1. **Commit Hash Tracking**
- Each scan stores the last commit hash of the repository
- Subsequent scans compare the current commit hash with the stored one
- If hashes match, the scan is skipped

### 2. **Change Detection Methods**
- **API-based**: Uses Git hosting platform APIs (GitHub, GitLab, Bitbucket)
- **Git-based**: Falls back to Git commands for detailed change analysis
- **Fallback**: Assumes changes if detection fails

### 3. **Change Summary**
When changes are detected, the system provides detailed information:
- Number of files changed
- Lines added/removed
- Number of commits since last scan

## API Endpoints

### 1. **Regular Scan** (with change detection)
```http
POST /scan
Content-Type: application/json
X-API-Key: your-api-key

{
  "repoUrl": "https://github.com/user/repo"
}
```

**Response when no changes:**
```json
{
  "repository": {
    "name": "repo",
    "description": "Test repository",
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

**Response when changes detected:**
```json
{
  "repository": { ... },
  "scanner": {
    "name": "Semgrep",
    "version": "latest"
  },
  "findings": [ ... ],
  "changeDetection": {
    "hasChanges": true,
    "lastCommitHash": "def456ghi789",
    "changeSummary": {
      "filesChanged": 5,
      "additions": 120,
      "deletions": 45,
      "commits": 3
    },
    "scanSkipped": false
  }
}
```

### 2. **Force Scan** (bypass change detection)
```http
POST /scan/force
Content-Type: application/json
X-API-Key: your-api-key

{
  "repoUrl": "https://github.com/user/repo"
}
```

### 3. **Get Scan Statistics**
```http
GET /scan/statistics
X-API-Key: your-api-key
```

**Response:**
```json
{
  "totalRepositories": 15,
  "totalScans": 42,
  "lastScanTimestamp": "2024-01-01T12:00:00Z"
}
```

### 4. **Get All Scan Records**
```http
GET /scan/records
X-API-Key: your-api-key
```

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

## Implementation Details

### 1. **SCM Interface Extensions**
```typescript
export interface ScmProvider {
  // ... existing methods
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
```

### 2. **Scan Storage Service**
```typescript
export interface ScanRecord {
  repoUrl: string;
  lastCommitHash: string;
  lastScanTimestamp: string;
  scanCount: number;
}

@Injectable()
export class ScanStorageService {
  getLastScanRecord(repoUrl: string): ScanRecord | null;
  updateScanRecord(repoUrl: string, lastCommitHash: string): void;
  getScanStatistics(): { totalRepositories: number; totalScans: number; lastScanTimestamp?: string };
  getAllScanRecords(): ScanRecord[];
}
```

### 3. **Enhanced Scan Result DTO**
```typescript
export class ScanResultDto {
  // ... existing properties
  changeDetection?: {
    hasChanges: boolean;
    lastCommitHash: string;
    changeSummary?: {
      filesChanged: number;
      additions: number;
      deletions: number;
      commits: number;
    };
    scanSkipped?: boolean;
    reason?: string;
  };
}
```

## Change Detection Algorithm

### 1. **API-Based Detection** (Preferred)
- **GitHub**: Uses GitHub REST API to get latest commit
- **GitLab**: Uses GitLab API v4 to get latest activity
- **Bitbucket**: Uses Bitbucket API 2.0 to get latest commit

### 2. **Git-Based Detection** (Fallback)
- Performs shallow clone to get latest commit hash
- Compares with stored commit hash
- If different, performs full clone for detailed analysis

### 3. **Detailed Change Analysis**
When changes are detected:
- Clones full repository
- Uses `git log` to get commit range
- Uses `git diff` to get file and line statistics
- Provides comprehensive change summary

## Benefits

### 1. **Performance Improvement**
- Skips unnecessary scans when no changes exist
- Reduces processing time and resource usage
- Faster response times for unchanged repositories

### 2. **Resource Optimization**
- Reduces bandwidth usage
- Minimizes CPU and memory consumption
- Lower infrastructure costs

### 3. **Better User Experience**
- Immediate response for unchanged repositories
- Clear indication of why scan was skipped
- Detailed change information when scans are performed

### 4. **Operational Efficiency**
- Reduced false positives from repeated scans
- Better tracking of scan history
- Statistics for monitoring and optimization

## Configuration Options

### 1. **Force Scan**
Use the `/scan/force` endpoint to bypass change detection:
```bash
curl -X POST http://localhost:3000/scan/force \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/user/repo"}'
```

### 2. **Storage Options**
Currently uses in-memory storage. Future enhancements could include:
- **Database Storage**: Persistent storage with PostgreSQL/MySQL
- **Redis Storage**: High-performance caching
- **File Storage**: JSON files for simple deployments

## Error Handling

### 1. **Detection Failures**
- If change detection fails, assumes changes exist
- Logs warnings for debugging
- Continues with full scan

### 2. **API Rate Limits**
- Graceful degradation to Git-based detection
- Respects platform rate limits
- Implements exponential backoff

### 3. **Network Issues**
- Timeout handling for API calls
- Fallback to local Git commands
- Robust error recovery

## Monitoring and Analytics

### 1. **Scan Statistics**
- Total repositories scanned
- Total number of scans performed
- Last scan timestamp

### 2. **Performance Metrics**
- Scan skip rate
- Average scan duration
- Resource usage patterns

### 3. **Change Patterns**
- Most frequently changed repositories
- Change frequency analysis
- Optimization opportunities

## Future Enhancements

### 1. **Advanced Change Detection**
- File-level change tracking
- Dependency change detection
- Security-relevant change filtering

### 2. **Persistent Storage**
- Database integration
- Backup and recovery
- Multi-instance support

### 3. **Smart Scheduling**
- Automatic scan scheduling
- Change-based triggers
- Priority-based scanning

### 4. **Integration Features**
- Webhook support for real-time scanning
- CI/CD pipeline integration
- Third-party tool integration

## Usage Examples

### 1. **Regular Development Workflow**
```bash
# First scan - will perform full scan
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/user/repo"}'

# Subsequent scan with no changes - will be skipped
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/user/repo"}'
```

### 2. **CI/CD Integration**
```yaml
# GitHub Actions example
- name: Security Scan
  run: |
    curl -X POST ${{ secrets.SCANNER_URL }}/scan \
      -H "Content-Type: application/json" \
      -H "X-API-Key: ${{ secrets.API_KEY }}" \
      -d '{"repoUrl": "${{ github.repositoryUrl }}"}'
```

### 3. **Monitoring Dashboard**
```bash
# Get scan statistics for dashboard
curl -X GET http://localhost:3000/scan/statistics \
  -H "X-API-Key: your-api-key"

# Get detailed scan records
curl -X GET http://localhost:3000/scan/records \
  -H "X-API-Key: your-api-key"
```

The change detection feature provides intelligent scanning that adapts to repository activity, improving efficiency while maintaining security coverage. 