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
  findings: Array<{
    ruleId: string;
    message: string;
    filePath: string;
    line: number;
    severity: string;
  }>;
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