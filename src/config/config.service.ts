import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  /**
   * Check if the provided API key is valid
   */
  isValidApiKey(apiKey: string): boolean {
    // Simple hardcoded API key validation
    const validApiKey =
      process.env.API_KEYS || 'your-secure-production-key-2025';
    return apiKey === validApiKey;
  }

  /**
   * Get the number of configured API keys (for monitoring/stats)
   */
  getApiKeyCount(): number {
    return 1; // Simple single API key setup
  }

  /**
   * Get application port from environment
   */
  getPort(): number {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    return isNaN(port) ? 3000 : port;
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  /**
   * Get throttler configuration
   */
  getThrottlerConfig() {
    const ttl = parseInt(process.env.THROTTLE_TTL || '60', 10);
    const limit = parseInt(process.env.THROTTLE_LIMIT || '10', 10);
    
    return {
      ttl: isNaN(ttl) ? 60 : ttl, // Time window in seconds
      limit: isNaN(limit) ? 10 : limit, // Number of requests per time window
    };
  }

  /**
   * Get throttler configuration for different endpoints
   */
  getEndpointThrottlerConfig() {
    const defaultTtl = parseInt(process.env.THROTTLE_TTL || '60', 10);
    const defaultLimit = parseInt(process.env.THROTTLE_LIMIT || '10', 10);
    const scanTtl = parseInt(process.env.SCAN_THROTTLE_TTL || '300', 10);
    const scanLimit = parseInt(process.env.SCAN_THROTTLE_LIMIT || '5', 10);
    const metadataTtl = parseInt(process.env.METADATA_THROTTLE_TTL || '60', 10);
    const metadataLimit = parseInt(process.env.METADATA_THROTTLE_LIMIT || '20', 10);
    
    return {
      // Default configuration
      default: {
        ttl: isNaN(defaultTtl) ? 60 : defaultTtl,
        limit: isNaN(defaultLimit) ? 10 : defaultLimit,
      },
      // More restrictive for scan endpoints
      scan: {
        ttl: isNaN(scanTtl) ? 300 : scanTtl, // 5 minutes
        limit: isNaN(scanLimit) ? 5 : scanLimit, // 5 requests per 5 minutes
      },
      // Less restrictive for metadata endpoints
      metadata: {
        ttl: isNaN(metadataTtl) ? 60 : metadataTtl,
        limit: isNaN(metadataLimit) ? 20 : metadataLimit,
      },
    };
  }
}
