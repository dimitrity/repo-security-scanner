# File Path Fix for Code Context

## Issue

Previously, the code context in scan results was showing temporary file paths instead of repository-relative paths, making it difficult for users to locate files in their actual repository.

## Problem Example

**Before Fix:**
```json
{
  "codeContext": {
    "filePath": "/tmp/tmp-12345-abcdef/src/config/database.js",
    "line": 15,
    "context": [...]
  }
}
```

## Solution

**After Fix:**
```json
{
  "codeContext": {
    "filePath": "src/config/database.js",
    "line": 15,
    "context": [...]
  }
}
```

## Implementation

### Changes Made

1. **Modified `getEnhancedCodeContext` method** in `SecurityScanService`:
   - Updated to preserve the original repository-relative file path
   - Added explicit comment to clarify the intention
   - Ensured the method uses the finding's original `filePath` instead of the temporary path

2. **Enhanced Semgrep Scanner** (`scanner-semgrep.service.ts`):
   - Added `getRelativePath()` method to convert absolute paths to repository-relative paths
   - Modified finding transformation to use `this.getRelativePath(result.path, targetPath)`
   - Ensures all Semgrep findings report clean repository-relative file paths

3. **Enhanced Gitleaks Scanner** (`scanner-gitleaks.service.ts`):
   - Added `getRelativePath()` method to convert absolute paths to repository-relative paths
   - Modified `parseGitleaksOutput()` to accept `targetPath` parameter
   - Updated `transformGitleaksFinding()` to use `this.getRelativePath(gitleaksFinding.File, targetPath)`
   - Ensures all Gitleaks findings report clean repository-relative file paths

```typescript
// Use the original filePath from the finding, not the temp path
return {
  filePath: filePath, // This is the repo-relative path
  line,
  startLine: startLine + 1,
  endLine: endLine,
  context: fileContent.slice(startLine, endLine).map((content, index) => ({
    lineNumber: startLine + index + 1,
    content: content,
    isTargetLine: startLine + index + 1 === line
  }))
};
```

### How It Works

1. **Scanner Detection**: Both Semgrep and Gitleaks detect issues with absolute paths from temporary directories
2. **Path Conversion**: Each scanner converts absolute paths to repository-relative paths:
   - **Semgrep**: Uses `getRelativePath(result.path, targetPath)` in finding transformation
   - **Gitleaks**: Uses `getRelativePath(gitleaksFinding.File, targetPath)` in finding transformation  
3. **Code Context Generation**: The `getEnhancedCodeContext` method:
   - Receives clean repository-relative paths from scanners
   - Constructs the full path using `path.join(repoPath, filePath)` to read the file
   - Returns the original clean `filePath` in the context
4. **Result**: Users see clean, repository-relative paths throughout the entire response

### Benefits

1. **User Experience**: File paths are now clickable and navigable in the user's actual repository
2. **IDE Integration**: Paths can be easily opened in IDEs and editors
3. **Clarity**: No confusion about temporary folder locations
4. **Consistency**: All file paths in findings now use the same format

### Testing

The fix has been validated with:
- ✅ Unit tests confirming repository-relative paths for both scanners
- ✅ Build verification ensuring no compilation errors
- ✅ Path validation tests to ensure no temporary paths leak through
- ✅ Scanner-specific tests for Semgrep and Gitleaks path conversion
- ✅ Integration tests confirming end-to-end path resolution

### Example Output

When a finding is detected in `src/components/Login.tsx` at line 42:

```json
{
  "ruleId": "security.weak-crypto",
  "message": "Weak cryptographic algorithm detected",
  "filePath": "src/components/Login.tsx",
  "line": 42,
  "severity": "high",
  "scanner": "Semgrep",
  "codeContext": {
    "filePath": "src/components/Login.tsx",
    "line": 42,
    "startLine": 39,
    "endLine": 45,
    "context": [
      {
        "lineNumber": 39,
        "content": "// Hash user password",
        "isTargetLine": false
      },
      {
        "lineNumber": 40,
        "content": "const crypto = require('crypto');",
        "isTargetLine": false
      },
      {
        "lineNumber": 41,
        "content": "",
        "isTargetLine": false
      },
      {
        "lineNumber": 42,
        "content": "const hash = crypto.createHash('md5').update(password).digest('hex');",
        "isTargetLine": true
      },
      {
        "lineNumber": 43,
        "content": "",
        "isTargetLine": false
      },
      {
        "lineNumber": 44,
        "content": "// Store in database",
        "isTargetLine": false
      },
      {
        "lineNumber": 45,
        "content": "await saveUser({ username, password: hash });",
        "isTargetLine": false
      }
    ]
  }
}
```

## Status

✅ **Fixed**: File paths in code context now show repository-relative paths  
✅ **Tested**: Unit tests confirm correct path resolution  
✅ **Deployed**: Available in the current version of the security scanner  

The file path issue has been resolved and users will now see clean, navigable file paths in their scan results. 