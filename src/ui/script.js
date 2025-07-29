// Configuration
const API_BASE_URL = window.location.origin;
const API_KEY = 'your-secure-production-key-2025'; // This matches the backend configuration

// Global state
let currentScanData = null;
let authToken = null;

// Authentication functions
async function authenticateWithApiKey() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/api-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey: API_KEY })
        });

        if (!response.ok) {
            throw new Error(`Authentication failed: ${response.statusText}`);
        }

        const data = await response.json();
        authToken = data.token;
        return true;
    } catch (error) {
        console.error('Authentication error:', error);
        return false;
    }
}

async function ensureAuthenticated() {
    if (!authToken) {
        const authenticated = await authenticateWithApiKey();
        if (!authenticated) {
            throw new Error('Failed to authenticate with API key');
        }
    }
    return authToken;
}

async function handleApiResponse(response) {
    if (response.status === 401) {
        // Token might be expired, try to re-authenticate
        authToken = null;
        const authenticated = await authenticateWithApiKey();
        if (!authenticated) {
            throw new Error('Authentication failed - please check your API key');
        }
        return false; // Indicate that we need to retry the request
    }
    return true; // Response is valid
}

// Main scan functions
async function scanRepository() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    if (!repoUrl) {
        showError('Please enter a repository URL');
        return;
    }
    
    await performScan(repoUrl, '/scan');
}

async function forceScanRepository() {
    const repoUrl = document.getElementById('repoUrl').value.trim();
    if (!repoUrl) {
        showError('Please enter a repository URL');
        return;
    }
    
    await performScan(repoUrl, '/scan/force');
}

