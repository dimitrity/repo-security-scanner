import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { Request } from 'express';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let module: TestingModule;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyGuard],
    }).compile();

    guard = moduleFixture.get<ApiKeyGuard>(ApiKeyGuard);
    module = moduleFixture;
  });

  afterEach(async () => {
    await module.close();
  });

  describe('canActivate', () => {
    const validApiKey = 'test-for-arnica-987';

    const createMockContext = (apiKey?: string): ExecutionContext => {
      const request = {
        header: jest.fn().mockReturnValue(apiKey),
      } as unknown as Request;

      return {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext;
    };

    it('should allow access with valid API key', () => {
      const context = createMockContext(validApiKey);
      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny access with invalid API key', () => {
      const context = createMockContext('invalid-key');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
    });

    it('should deny access with missing API key', () => {
      const context = createMockContext(undefined);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
    });

    it('should deny access with empty API key', () => {
      const context = createMockContext('');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
    });

    it('should deny access with null API key', () => {
      const context = createMockContext(null as any);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Invalid or missing API key');
    });

    it('should be case sensitive', () => {
      const context = createMockContext('TEST-FOR-ARNICA-987');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle whitespace in API key', () => {
      const context = createMockContext(' test-for-arnica-987 ');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle partial matches', () => {
      const context = createMockContext('test-for-arnica');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle longer keys', () => {
      const context = createMockContext('test-for-arnica-987-extra');
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should verify the correct header is checked', () => {
      const mockRequest = {
        header: jest.fn().mockReturnValue(validApiKey),
      } as unknown as Request;

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      guard.canActivate(context);
      expect(mockRequest.header).toHaveBeenCalledWith('x-api-key');
    });

    it('should handle multiple calls with same context', () => {
      const context = createMockContext(validApiKey);
      
      // First call should succeed
      expect(guard.canActivate(context)).toBe(true);
      
      // Second call should also succeed
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should handle multiple calls with different contexts', () => {
      const validContext = createMockContext(validApiKey);
      const invalidContext = createMockContext('invalid-key');
      
      // Valid context should succeed
      expect(guard.canActivate(validContext)).toBe(true);
      
      // Invalid context should fail
      expect(() => guard.canActivate(invalidContext)).toThrow(UnauthorizedException);
    });
  });

  describe('API key configuration', () => {
    it('should use the correct hardcoded API key', () => {
      // This test verifies the API key is set to the expected value
      // In a real application, this would come from environment variables
      const guardInstance = new ApiKeyGuard();
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            header: jest.fn().mockReturnValue('test-for-arnica-987'),
          }),
        }),
      } as ExecutionContext;

      expect(guardInstance.canActivate(context)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw UnauthorizedException with correct message', () => {
      const context = createMockContext('wrong-key');
      
      try {
        guard.canActivate(context);
        fail('Expected UnauthorizedException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid or missing API key');
      }
    });

    it('should handle request object without header method', () => {
      const mockRequest = {} as Request;
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  // Helper function for creating mock context
  const createMockContext = (apiKey?: string): ExecutionContext => {
    const request = {
      header: jest.fn().mockReturnValue(apiKey),
    } as unknown as Request;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };
}); 