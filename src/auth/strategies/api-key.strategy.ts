import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'apiKey',
    });
  }

  async validate(apiKey: string): Promise<any> {
    try {
      const result = await this.authService.authenticateWithApiKey(apiKey);
      return result.user;
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
} 