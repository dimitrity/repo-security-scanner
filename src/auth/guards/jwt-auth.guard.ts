import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Check for API key first (backward compatibility)
    const apiKey = request.header('x-api-key');
    if (apiKey) {
      try {
        const result = await this.authService.authenticateWithApiKey(apiKey);
        request.user = result.user;
        return true;
      } catch (error) {
        throw new UnauthorizedException('Invalid API key');
      }
    }

    // Check for JWT token
    const authHeader = request.header('authorization');
    if (authHeader) {
      const token = this.authService.extractTokenFromHeader(authHeader);
      if (token) {
        try {
          const payload = await this.authService.verifyToken(token);
          request.user = {
            sub: payload.sub,
            type: payload.type,
            address: payload.address,
          };
          return true;
        } catch (error) {
          throw new UnauthorizedException('Invalid JWT token');
        }
      }
    }

    // If no valid authentication found, try the default JWT strategy
    return super.canActivate(context) as Promise<boolean>;
  }
} 