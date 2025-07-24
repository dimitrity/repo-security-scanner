
export class ScanResultDto {
  repository: {
    name: string;
    description: string;
    defaultBranch: string;
    lastCommit: {
      hash: string;
      timestamp: string;
    };
  };
  scanner: {
    name: string;
    version: string;
  };
  // New primary properties with updated terminology
  securityIssues: Array<{
    ruleId: string;
    message: string;
    filePath: string;
    line: number;
    severity: string;
    codeContext?: {
      filePath: string;
      line: number;
      startLine: number;
      endLine: number;
      context: Array<{
        lineNumber: number;
        content: string;
        isTargetLine: boolean;
      }>;
    };
  }>;
  allSecurityIssues: {
    [scannerName: string]: Array<{
      ruleId: string;
      message: string;
      filePath: string;
      line: number;
      severity: string;
      codeContext?: {
        filePath: string;
        line: number;
        startLine: number;
        endLine: number;
        context: Array<{
          lineNumber: number;
          content: string;
          isTargetLine: boolean;
        }>;
      };
    }>;
  };
  // Legacy compatibility properties
  findings: Array<{
    ruleId: string;
    message: string;
    filePath: string;
    line: number;
    severity: string;
    codeContext?: {
      filePath: string;
      line: number;
      startLine: number;
      endLine: number;
      context: Array<{
        lineNumber: number;
        content: string;
        isTargetLine: boolean;
      }>;
    };
  }>;
  allFindings?: {
    [scannerName: string]: Array<{
      ruleId: string;
      message: string;
      filePath: string;
      line: number;
      severity: string;
      codeContext?: {
        filePath: string;
        line: number;
        startLine: number;
        endLine: number;
        context: Array<{
          lineNumber: number;
          content: string;
          isTargetLine: boolean;
        }>;
      };
    }>;
  };
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
  // New structured response properties
  summary?: {
    totalSecurityIssues: number;
    scanners: Array<{
      name: string;
      version: string;
      securityIssuesFound: number;
      summary: string;
    }>;
  };
  details?: {
    scanners: Array<{
      name: string;
      version: string;
      totalSecurityIssues: number;
      severityBreakdown: {
        high: number;
        medium: number;
        low: number;
        info: number;
      };
      securityIssues: {
        high: Array<any>;
        medium: Array<any>;
        low: Array<any>;
        info: Array<any>;
      };
    }>;
  };
} 