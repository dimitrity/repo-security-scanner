import { Controller, Post, Body, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService, AuthResponse, SiweVerifyDto } from './auth.service';

export class ApiKeyAuthDto {
  apiKey: string;
}

export class SiweNonceResponse {
  nonce: string;
  message: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate with API key
   */
  @Post('api-key')
  @HttpCode(HttpStatus.OK)
  async authenticateWithApiKey(@Body() authDto: ApiKeyAuthDto): Promise<AuthResponse> {
    return this.authService.authenticateWithApiKey(authDto.apiKey);
  }

  /**
   * Get SIWE nonce for authentication
   */
  @Post('siwe/nonce')
  @HttpCode(HttpStatus.OK)
  async getSiweNonce(): Promise<SiweNonceResponse> {
    const nonce = this.authService.generateNonce();
    const message = `Sign this message to authenticate with the Repository Security Scanner. Nonce: ${nonce}`;
    
    return {
      nonce,
      message,
    };
  }

  /**
   * Authenticate with SIWE (Sign-In with Ethereum)
   */
  @Post('siwe/verify')
  @HttpCode(HttpStatus.OK)
  async authenticateWithSiwe(@Body() siweData: SiweVerifyDto): Promise<AuthResponse> {
    return this.authService.authenticateWithSiwe(siweData);
  }

  /**
   * Verify JWT token
   */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyToken(@Headers('authorization') authHeader: string): Promise<any> {
    const token = this.authService.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new Error('No token provided');
    }
    
    const payload = await this.authService.verifyToken(token);
    return {
      valid: true,
      user: {
        sub: payload.sub,
        type: payload.type,
        address: payload.address,
      },
    };
  }
} 