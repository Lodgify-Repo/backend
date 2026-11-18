import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PrismaService } from '@/infra/database/prisma.service';
import { JwtStrategy } from './jwt.strategy';

jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));
jest.mock('@/infra/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('JwtStrategy', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
  };
  const configService = {
    get: jest.fn().mockReturnValue('test-secret'),
  } as unknown as ConfigService;
  const strategy = new JwtStrategy(
    configService,
    mockPrisma as unknown as PrismaService,
  );
  const payload = {
    sub: 'user-1',
    email: 'user@test.com',
    role: 'USER' as const,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the current user when the account is active', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      role: 'USER',
      isActive: true,
      deletedAt: null,
    });

    await expect(strategy.validate(payload)).resolves.toEqual({
      id: 'user-1',
      email: 'user@test.com',
      role: 'USER',
    });
  });

  it('rejects a deleted account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@test.com',
      role: 'USER',
      isActive: false,
      deletedAt: new Date(),
    });

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a missing account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
