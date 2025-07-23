import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header('x-api-key');

    // Check if API key is present
    if (!apiKey) {
      this.logger.warn('API key missing from request', {
        ip: request.ip || 'unknown',
        userAgent: request.get('User-Agent') || 'unknown',
        path: request.path
      });
      throw new UnauthorizedException('Missing API key');
    }

    // Validate API key using ConfigService
    if (!this.configService.isValidApiKey(apiKey)) {
      this.logger.warn('Invalid API key attempt', {
        keyPrefix: apiKey.substring(0, 4) + '****', // Log only first 4 chars for security
        ip: request.ip || 'unknown',
        userAgent: request.get('User-Agent') || 'unknown',
        path: request.path
      });
      throw new UnauthorizedException('Invalid API key');
    }

    // Log successful authentication (optional, can be disabled in production)
    if (!this.configService.isProduction()) {
      this.logger.log('API key authentication successful', {
        keyPrefix: apiKey.substring(0, 4) + '****',
        path: request.path
      });
    }

    return true;
  }
} 