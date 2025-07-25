import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '../../config/config.service';
import { JwtPayload } from '../auth.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: jest.Mocked<ConfigService>;

  const mockConfigService = {
    getJwtSecret: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    configService = module.get(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should validate API key payload successfully', async () => {
      const payload: JwtPayload = {
        sub: 'api-user',
        type: 'api-key',
        iat: 1000,
        exp: 2000,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual(payload);
    });

    it('should validate SIWE payload successfully', async () => {
      const payload: JwtPayload = {
        sub: '0x1234567890123456789012345678901234567890',
        type: 'siwe',
        address: '0x1234567890123456789012345678901234567890',
        iat: 1000,
        exp: 2000,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException for payload without sub', async () => {
      const payload: any = {
        type: 'api-key',
        iat: 1000,
        exp: 2000,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for payload without type', async () => {
      const payload: any = {
        sub: 'api-user',
        iat: 1000,
        exp: 2000,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for SIWE payload without address', async () => {
      const payload: any = {
        sub: '0x1234567890123456789012345678901234567890',
        type: 'siwe',
        iat: 1000,
        exp: 2000,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
}); 