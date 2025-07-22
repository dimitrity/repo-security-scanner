export interface SecurityScanner {
  scan(targetPath: string): Promise<Array<{
    ruleId: string;
    message: string;
    filePath: string;
    line: number;
    severity: string;
  }>>;
  getName(): string;
  getVersion(): string;
} 