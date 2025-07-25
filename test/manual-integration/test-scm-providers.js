#!/usr/bin/env node

/**
 * SCM Provider Selection and Usage Demonstration
 */

const http = require('http');

const API_KEY = 'your-secure-production-key-2025';
const BASE_URL = 'http://localhost:3000';

// Test repositories for different providers
const testRepositories = [
  {
    name: 'GitHub Repository',
    url: 'https://github.com/OWASP/NodeGoat',
    expectedProvider: 'GitHub Provider'
  },
  {
    name: 'GitLab Repository', 
    url: 'https://gitlab.com/gitlab-org/gitlab-test',
    expectedProvider: 'GitLab Provider'
  },
  {
    name: 'Generic Git Repository',
    url: 'https://git.kernel.org/pub/scm/git/git.git',
    expectedProvider: 'Enhanced Git Provider'
  }
];

async function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function checkServerHealth() {
  try {
    const response = await makeRequest('GET', '/');
    console.log('✅ Server is running and healthy');
    return true;
  } catch (error) {
    console.log('❌ Server is not responding:', error.message);
    return false;
  }
}

async function demonstrateProviderSelection(repo) {
      console.log(`\nTesting: ${repo.name}`);
      console.log(`Repository URL: ${repo.url}`);
  
  try {
    // Test provider selection by making a scan request
    const response = await makeRequest('POST', '/scan', { repoUrl: repo.url });
    
    if (response.status === 200 || response.status === 201) {
      const scanResult = response.data;
      
      console.log('✅ Scan initiated successfully');
      console.log(`🏗️  Provider Selected: ${scanResult.scanner?.version || 'Unknown'}`);
      console.log(`🌐 Platform Detected: ${scanResult.repository?.platform || 'Unknown'}`);
      console.log(`📋 Repository Name: ${scanResult.repository?.name || 'Unknown'}`);
      console.log(`🔄 Change Detection: ${scanResult.changeDetection ? 'Enabled' : 'Disabled'}`);
      
      // Check if this matches our expectations
      if (scanResult.scanner?.version?.includes(repo.expectedProvider.split(' ')[0])) {
        console.log('Expected provider was selected correctly');
      } else {
        console.log(`Expected: ${repo.expectedProvider}, Got: ${scanResult.scanner?.version}`);
      }
      
      // Show security scan results
      const securityIssues = scanResult.securityIssues || [];
      const allIssues = scanResult.allSecurityIssues || {};
      
      console.log(`Security Issues Found: ${securityIssues.length}`);
              console.log(`Scanners Used: ${Object.keys(allIssues).join(', ') || 'None'}`);
      
      // Show scanner breakdown
      for (const [scanner, issues] of Object.entries(allIssues)) {
        console.log(`   - ${scanner}: ${issues.length} issues`);
        
        // Show first issue details if any
        if (issues.length > 0 && issues[0].ruleId !== 'gitleaks.scan-summary') {
          const issue = issues[0];
          console.log(`     * ${issue.ruleId || 'Unknown'} (${issue.severity || 'Unknown'})`);
          console.log(`       File: ${issue.filePath}:${issue.line}`);
          console.log(`       Message: ${(issue.message || 'No message').substring(0, 80)}...`);
        }
      }
      
    } else {
      console.log(`Scan failed with status: ${response.status}`);
      if (typeof response.data === 'string') {
        console.log(`Error: ${response.data}`);
      } else {
        console.log(`Error: ${JSON.stringify(response.data, null, 2)}`);
      }
    }
    
  } catch (error) {
    console.log(`Error during scan: ${error.message}`);
  }
}

async function demonstrateProviderHealthCheck() {
  console.log('\nChecking Provider Health Status...');
  
  try {
    const response = await makeRequest('GET', '/scan/statistics');
    
    if (response.status === 200) {
      console.log('Statistics endpoint working');
      console.log(`Total Repositories Scanned: ${response.data.totalRepositories || 0}`);
      console.log(`Total Scans Performed: ${response.data.totalScans || 0}`);
    } else {
      console.log(`Statistics endpoint failed: ${response.status}`);
    }
  } catch (error) {
    console.log(`Error checking statistics: ${error.message}`);
  }
}

async function main() {
  console.log('SCM Provider Selection and Usage Demonstration');
  console.log('=' .repeat(60));
  
  // Check if server is running
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.log('\nPlease start the server first: npm start');
    process.exit(1);
  }
  
  // Demonstrate provider health checking
  await demonstrateProviderHealthCheck();
  
  // Demonstrate automatic provider selection for different repository types
  console.log('\nSCM Provider Selection Demonstration');
  console.log('-'.repeat(50));
  
  for (const repo of testRepositories) {
    await demonstrateProviderSelection(repo);
    
    // Add delay between requests to avoid overwhelming the server
    console.log('\nWaiting 3 seconds before next test...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log('\nSCM Provider Demonstration Complete!');
      console.log('\nSummary:');
    console.log('- Automatic provider selection based on repository URL');
      console.log('- GitHub, GitLab, and Generic Git support');
    console.log('- Seamless fallback between providers');
    console.log('- Enhanced metadata extraction for supported platforms');
    console.log('- Multi-scanner security analysis');
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error.message);
  process.exit(1);
});

// Run the demonstration
main().catch(console.error); 