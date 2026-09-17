import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    googleLogin: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      const dto = { email: 'test@test.com', password: 'password1', firstName: 'John', lastName: 'Doe' };
      mockAuthService.register.mockResolvedValue({ id: '1', email: dto.email });

      const result = await controller.register(dto as any);
      expect(result).toBeDefined();
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should return access token and user', async () => {
      const req = { user: { id: '1', email: 'test@test.com' } };
      const res = { cookie: jest.fn() } as unknown as Response;
      
      mockAuthService.login.mockResolvedValue({
        access_token: 'token',
        refresh_token: 'refresh',
        user: req.user,
      });

      const result = await controller.login(req, res);
      
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', 'refresh', expect.any(Object));
      expect(result).toEqual({ access_token: 'token', user: req.user });
    });
  });

  describe('refresh', () => {
    it('should return new access token when refresh token is valid', async () => {
      const req = { cookies: { refresh_token: 'valid-refresh' } };
      const res = { cookie: jest.fn() } as unknown as Response;

      mockAuthService.refreshToken.mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: { id: '1' },
      });

      const result = await controller.refresh(req, res);

      expect(res.cookie).toHaveBeenCalled();
      expect(result.access_token).toBe('new-access-token');
    });

    it('should throw UnauthorizedException if refresh token is missing', async () => {
      const req = { cookies: {} };
      const res = { cookie: jest.fn() } as unknown as Response;

      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('should return success message', async () => {
      mockAuthService.forgotPassword.mockResolvedValue(undefined);
      
      const result = await controller.forgotPassword({ email: 'test@test.com' });
      expect(result.message).toContain('reset link has been sent');
    });
  });
});
