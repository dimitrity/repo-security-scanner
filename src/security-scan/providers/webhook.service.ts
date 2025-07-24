import { Injectable, Logger } from '@nestjs/common';
import { WebhookPayload, WebhookConfig, WebhookDeliveryResult } from '../interfaces/webhook.interface';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  /**
   * Send webhook notification for scan completion
   */
  async sendScanCompletedWebhook(
    repoUrl: string,
    scanResult: any,
    scanDuration?: number,
    error?: string
  ): Promise<void> {
    const webhookUrls = this.getWebhookUrls();
    
    if (webhookUrls.length === 0) {
      this.logger.debug('No webhook URLs configured, skipping notification');
      return;
    }

    const payload = this.createScanPayload(repoUrl, scanResult, scanDuration, error);
    
    // Send to all configured webhooks
    const deliveryPromises = webhookUrls.map(webhookConfig => 
      this.deliverWebhook(webhookConfig, payload)
    );

    const results = await Promise.allSettled(deliveryPromises);
    
    // Log delivery results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        this.logger.log(`Webhook delivered successfully to ${webhookUrls[index].url}`);
      } else {
        const error = result.status === 'rejected' ? result.reason : result.value.error;
        this.logger.error(`Webhook delivery failed to ${webhookUrls[index].url}: ${error}`);
      }
    });
  }

  /**
   * Create webhook payload from scan result
   */
  private createScanPayload(
    repoUrl: string,
    scanResult: any,
    scanDuration?: number,
    error?: string
  ): WebhookPayload {
    const scanId = this.generateScanId(repoUrl);
    const timestamp = new Date().toISOString();
    
    if (error) {
      return {
        event: 'scan.failed',
        timestamp,
        scanId,
        repository: {
          name: this.extractRepoName(repoUrl),
          url: repoUrl,
          branch: scanResult?.repository?.defaultBranch
        },
        summary: {
          totalSecurityIssues: 0,
          scanDuration,
          scanners: []
        },
        status: 'failed',
        error
      };
    }

    const scanners = scanResult?.summary?.scanners || [];
    const totalIssues = scanResult?.summary?.totalSecurityIssues || 0;

    return {
      event: 'scan.completed',
      timestamp,
      scanId,
      repository: {
        name: scanResult?.repository?.name || this.extractRepoName(repoUrl),
        url: repoUrl,
        branch: scanResult?.repository?.defaultBranch
      },
      summary: {
        totalSecurityIssues: totalIssues,
        scanDuration,
        scanners: scanners.map(scanner => ({
          name: scanner.name,
          securityIssuesFound: scanner.securityIssuesFound || 0
        }))
      },
      status: 'success'
    };
  }

  /**
   * Deliver webhook to a specific URL
   */
  private async deliverWebhook(
    config: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDeliveryResult> {
    const timestamp = new Date().toISOString();
    
    try {
      const payloadString = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'repo-security-scanner/1.0',
        'X-Webhook-Timestamp': timestamp,
        'X-Webhook-Event': payload.event,
        ...config.headers
      };

      // Add signature if secret is provided
      if (config.secret) {
        const signature = this.generateSignature(payloadString, config.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      // Use native fetch (Node.js 18+) for HTTP requests
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const success = response.ok;
      
      if (!success) {
        const responseText = await response.text().catch(() => 'Unknown error');
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${responseText}`,
          timestamp
        };
      }

      return {
        success: true,
        statusCode: response.status,
        timestamp
      };

    } catch (error) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        timestamp
      };
    }
  }

  /**
   * Generate HMAC signature for webhook verification
   */
  private generateSignature(payload: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Extract repository name from URL
   */
  private extractRepoName(repoUrl: string): string {
    try {
      const url = new URL(repoUrl);
      const pathParts = url.pathname.split('/').filter(part => part.length > 0);
      if (pathParts.length >= 2) {
        return `${pathParts[pathParts.length - 2]}/${pathParts[pathParts.length - 1]}`.replace('.git', '');
      }
      return repoUrl;
    } catch {
      return repoUrl;
    }
  }

  /**
   * Generate unique scan ID
   */
  private generateScanId(repoUrl: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(repoUrl + timestamp).digest('hex').substring(0, 8);
    return `scan_${timestamp}_${hash}`;
  }

  /**
   * Get configured webhook URLs from environment
   */
  private getWebhookUrls(): WebhookConfig[] {
    const webhookUrl = process.env.WEBHOOK_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookUrl) {
      return [];
    }

    // Support multiple webhook URLs separated by commas
    const urls = webhookUrl.split(',').map(url => url.trim()).filter(url => url.length > 0);
    
    return urls.map(url => ({
      url,
      secret: webhookSecret,
      headers: {}
    }));
  }
} 