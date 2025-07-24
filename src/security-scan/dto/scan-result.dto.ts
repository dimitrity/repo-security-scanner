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
  // Primary findings array
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
  // Findings organized by scanner
  allFindings: {
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
  // Structured response properties
  summary?: {
    totalFindings: number;
    scanners: Array<{
      name: string;
      version: string;
      findingsFound: number;
      summary: string;
    }>;
  };
  details?: {
    scanners: Array<{
      name: string;
      version: string;
      totalFindings: number;
      severityBreakdown: {
        high: number;
        medium: number;
        low: number;
        info: number;
      };
      findings: {
        high: Array<any>;
        medium: Array<any>;
        low: Array<any>;
        info: Array<any>;
      };
    }>;
  };
}
