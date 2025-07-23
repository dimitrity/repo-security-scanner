import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ConfigService implements OnModuleInit {
  private readonly logger = new Logger(ConfigService.name);
  private readonly apiKeys: Set<string> = new Set();

  onModuleInit() {
    this.loadApiKeys();
  }

  /**
   * Load API keys from environment variables
   */
  private loadApiKeys(): void {
    const apiKeysEnv = process.env.API_KEYS;
    const legacyApiKey = process.env.API_KEY;
    
    // Support multiple API keys separated by commas
    if (apiKeysEnv) {
      const keys = apiKeysEnv.split(',').map(key => key.trim()).filter(key => key.length > 0);
      keys.forEach(key => {
        if (this.validateApiKey(key)) {
          this.apiKeys.add(key);
        } else {
          this.logger.warn('Invalid API key found in API_KEYS environment variable (ignored)');
        }
      });
      this.logger.log(`Loaded ${this.apiKeys.size} API keys from API_KEYS environment variable`);
    }
    
    // Support legacy single API key
    if (legacyApiKey && this.validateApiKey(legacyApiKey)) {
      this.apiKeys.add(legacyApiKey);
      this.logger.log('Loaded API key from legacy API_KEY environment variable');
    }

    // Development fallback (only in non-production environments)
    if (this.apiKeys.size === 0) {
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv !== 'production') {
        const devApiKey = 'dev-api-key-for-testing';
        this.apiKeys.add(devApiKey);
        this.logger.warn('No API keys configured, using development fallback. DO NOT USE IN PRODUCTION!');
      } else {
        this.logger.error('No API keys configured in production environment!');
        throw new Error('API_KEYS environment variable is required in production');
      }
    }
  }

  /**
   * Validate API key format and security requirements
   */
  private validateApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Remove whitespace
    const trimmedKey = apiKey.trim();

    // Minimum length requirement
    if (trimmedKey.length < 16) {
      this.logger.warn('API key must be at least 16 characters long');
      return false;
    }

    // Maximum length to prevent DoS
    if (trimmedKey.length > 256) {
      this.logger.warn('API key must be less than 256 characters long');
      return false;
    }

    // Basic character validation (alphanumeric, dashes, underscores)
    if (!/^[a-zA-Z0-9\-_]+$/.test(trimmedKey)) {
      this.logger.warn('API key contains invalid characters. Only alphanumeric, dashes, and underscores are allowed');
      return false;
    }

    return true;
  }

  /**
   * Check if the provided API key is valid
   */
  isValidApiKey(apiKey: string): boolean {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    const trimmedKey = apiKey.trim();
    return this.apiKeys.has(trimmedKey);
  }

  /**
   * Get the number of configured API keys (for monitoring/stats)
   */
  getApiKeyCount(): number {
    return this.apiKeys.size;
  }

  /**
   * Add a new API key at runtime (for dynamic key management)
   */
  addApiKey(apiKey: string): boolean {
    if (this.validateApiKey(apiKey)) {
      this.apiKeys.add(apiKey.trim());
      this.logger.log('New API key added successfully');
      return true;
    }
    return false;
  }

  /**
   * Remove an API key at runtime
   */
  removeApiKey(apiKey: string): boolean {
    const removed = this.apiKeys.delete(apiKey.trim());
    if (removed) {
      this.logger.log('API key removed successfully');
    }
    return removed;
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