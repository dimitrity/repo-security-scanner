import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { SiweMessage } from 'siwe';
import { randomBytes } from 'crypto';

export interface JwtPayload {
  sub: string;
  type: 'api-key' | 'siwe';
  address?: string;
  iat?: number;
  exp?: number;
}

export interface SiweVerifyDto {
  message: string;
  signature: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: {
    address?: string;
    type: 'api-key' | 'siwe';
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticate with API key and return JWT token
   */
  async authenticateWithApiKey(apiKey: string): Promise<AuthResponse> {
    if (!this.configService.isValidApiKey(apiKey)) {
      throw new UnauthorizedException('Invalid API key');
    }

    const payload: JwtPayload = {
      sub: 'api-user',
      type: 'api-key',
    };

    const token = this.jwtService.sign(payload);
    const decoded = this.jwtService.decode(token) as any;

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: decoded.exp - decoded.iat,
      user: {
        type: 'api-key',
      },
    };
  }

  /**
   * Authenticate with SIWE (Sign-In with Ethereum) and return JWT token
   */
  async authenticateWithSiwe(siweData: SiweVerifyDto): Promise<AuthResponse> {
    try {
      // Parse the SIWE message
      const siweMessage = new SiweMessage(JSON.parse(siweData.message));
      
      // Verify the signature
      const fields = await siweMessage.verify({ signature: siweData.signature });
      
      // Extract the Ethereum address from the original message
      const address = siweMessage.address.toLowerCase();
      
      // Create JWT payload
      const payload: JwtPayload = {
        sub: address,
        type: 'siwe',
        address,
      };

      const token = this.jwtService.sign(payload);
      const decoded = this.jwtService.decode(token) as any;

      return {
        access_token: token,
        token_type: 'Bearer',
        expires_in: decoded.exp - decoded.iat,
        user: {
          address,
          type: 'siwe',
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid SIWE signature');
    }
  }

  /**
   * Generate a nonce for SIWE authentication
   */
  generateNonce(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Verify JWT token and return payload
   */
  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string): string | undefined {
    const [type, token] = authHeader?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 