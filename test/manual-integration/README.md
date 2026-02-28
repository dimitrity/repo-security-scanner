# Manual Integration Tests

This folder contains manual integration tests that require the application to be running and are designed for demonstration, debugging, and manual verification purposes.

## Overview

These tests are **not automated** and require manual execution. They complement the automated Jest tests by providing a way to manually verify the complete system works as expected in a real environment.

## Test Files

### `test-scm-providers.js`
**Purpose**: Demonstrates SCM provider selection and usage across different repository types.

**Features**:
- Tests GitHub, GitLab, and Generic Git repositories
- Demonstrates automatic provider selection
- Shows security scanning results
- Provides health status checks

**Usage**:
```bash
# Start the server first
npm start

# In another terminal, run the test
node test/manual-integration/test-scm-providers.js
```

### `test-change-detection.js`
**Purpose**: Tests the change detection functionality to ensure scans are skipped when no changes are detected.

**Features**:
- Tests initial scan behavior
- Verifies change detection logic
- Tests force scan functionality
- Checks scan statistics

**Usage**:
```bash
# Start the server first
npm start

# In another terminal, run the test
node test/manual-integration/test-change-detection.js
```

## Test Characteristics

### Manual Integration Test Features:
- ✅ **Real HTTP Requests**: Uses Node.js `http` module
- ✅ **Live Server**: Requires `localhost:3000` to be running
- ✅ **API Authentication**: Tests with API key authentication
- ✅ **Cross-Component**: Tests multiple components working together

### Demonstration Features:
- ✅ **Educational**: Shows how different features work
- ✅ **Interactive**: Provides detailed console output
- ✅ **User-Friendly**: Clear error messages and instructions
- ✅ **Non-Automated**: Requires manual intervention

## Prerequisites

1. **Server Running**: The application must be started with `npm start`
2. **API Key**: Tests use the default API key `test-api-key`
3. **Network Access**: Tests require internet access to clone repositories
4. **Dependencies**: Node.js and npm must be installed

## Test Execution

### Running Individual Tests:
```bash
# SCM Provider Test
node test/manual-integration/test-scm-providers.js

# Change Detection Test
node test/manual-integration/test-change-detection.js
```

### Running All Manual Tests:
```bash
# Create a simple script to run all manual tests
for file in test/manual-integration/*.js; do
  if [[ $file != */README.md ]]; then
    echo "Running $(basename $file)..."
    node "$file"
    echo "----------------------------------------"
  fi
done
```

## Expected Output

Both tests provide rich console output with:
- ✅ Success indicators
- ❌ Error indicators
- 📊 Statistics and metrics
- 🔍 Detailed analysis results
- ⏳ Progress indicators

## Troubleshooting

### Common Issues:

1. **Server Not Running**:
   ```
   ❌ Server is not responding: connect ECONNREFUSED
   ```
   **Solution**: Start the server with `npm start`

2. **API Key Issues**:
   ```
   ❌ Scan failed with status: 401
   ```
   **Solution**: Check that the API key in the test matches your server configuration

3. **Network Issues**:
   ```
   ❌ Error during scan: connect ETIMEDOUT
   ```
   **Solution**: Check internet connection and firewall settings

4. **Repository Access Issues**:
   ```
   ❌ Failed to clone repository
   ```
   **Solution**: Verify repository URLs are accessible and public

## Integration with CI/CD

These tests are **not suitable for CI/CD** because they:
- Require manual execution
- Need a running server instance
- Depend on external repositories
- Are designed for demonstration purposes

For automated testing, use the Jest integration tests in `test/integration/`.

## Maintenance

- Update repository URLs when they become unavailable
- Adjust API keys to match your environment
- Update expected outputs when the API response format changes
- Add new tests for new features as needed 