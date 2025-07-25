import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '../../config/config.service';
import { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getJwtSecret(),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Validate the payload
    if (!payload.sub || !payload.type) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Additional validation for SIWE tokens
    if (payload.type === 'siwe' && !payload.address) {
      throw new UnauthorizedException('Invalid SIWE token');
    }

    return payload;
  }
} 