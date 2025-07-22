const { execSync } = require('child_process');

// Test repository URL (using a public repo for testing)
const testRepoUrl = 'https://github.com/octocat/Hello-World';

console.log('Testing change detection functionality...\n');

// Test 1: Get last commit hash
console.log('1. Getting last commit hash...');
try {
  const result = execSync(`curl -s -X POST http://localhost:3000/scan \
    -H "Content-Type: application/json" \
    -H "X-API-Key: test-api-key" \
    -d '{"repoUrl": "${testRepoUrl}"}'`, { encoding: 'utf8' });
  
  const scanResult = JSON.parse(result);
  console.log('First scan result:', JSON.stringify(scanResult, null, 2));
  
  if (scanResult.changeDetection) {
    console.log('✅ Change detection info found');
    console.log(`   Has changes: ${scanResult.changeDetection.hasChanges}`);
    console.log(`   Last commit hash: ${scanResult.changeDetection.lastCommitHash}`);
  } else {
    console.log('❌ No change detection info found');
  }
  
  // Test 2: Second scan (should detect no changes)
  console.log('\n2. Performing second scan (should detect no changes)...');
  setTimeout(async () => {
    try {
      const result2 = execSync(`curl -s -X POST http://localhost:3000/scan \
        -H "Content-Type: application/json" \
        -H "X-API-Key: test-api-key" \
        -d '{"repoUrl": "${testRepoUrl}"}'`, { encoding: 'utf8' });
      
      const scanResult2 = JSON.parse(result2);
      console.log('Second scan result:', JSON.stringify(scanResult2, null, 2));
      
      if (scanResult2.changeDetection?.scanSkipped) {
        console.log('✅ Scan correctly skipped - no changes detected');
      } else {
        console.log('❌ Scan was not skipped - change detection may not be working');
      }
      
      // Test 3: Force scan
      console.log('\n3. Performing force scan...');
      const result3 = execSync(`curl -s -X POST http://localhost:3000/scan/force \
        -H "Content-Type: application/json" \
        -H "X-API-Key: test-api-key" \
        -d '{"repoUrl": "${testRepoUrl}"}'`, { encoding: 'utf8' });
      
      const scanResult3 = JSON.parse(result3);
      console.log('Force scan result:', JSON.stringify(scanResult3, null, 2));
      
      if (scanResult3.changeDetection && !scanResult3.changeDetection.scanSkipped) {
        console.log('✅ Force scan worked correctly');
      } else {
        console.log('❌ Force scan may not be working correctly');
      }
      
      // Test 4: Get statistics
      console.log('\n4. Getting scan statistics...');
      const statsResult = execSync(`curl -s -X GET http://localhost:3000/scan/statistics \
        -H "X-API-Key: test-api-key"`, { encoding: 'utf8' });
      
      const stats = JSON.parse(statsResult);
      console.log('Statistics:', JSON.stringify(stats, null, 2));
      
    } catch (error) {
      console.error('Error in second test:', error.message);
    }
  }, 2000);
  
} catch (error) {
  console.error('Error in first test:', error.message);
  console.log('Make sure the server is running on localhost:3000');
} 