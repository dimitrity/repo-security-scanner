import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService, JwtPayload, SiweVerifyDto } from './auth.service';
import { ConfigService } from '../config/config.service';
import { SiweMessage } from 'siwe';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockConfigService = {
    isValidApiKey: jest.fn(),
    getJwtSecret: jest.fn(),
    getJwtExpiration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticateWithApiKey', () => {
    it('should authenticate with valid API key and return JWT token', async () => {
      const apiKey = 'valid-api-key';
      const mockPayload: JwtPayload = {
        sub: 'api-user',
        type: 'api-key',
      };
      const mockToken = 'jwt-token';
      const mockDecoded = {
        iat: 1000,
        exp: 2000,
      };

      configService.isValidApiKey.mockReturnValue(true);
      jwtService.sign.mockReturnValue(mockToken);
      jwtService.decode.mockReturnValue(mockDecoded);

      const result = await service.authenticateWithApiKey(apiKey);

      expect(configService.isValidApiKey).toHaveBeenCalledWith(apiKey);
      expect(jwtService.sign).toHaveBeenCalledWith(mockPayload);
      expect(jwtService.decode).toHaveBeenCalledWith(mockToken);
      expect(result).toEqual({
        access_token: mockToken,
        token_type: 'Bearer',
        expires_in: 1000,
        user: {
          type: 'api-key',
        },
      });
    });

    it('should throw UnauthorizedException for invalid API key', async () => {
      const apiKey = 'invalid-api-key';

      configService.isValidApiKey.mockReturnValue(false);

      await expect(service.authenticateWithApiKey(apiKey)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(configService.isValidApiKey).toHaveBeenCalledWith(apiKey);
    });
  });

  describe('authenticateWithSiwe', () => {
    it('should throw UnauthorizedException for invalid SIWE signature', async () => {
      const mockSiweData: SiweVerifyDto = {
        message: 'invalid-message',
        signature: 'invalid-signature',
      };

      // Mock SiweMessage to throw error
      const originalSiweMessage = global.SiweMessage;
      global.SiweMessage = jest.fn().mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(service.authenticateWithSiwe(mockSiweData)).rejects.toThrow(
        UnauthorizedException,
      );

      // Restore SiweMessage
      global.SiweMessage = originalSiweMessage;
    });
  });

  describe('generateNonce', () => {
    it('should generate a random nonce', () => {
      const nonce1 = service.generateNonce();
      const nonce2 = service.generateNonce();

      expect(nonce1).toBeDefined();
      expect(nonce2).toBeDefined();
      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toMatch(/^[a-f0-9]{64}$/);
      expect(nonce2).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token and return payload', async () => {
      const token = 'valid-token';
      const mockPayload: JwtPayload = {
        sub: 'user123',
        type: 'api-key',
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const result = await service.verifyToken(token);

      expect(jwtService.verify).toHaveBeenCalledWith(token);
      expect(result).toEqual(mockPayload);
    });

    it('should throw UnauthorizedException for invalid JWT token', async () => {
      const token = 'invalid-token';

      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyToken(token)).rejects.toThrow(UnauthorizedException);
      expect(jwtService.verify).toHaveBeenCalledWith(token);
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Authorization header', () => {
      const authHeader = 'Bearer jwt-token';
      const result = service.extractTokenFromHeader(authHeader);
      expect(result).toBe('jwt-token');
    });

    it('should return undefined for invalid Authorization header', () => {
      const authHeader = 'Invalid jwt-token';
      const result = service.extractTokenFromHeader(authHeader);
      expect(result).toBeUndefined();
    });

    it('should return undefined for empty Authorization header', () => {
      const authHeader = '';
      const result = service.extractTokenFromHeader(authHeader);
      expect(result).toBeUndefined();
    });

    it('should return undefined for undefined Authorization header', () => {
      const result = service.extractTokenFromHeader(undefined as any);
      expect(result).toBeUndefined();
    });
  });
}); 