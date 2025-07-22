import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly apiKey = 'test-for-arnica-987';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header('x-api-key');
    if (apiKey !== this.apiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }
    return true;
  }
} 