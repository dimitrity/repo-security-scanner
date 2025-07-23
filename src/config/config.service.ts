import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  /**
   * Check if the provided API key is valid
   */
  isValidApiKey(apiKey: string): boolean {
    // Simple hardcoded API key validation
    const validApiKey = process.env.API_KEYS || 'your-secure-production-key-2025';
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
} 