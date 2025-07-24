import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header('x-api-key');

    // Check if API key is present
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    // Validate API key using ConfigService
    if (!this.configService.isValidApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
} 