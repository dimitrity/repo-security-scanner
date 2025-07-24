export interface WebhookPayload {
  event: 'scan.completed' | 'scan.failed';
  timestamp: string;
  scanId: string;
  repository: {
    name: string;
    url: string;
    branch?: string;
  };
  summary: {
    totalSecurityIssues: number;
    scanDuration?: number;
    scanners: Array<{
      name: string;
      securityIssuesFound: number;
    }>;
  };
  status: 'success' | 'failed';
  error?: string;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  timestamp: string;
} 