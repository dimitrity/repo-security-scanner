export interface SecurityScanner {
  scan(targetPath: string): Promise<
    Array<{
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
    }>
  >;
  getName(): string;
  getVersion(): string;
}
