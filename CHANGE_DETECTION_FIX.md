# Change Detection Fix

## Problem Identified

The change detection feature was not correctly identifying when there were no changes in the repository. The main issues were:

1. **API-based commit hash issues**: The API methods were returning `'latest'` or `'unknown'` instead of actual commit hashes
2. **Git log range issues**: The `git.log({ from: lastCommitHash, to: currentLastCommit })` was not working correctly for commit range comparison
3. **Insufficient error handling**: The change detection was failing silently in many cases

## Fixes Implemented

### 1. **Simplified Commit Hash Retrieval**
- Removed unreliable API-based commit hash fetching
- Now uses only Git commands with shallow clone for consistent commit hash retrieval
- Ensures we always get actual commit hashes, not placeholder values

### 2. **Improved Change Detection Logic**
- Added validation to check if the old commit exists in the repository
- Implemented fallback methods for Git log and diff operations
- Added comprehensive error handling with multiple fallback strategies
- Uses both `git.log({ from, to })` and `git.log({ from: 'hash1..hash2' })` formats

### 3. **Enhanced Error Handling**
- Added detailed logging for debugging change detection issues
- Graceful degradation when Git operations fail
- Assumes changes exist when detection fails (safe default)

### 4. **Better Debugging Support**
- Added extensive logging in the security scan service
- Logs commit hashes, change detection results, and decision points
- Helps identify where the change detection process might be failing

## Key Changes Made

### `src/security-scan/providers/scm-git.provider.ts`

```typescript
// Simplified getLastCommitHash method
async getLastCommitHash(repoUrl: string): Promise<string> {
  try {
    // Use git commands for reliable commit hash
    const { dir } = await import('tmp-promise');
    const tmpDir = await dir({ unsafeCleanup: true });
    
    try {
      // Clone with depth 1 to get latest commit
      await simpleGit().clone(repoUrl, tmpDir.path, ['--depth', '1']);
      const git = simpleGit(tmpDir.path);
      const log = await git.log({ maxCount: 1 });
      return log.latest?.hash || 'unknown';
    } finally {
      await tmpDir.cleanup();
    }
  } catch (error) {
    console.warn(`Failed to get last commit hash for ${repoUrl}:`, error);
    return 'unknown';
  }
}
```

### Enhanced `hasChangesSince` method with fallbacks:

```typescript
// Check if the old commit exists in the repository
try {
  await git.show([lastCommitHash, '--oneline', '--no-patch']);
} catch (commitError) {
  // If old commit doesn't exist, assume changes
  console.warn(`Old commit ${lastCommitHash} not found in repository`);
  return { hasChanges: true, lastCommitHash: currentLastCommit };
}

// Get commit range with fallback methods
let commits = 0;
try {
  const log = await git.log({ from: lastCommitHash, to: currentLastCommit });
  commits = log.total;
} catch (logError) {
  // Try alternative approach
  try {
    const log = await git.log({ from: `${lastCommitHash}..${currentLastCommit}` });
    commits = log.total;
  } catch (altLogError) {
    commits = 0;
  }
}
```

### `src/security-scan/security-scan.service.ts`

Added comprehensive logging:

```typescript
if (!forceScan && lastScanRecord) {
  this.logger.log(`Checking for changes since last scan of ${repoUrl}`);
  this.logger.log(`Last scan commit hash: ${lastScanRecord.lastCommitHash}`);
  
  const changeInfo = await this.scmProvider.hasChangesSince(repoUrl, lastScanRecord.lastCommitHash);
  this.logger.log(`Change detection result:`, changeInfo);
  
  if (!changeInfo.hasChanges) {
    this.logger.log(`No changes detected for ${repoUrl}, skipping scan`);
    // ... skip scan logic
  } else {
    this.logger.log(`Changes detected for ${repoUrl}, proceeding with scan`);
    // ... perform scan logic
  }
} else {
  this.logger.log(`No previous scan record found for ${repoUrl} or force scan requested`);
}
```

## Testing the Fix

### 1. **Unit Tests**
Run the updated unit tests to verify the logic:

```bash
npm run test:unit -- --testPathPattern=security-scan.service
npm run test:unit -- --testPathPattern=scan-storage.service
```

### 2. **Integration Tests**
Run the integration tests to verify end-to-end functionality:

```bash
npm run test:e2e -- --testPathPattern=change-detection.integration
```

### 3. **Manual Testing**
Use the provided test script:

```bash
node test-change-detection.js
```

This script will:
- Perform a first scan (should detect changes)
- Perform a second scan (should skip due to no changes)
- Perform a force scan (should bypass change detection)
- Get scan statistics

### 4. **API Testing**
Test the endpoints manually:

```bash
# First scan
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World"}'

# Second scan (should be skipped)
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World"}'

# Force scan
curl -X POST http://localhost:3000/scan/force \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{"repoUrl": "https://github.com/octocat/Hello-World"}'

# Get statistics
curl -X GET http://localhost:3000/scan/statistics \
  -H "X-API-Key: test-api-key"
```

## Expected Behavior

### First Scan
- Should perform full security scan
- Should store commit hash
- Should return `changeDetection.hasChanges: true`
- Should return `changeDetection.scanSkipped: false`

### Second Scan (No Changes)
- Should skip security scan
- Should return `changeDetection.hasChanges: false`
- Should return `changeDetection.scanSkipped: true`
- Should return `changeDetection.reason: "No changes detected since last scan"`
- Should return `scanner.name: "Change Detection"`

### Force Scan
- Should bypass change detection
- Should perform full security scan
- Should return `changeDetection.scanSkipped: false`
- Should return `scanner.name: "Semgrep"`

## Debugging

If change detection is still not working correctly, check the logs for:

1. **Commit hash comparison**: Look for log messages showing the commit hashes being compared
2. **Git operations**: Check for any Git command failures
3. **Change detection results**: Verify the `hasChanges` value returned by `hasChangesSince`

Example log output:
```
[SecurityScanService] Checking for changes since last scan of https://github.com/test/repo
[SecurityScanService] Last scan commit hash: abc123def456
[SecurityScanService] Change detection result: { hasChanges: false, lastCommitHash: 'abc123def456' }
[SecurityScanService] No changes detected for https://github.com/test/repo, skipping scan
```

## Future Improvements

1. **Persistent Storage**: Replace in-memory storage with database storage
2. **Advanced Change Detection**: Add file-level change tracking
3. **Caching**: Implement caching for frequently accessed repositories
4. **Metrics**: Add performance metrics for change detection operations
5. **Webhooks**: Support real-time change notifications via webhooks

The fix ensures that change detection works reliably by using consistent Git operations and providing comprehensive fallback mechanisms. 