async function performScan(repoUrl, endpoint) {
    try {
        showLoading();
        hideError();
        hideResults();
        
        // Ensure we have a valid authentication token
        const token = await ensureAuthenticated();
        
        let response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ repoUrl })
        });
        
        // Handle token expiration
        if (!(await handleApiResponse(response))) {
            // Retry with new token
            const newToken = await ensureAuthenticated();
            response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${newToken}`
                },
                body: JSON.stringify({ repoUrl })
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        currentScanData = data;
        
        hideLoading();
        displayResults(data);
        
    } catch (error) {
        hideLoading();
        showError(`Scan failed: ${error.message}`);
        console.error('Scan error:', error);
    }
}

// Display functions
function displayResults(data) {
    displayRepositoryInfo(data.repository);
    displayScanSummary(data);
    displaySecurityIssues(data);
    showResults();
}

function displayRepositoryInfo(repository) {
    document.getElementById('repoName').textContent = repository.name;
    document.getElementById('repoDescription').textContent = repository.description || 'No description available';
    document.getElementById('repoDefaultBranch').textContent = repository.defaultBranch;
    
    const lastCommit = `${repository.lastCommit.hash.substring(0, 8)} - ${formatDate(repository.lastCommit.timestamp)}`;
    document.getElementById('repoLastCommit').textContent = lastCommit;
}

function displayScanSummary(data) {
    // Use the new securityIssues property or fall back to findings for backward compatibility
    const issues = data.securityIssues || data.findings || [];
    
    // Count issues by severity
    const severityCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
    };
    
    issues.forEach(issue => {
        const severity = issue.severity.toLowerCase();
        if (severityCounts.hasOwnProperty(severity)) {
            severityCounts[severity]++;
        }
    });
    
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
    
    // Build scanner summary if available
    let scannerSummaryHTML = '';
    if (data.summary && data.summary.scanners) {
        scannerSummaryHTML = `
            <div class="scanner-summary">
                <h3>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 1C3.58 1 0 4.58 0 8s3.58 7 8 7 8-3.14 8-7-3.58-7-8-7zm0 10.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM8 9a1 1 0 0 1-1-1V6a1 1 0 0 1 2 0v2a1 1 0 0 1-1 1z"/>
                    </svg>
                    Scanner Breakdown
                </h3>
                <div class="scanner-stats">
                    ${data.summary.scanners.map(scanner => `
                        <div class="scanner-item">
                            <div class="scanner-name">${escapeHtml(scanner.name)}</div>
                            <div class="scanner-version">v${escapeHtml(scanner.version)}</div>
                            <div class="scanner-count">${scanner.securityIssuesFound} issues found</div>
                            <div class="scanner-description">${escapeHtml(scanner.summary)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    const scanSummary = document.getElementById('scanSummary');
    scanSummary.innerHTML = `
        <h2>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm1-3H7V6h2v4z"/>
            </svg>
            Scan Summary
        </h2>
        <div class="summary-stats">
            <div class="stat-item critical">
                <span class="stat-number">${severityCounts.critical}</span>
                <span class="stat-label">Critical</span>
            </div>
            <div class="stat-item high">
                <span class="stat-number">${severityCounts.high}</span>
                <span class="stat-label">High</span>
            </div>
            <div class="stat-item medium">
                <span class="stat-number">${severityCounts.medium}</span>
                <span class="stat-label">Medium</span>
            </div>
            <div class="stat-item low">
                <span class="stat-number">${severityCounts.low}</span>
                <span class="stat-label">Low</span>
            </div>
            <div class="stat-item info">
                <span class="stat-number">${severityCounts.info}</span>
                <span class="stat-label">Info</span>
            </div>
            <div class="stat-item">
                <span class="stat-number">${total}</span>
                <span class="stat-label">Total</span>
            </div>
        </div>
        ${scannerSummaryHTML}
    `;
    scanSummary.style.display = 'block';
}

function displaySecurityIssues(data) {
    // Use the new securityIssues property or fall back to findings for backward compatibility
    const issues = data.securityIssues || data.findings || [];
    
    // Group issues by severity
    const groupedIssues = {
        critical: [],
        high: [],
        medium: [],
        low: [],
        info: []
    };
    
    issues.forEach(issue => {
        const severity = issue.severity.toLowerCase();
        if (groupedIssues.hasOwnProperty(severity)) {
            groupedIssues[severity].push(issue);
        }
    });
    
    // Create the issue groups HTML
    const issueGroupsContainer = document.getElementById('issueGroups');
    issueGroupsContainer.innerHTML = '';
    
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
    const severityLabels = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        info: 'Info'
    };
    
    const severityIcons = {
        critical: 'Critical',
        high: 'High',
        medium: 'Medium',
        low: 'Low',
        info: 'Info'
    };
    
    severityOrder.forEach(severity => {
        const issues = groupedIssues[severity];
        if (issues.length === 0) return;
        
        const groupElement = createSeverityGroup(severity, severityLabels[severity], severityIcons[severity], issues);
        issueGroupsContainer.appendChild(groupElement);
    });
    
    if (issues.length === 0) {
        issueGroupsContainer.innerHTML = '<div class="no-issues">No security issues found!</div>';
    }
}

function createSeverityGroup(severity, label, icon, issues) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'severity-group';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = `severity-header ${severity}`;
    headerDiv.onclick = () => toggleSeverityGroup(headerDiv);
    
    headerDiv.innerHTML = `
        <span>${icon} ${label} (${issues.length})</span>
        <span class="toggle-icon">▼</span>
    `;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'severity-content';
    
    issues.forEach(issue => {
        const findingElement = createFindingElement(issue);
        contentDiv.appendChild(findingElement);
    });
    
    groupDiv.appendChild(headerDiv);
    groupDiv.appendChild(contentDiv);
    
    return groupDiv;
}

function createFindingElement(issue) {
    const findingDiv = document.createElement('div');
    findingDiv.className = 'finding-item';
    findingDiv.onclick = () => showCodeContext(issue);
    
    findingDiv.innerHTML = `
        <div class="finding-header">
            <div>
                <div class="finding-title">${escapeHtml(issue.message)}</div>
                <div class="finding-rule">${escapeHtml(issue.ruleId)}</div>
            </div>
            <div>
                ${issue.scanner ? `<span class="finding-scanner">${escapeHtml(issue.scanner)}</span>` : ''}
            </div>
        </div>
        <div class="finding-location">
            📄 ${escapeHtml(issue.filePath)} : ${issue.line}
        </div>
    `;
    
    return findingDiv;
}

function toggleSeverityGroup(headerElement) {
    const contentElement = headerElement.nextElementSibling;
    const isCollapsed = headerElement.classList.contains('collapsed');
    
    if (isCollapsed) {
        headerElement.classList.remove('collapsed');
        contentElement.classList.remove('collapsed');
    } else {
        headerElement.classList.add('collapsed');
        contentElement.classList.add('collapsed');
    }
}

// Code context modal functions
async function showCodeContext(issue) {
    if (!currentScanData || !currentScanData.repository) {
        showError('No repository data available for code context');
        return;
    }
    
    // Show the modal
    document.getElementById('modalTitle').textContent = `Code Context - ${issue.ruleId}`;
    document.getElementById('modalFile').textContent = issue.filePath;
    document.getElementById('modalLine').textContent = issue.line;
    document.getElementById('codeContext').innerHTML = '<div class="loading-context">Loading code context...</div>';
    
    showModal();
    
    try {
        // Check if code context is already embedded in the issue
        if (issue.codeContext) {
            // Use embedded code context
            displayCodeContext(issue.codeContext, issue.line);
            return;
        }
        
        // Fallback to API call if no embedded context
        console.log('No embedded context found, falling back to API call');
        
        // Extract the actual file path
        let filePath = issue.filePath;
        
        if (filePath.startsWith('http')) {
            // Extract the file path from the web URL
            const url = new URL(filePath);
            const pathParts = url.pathname.split('/');
            // Remove /owner/repo/blob/branch/ prefix to get actual file path
            const blobIndex = pathParts.indexOf('blob');
            if (blobIndex !== -1 && blobIndex + 2 < pathParts.length) {
                filePath = pathParts.slice(blobIndex + 2).join('/');
            }
        } else if (filePath.includes('/tmp/')) {
            // Extract repository-relative path from temporary path
            // Format: /tmp/tmp-12345-abcdef/src/components/Login.tsx
            // Extract: src/components/Login.tsx
            const tmpMatch = filePath.match(/\/tmp\/[^\/]+\/(.+)$/);
            if (tmpMatch && tmpMatch[1]) {
                filePath = tmpMatch[1];
            } else {
                // Fallback: try to find common repository patterns
                const pathParts = filePath.split('/');
                const srcIndex = pathParts.findIndex(part => 
                    ['src', 'lib', 'app', 'components', 'pages', 'utils', 'config', 'tests', 'test'].includes(part)
                );
                if (srcIndex > 0) {
                    filePath = pathParts.slice(srcIndex).join('/');
                }
            }
        }
        
        let response = await fetch(`${API_BASE_URL}/scan/context`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                repoUrl: extractRepoUrl(currentScanData.repository),
                filePath: filePath,
                line: issue.line,
                context: 5 // Show 5 lines of context around the issue
            })
        });
        
        // Handle token expiration
        if (!(await handleApiResponse(response))) {
            // Retry with new token
            const newToken = await ensureAuthenticated();
            response = await fetch(`${API_BASE_URL}/scan/context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${newToken}`
                },
                body: JSON.stringify({
                    repoUrl: extractRepoUrl(currentScanData.repository),
                    filePath: filePath,
                    line: issue.line,
                    context: 5 // Show 5 lines of context around the issue
                })
            });
        }
        
        if (!response.ok) {
            throw new Error(`Failed to fetch code context: ${response.statusText}`);
        }
        
        const contextData = await response.json();
        displayCodeContext(contextData, issue.line);
        
    } catch (error) {
        document.getElementById('codeContext').innerHTML = `
            <div class="error">
                <p>❌ Failed to load code context: ${escapeHtml(error.message)}</p>
                <p>This might be because the repository is private or the file path has changed.</p>
            </div>
        `;
        console.error('Code context error:', error);
    }
}

function displayCodeContext(contextData, targetLine) {
    const codeContextDiv = document.getElementById('codeContext');
    
    if (!contextData.context || contextData.context.length === 0) {
        codeContextDiv.innerHTML = '<div class="no-context">No code context available for this file.</div>';
        return;
    }
    
    let html = '';
    contextData.context.forEach(lineInfo => {
        const isTarget = lineInfo.lineNumber === targetLine;
        html += `
            <div class="code-line ${isTarget ? 'target' : ''}">
                <span class="line-number">${lineInfo.lineNumber}</span>
                <span class="line-content">${escapeHtml(lineInfo.content)}</span>
            </div>
        `;
    });
    
    codeContextDiv.innerHTML = html;
}

function extractRepoUrl(repository) {
    // Try to reconstruct the repo URL from repository info
    // This is a simplified approach - in production you might want to store the original URL
    if (currentScanData && currentScanData.repository) {
        // Check if there's a stored repo URL from the scan
        return document.getElementById('repoUrl').value.trim();
    }
    return '';
}

function showModal() {
    document.getElementById('codeModal').classList.remove('hidden');
    document.getElementById('modalOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeCodeModal() {
    document.getElementById('codeModal').classList.add('hidden');
    document.getElementById('modalOverlay').classList.add('hidden');
    document.body.style.overflow = '';
}

// UI state management functions
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('scanBtn').disabled = true;
    document.getElementById('forceScanBtn').disabled = true;
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('scanBtn').disabled = false;
    document.getElementById('forceScanBtn').disabled = false;
}

function showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').classList.remove('hidden');
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function showResults() {
    document.getElementById('repoInfo').classList.remove('hidden');
    document.getElementById('scanSummary').classList.remove('hidden');
    document.getElementById('securityIssues').classList.remove('hidden');
}

function hideResults() {
    document.getElementById('repoInfo').classList.add('hidden');
    document.getElementById('scanSummary').classList.add('hidden');
    document.getElementById('securityIssues').classList.add('hidden');
}

// Utility functions
function formatDate(timestamp) {
    try {
        return new Date(timestamp).toLocaleString();
    } catch (error) {
        return timestamp;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Escape key to close modal
    if (event.key === 'Escape') {
        closeCodeModal();
    }
    
    // Enter key in repo URL input to trigger scan
    if (event.key === 'Enter' && event.target.id === 'repoUrl') {
        scanRepository();
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Set a default repo URL for demo purposes (remove in production)
    const demoUrl = 'https://github.com/OWASP/NodeGoat';
    document.getElementById('repoUrl').value = demoUrl;
    
    // Focus on the input field
    document.getElementById('repoUrl').focus();
    document.getElementById('repoUrl').select();
}); 