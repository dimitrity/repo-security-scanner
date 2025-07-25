import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService, SiweVerifyDto } from '../auth.service';

@Injectable()
export class SiweStrategy extends PassportStrategy(Strategy, 'siwe') {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'message',
      passwordField: 'signature',
    });
  }

  async validate(message: string, signature: string): Promise<any> {
    const siweData: SiweVerifyDto = { message, signature };
    
    try {
      const result = await this.authService.authenticateWithSiwe(siweData);
      return result.user;
    } catch (error) {
      throw new UnauthorizedException('Invalid SIWE credentials');
    }
  }
} 