# Gitleaks Integration Summary

## Overview

Successfully integrated Gitleaks as a second security scanner in the Repository Security Scanner application. Gitleaks is a powerful tool for detecting secrets, credentials, and sensitive information in Git repositories.

## What Was Implemented

### 1. Gitleaks Scanner Service
- **File**: `src/security-scan/providers/scanner-gitleaks.service.ts`
- **Features**:
  - Implements the `SecurityScanner` interface
  - Secure command execution using `spawn` (prevents command injection)
  - Comprehensive input validation and path sanitization
  - **Key-value format parsing** (Gitleaks outputs in key-value format, not JSON)
  - Severity mapping (high/medium/low) based on rule types
  - Timeout handling (5 minutes)
  - Graceful error handling and logging
  - **Enhanced finding structure** with entropy, commit info, and fingerprints

### 2. Module Integration
- **File**: `src/security-scan/security-scan.module.ts`
- **Changes**:
  - Added `GitleaksScanner` to providers
  - Updated factory to include both Semgrep and Gitleaks scanners
  - Both scanners now run in parallel during security scans

### 3. Service Updates
- **File**: `src/security-scan/security-scan.service.ts`
- **Changes**:
  - Enhanced scanner execution to handle multiple scanners
  - Added scanner information to each finding
  - Improved error handling (one scanner failure doesn't stop others)
  - Better logging for each scanner's results

### 4. Docker Integration
- **File**: `Dockerfile`
- **Changes**:
  - Added Gitleaks installation using official binary
  - Version: 8.18.0 (latest stable)
  - Proper permissions and ownership for non-root user
  - Verified installation works correctly

## What Gitleaks Detects

### High Severity
- AWS Access Keys and Secret Keys
- Private Keys (SSH, RSA, DSA, EC)
- API Keys (various services)
- Passwords and Tokens
- Generic secrets

### Medium Severity
- Email addresses
- URLs and endpoints
- IP addresses
- Credit card numbers

### Low Severity
- Other patterns and unknown rules

## API Response Format

When both scanners run, findings include scanner information:

```json
{
  "findings": [
    {
      "ruleId": "security.weak-crypto",
      "message": "Weak cryptographic algorithm detected",
      "filePath": "src/auth.js",
      "line": 15,
      "severity": "high",
      "scanner": "Semgrep"
    },
    {
      "ruleId": "gitleaks.aws-access-token",
      "message": "const awsKey = 'AKIAIOSFODNN7EXAMPLE';",
      "filePath": "config.js",
      "line": 3,
      "severity": "high",
      "secret": "AKIAIOSFODNN7EXAMPLE",
      "match": "const awsKey = 'AKIAIOSFODNN7EXAMPLE';",
      "tags": ["aws-access-token"],
      "scanner": "Gitleaks",
      "entropy": 3.684184,
      "commit": "a6355bcbd7a04de1f3703ee60a3d2acda95d30ec",
      "author": "Test User",
      "email": "test@example.com",
      "date": "2025-07-22T21:14:25Z",
      "fingerprint": "a6355bcbd7a04de1f3703ee60a3d2acda95d30ec:config.js:aws-access-token:3"
    },
    {
      "ruleId": "gitleaks.scan-summary",
      "message": "Gitleaks scan completed - found 1 potential secret(s)",
      "filePath": "N/A",
      "line": 0,
      "severity": "info",
      "secret": "N/A",
      "match": "N/A",
      "tags": ["scan-summary", "gitleaks"],
      "scanner": "Gitleaks",
      "scanStatus": "completed_with_secrets",
      "exitCode": 1,
      "secretsFound": 1,
      "scanOutput": {
        "stdout": "Finding: const awsKey = 'AKIAIOSFODNN7EXAMPLE';...",
        "stderr": "9:14PM INF 1 commits scanned...",
        "hasOutput": true,
        "hasErrors": true
      },
      "timestamp": "2025-07-22T21:14:25.123Z"
    }
  ]
}
```

## Scan Summary Feature

Gitleaks always includes a scan summary finding in the results, even when no secrets are found. This provides visibility into the scanning process:

### Scan Summary Fields

| Field | Description | Example |
|-------|-------------|---------|
| `ruleId` | Always `gitleaks.scan-summary` | `gitleaks.scan-summary` |
| `message` | Scan completion message | `Gitleaks scan completed - found 2 potential secret(s)` |
| `severity` | Always `info` | `info` |
| `scanStatus` | Scan completion status | `completed_with_secrets` or `completed_no_secrets` |
| `exitCode` | Gitleaks exit code | `0` (no secrets) or `1` (secrets found) |
| `secretsFound` | Number of secrets detected | `2` |
| `scanOutput` | Raw scan output information | See structure below |
| `timestamp` | When the scan completed | `2025-07-22T21:14:25.123Z` |

### Scan Output Structure

```json
{
  "stdout": "Raw stdout from Gitleaks command",
  "stderr": "Raw stderr from Gitleaks command", 
  "hasOutput": true,
  "hasErrors": false
}
```

### Benefits of Scan Summary

1. **Always Present**: Even when no secrets are found, you get confirmation the scan ran
2. **Debugging**: Raw output helps troubleshoot scan issues
3. **Audit Trail**: Timestamp and status provide audit information
4. **Monitoring**: Can track scan success/failure rates
5. **Transparency**: Full visibility into what Gitleaks detected or didn't detect

## Security Features

### Command Injection Prevention
- Uses `spawn` instead of `exec` for secure command execution
- Input validation and path sanitization
- Restricted to allowed directories (`/tmp`, current working directory)

### Error Handling
- Graceful degradation if one scanner fails
- Comprehensive logging for debugging
- Timeout protection (5 minutes)
- JSON parsing error handling

### Container Security
- Runs as non-root user (`nestjs`)
- Proper file permissions
- Isolated execution environment

## Testing

### Docker Container Test
```bash
# Test Gitleaks installation
docker run --rm repo-security-scanner gitleaks version
# Output: 8.18.0

# Test full application build
docker build -t repo-security-scanner .
# Build successful
```

### Application Build Test
```bash
npm run build
# Build successful - all TypeScript compiles correctly
```

## Installation Requirements

### Local Development
```bash
# macOS
brew install gitleaks

# Ubuntu/Debian
curl -sSfL https://raw.githubusercontent.com/zricethezav/gitleaks/master/install.sh | sh -s -- -b /usr/local/bin

# Windows
# Download from https://github.com/zricethezav/gitleaks/releases
```

### Docker
Gitleaks is automatically installed in the Docker image.

## Usage

### API Endpoint
```bash
curl -X POST http://localhost:3000/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"repoUrl": "https://github.com/user/repository"}'
```

### Response
The API now returns findings from both Semgrep and Gitleaks scanners, with each finding tagged with its source scanner.

## Benefits

1. **Comprehensive Security**: Covers both code vulnerabilities (Semgrep) and secret exposure (Gitleaks)
2. **Secret Detection**: Finds accidentally committed credentials and sensitive data
3. **Extensible Architecture**: Easy to add more scanners in the future
4. **Production Ready**: Proper error handling, logging, and security measures
5. **Docker Support**: Pre-installed in container for easy deployment

## Future Enhancements

1. **Custom Rules**: Support for organization-specific Gitleaks rules
2. **False Positive Management**: Mark findings as false positives
3. **Secret Rotation**: Automatic suggestions for secret rotation
4. **Integration APIs**: Connect with secret management systems
5. **Historical Analysis**: Track secret exposure over time

## Files Modified

1. `src/security-scan/providers/scanner-gitleaks.service.ts` - New Gitleaks scanner
2. `src/security-scan/security-scan.module.ts` - Module integration
3. `src/security-scan/security-scan.service.ts` - Multi-scanner support
4. `Dockerfile` - Gitleaks installation
5. `README.md` - Updated documentation

## Verification

✅ Gitleaks scanner service created and implements SecurityScanner interface  
✅ Module integration completed with both scanners  
✅ Service updated to handle multiple scanners with error handling  
✅ Docker build successful with Gitleaks installation  
✅ Application builds without TypeScript errors  
✅ Gitleaks version 8.18.0 installed and working in container  
✅ Security measures implemented (spawn, validation, non-root user)  
✅ **Gitleaks parsing fixed** - handles key-value format output correctly  
✅ **Integration tested** - successfully detects and parses secrets  
✅ **Scan summary feature** - always includes scan status and output information  

The Gitleaks integration is now complete and ready for production use! 