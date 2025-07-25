import { Test, TestingModule } from '@nestjs/testing';
import { AuthController, ApiKeyAuthDto, SiweNonceResponse } from './auth.controller';
import { AuthService, AuthResponse, SiweVerifyDto } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    authenticateWithApiKey: jest.fn(),
    authenticateWithSiwe: jest.fn(),
    generateNonce: jest.fn(),
    verifyToken: jest.fn(),
    extractTokenFromHeader: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('authenticateWithApiKey', () => {
    it('should authenticate with API key and return JWT token', async () => {
      const authDto: ApiKeyAuthDto = {
        apiKey: 'valid-api-key',
      };
      const mockResponse: AuthResponse = {
        access_token: 'jwt-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          type: 'api-key',
        },
      };

      authService.authenticateWithApiKey.mockResolvedValue(mockResponse);

      const result = await controller.authenticateWithApiKey(authDto);

      expect(authService.authenticateWithApiKey).toHaveBeenCalledWith(authDto.apiKey);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getSiweNonce', () => {
    it('should generate nonce and return message', async () => {
      const mockNonce = 'nonce123';
      const mockMessage = 'Sign this message to authenticate with the Repository Security Scanner. Nonce: nonce123';
      const expectedResponse: SiweNonceResponse = {
        nonce: mockNonce,
        message: mockMessage,
      };

      authService.generateNonce.mockReturnValue(mockNonce);

      const result = await controller.getSiweNonce();

      expect(authService.generateNonce).toHaveBeenCalled();
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('authenticateWithSiwe', () => {
    it('should authenticate with SIWE and return JWT token', async () => {
      const siweData: SiweVerifyDto = {
        message: '{"address":"0x123","domain":"localhost","uri":"http://localhost:3000","version":"1","chainId":1,"nonce":"nonce123","issuedAt":"2024-01-01T00:00:00.000Z"}',
        signature: 'signature123',
      };
      const mockResponse: AuthResponse = {
        access_token: 'jwt-token',
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          address: '0x123',
          type: 'siwe',
        },
      };

      authService.authenticateWithSiwe.mockResolvedValue(mockResponse);

      const result = await controller.authenticateWithSiwe(siweData);

      expect(authService.authenticateWithSiwe).toHaveBeenCalledWith(siweData);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('verifyToken', () => {
    it('should verify JWT token and return user info', async () => {
      const authHeader = 'Bearer jwt-token';
      const mockPayload = {
        sub: 'user123',
        type: 'api-key' as const,
        address: undefined,
      };
      const expectedResponse = {
        valid: true,
        user: {
          sub: 'user123',
          type: 'api-key',
          address: undefined,
        },
      };

      authService.extractTokenFromHeader.mockReturnValue('jwt-token');
      authService.verifyToken.mockResolvedValue(mockPayload);

      const result = await controller.verifyToken(authHeader);

      expect(authService.extractTokenFromHeader).toHaveBeenCalledWith(authHeader);
      expect(authService.verifyToken).toHaveBeenCalledWith('jwt-token');
      expect(result).toEqual(expectedResponse);
    });

    it('should throw error when no token provided', async () => {
      const authHeader = 'Invalid jwt-token';

      authService.extractTokenFromHeader.mockReturnValue(undefined);

      await expect(controller.verifyToken(authHeader)).rejects.toThrow('No token provided');
      expect(authService.extractTokenFromHeader).toHaveBeenCalledWith(authHeader);
    });
  });
}); 