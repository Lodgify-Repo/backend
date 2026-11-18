import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { UsersService } from './users.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { EventBusService } from '@/infra/eventbus';
import { DomainError } from '@/common/domain/error';
import { Role } from '@prisma/client';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    subAccountInvitation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    agentProfile: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEvents = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventBusService, useValue: mockEvents },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile if user exists', async () => {
      const user = { id: '1', email: 'test@test.com' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('1');
      expect(result).toEqual(user);
    });

    it('should throw DomainError if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('1')).rejects.toThrow(DomainError);
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const user = { id: '1', email: 'test@test.com' };
      const updatedUser = { ...user, phone: '+2348012345678' };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('1', { phone: '+2348012345678' });
      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe('uploadAvatar', () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);

    it('should store an avatar and replace the previous uploaded file', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        avatarUrl: '/uploads/avatars/old.png',
      });
      mockPrisma.user.update.mockResolvedValue({
        id: '1',
        avatarUrl: '/uploads/avatars/new.png',
      });

      const result = await service.uploadAvatar('1', {
        buffer: pngBuffer,
        mimetype: 'image/png',
        size: pngBuffer.length,
      });

      expect(result.avatarUrl).toBe('/uploads/avatars/new.png');
      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(unlink).toHaveBeenCalledWith(
        expect.stringContaining('old.png'),
      );
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { avatarUrl: expect.stringMatching(/^\/uploads\/avatars\/.+\.png$/) },
        }),
      );
    });

    it('should reject unsupported image types', async () => {
      await expect(
        service.uploadAvatar('1', {
          buffer: pngBuffer,
          mimetype: 'image/svg+xml',
          size: pngBuffer.length,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject files without a valid image signature', async () => {
      await expect(
        service.uploadAvatar('1', {
          buffer: Buffer.from('not-a-real-image'),
          mimetype: 'image/png',
          size: 16,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject avatars larger than 2 MB', async () => {
      await expect(
        service.uploadAvatar('1', {
          buffer: pngBuffer,
          mimetype: 'image/png',
          size: 2 * 1024 * 1024 + 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete user account', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: '1' });

      const result = await service.deleteAccount('1');
      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: false,
            refreshToken: null,
          }),
        }),
      );
    });
  });

  describe('inviteSubAccount', () => {
    it('should create an invitation and emit the invite event with a register link', async () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:4200';

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'parent-1',
          firstName: 'Ada',
          lastName: 'Boss',
          email: 'owner@test.com',
        });
      mockPrisma.subAccountInvitation.create.mockResolvedValue({ id: 'inv-1' });

      const result = await service.inviteSubAccount('parent-1', {
        email: 'staff@test.com',
        role: Role.MANAGER,
      });

      expect(result.id).toBe('inv-1');
      expect(result.link).toContain('http://localhost:4200/register?token=');
      expect(mockPrisma.subAccountInvitation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'staff@test.com',
          role: Role.MANAGER,
          isAgent: false,
        }),
      });
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'user:sub-account-invited',
        expect.objectContaining({
          email: 'staff@test.com',
          role: Role.MANAGER,
          isAgent: false,
          inviterName: 'Ada Boss',
          expiresInDays: 7,
          link: expect.stringContaining(
            'http://localhost:4200/register?token=',
          ),
        }),
      );

      process.env.FRONTEND_URL = originalFrontendUrl;
    });

    it('should link existing users to the accept page', async () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'http://localhost:4200';

      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: '2', email: 'staff@test.com' })
        .mockResolvedValueOnce({
          id: 'parent-1',
          firstName: 'Ada',
          lastName: 'Boss',
          email: 'owner@test.com',
        });
      mockPrisma.subAccountInvitation.create.mockResolvedValue({ id: 'inv-2' });

      await service.inviteSubAccount('parent-1', {
        email: 'staff@test.com',
        role: Role.MANAGER,
      });

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'user:sub-account-invited',
        expect.objectContaining({
          link: expect.stringContaining(
            'http://localhost:4200/invitations/accept?token=',
          ),
        }),
      );

      process.env.FRONTEND_URL = originalFrontendUrl;
    });
  });

  describe('acceptInvitation', () => {
    it('should activate agent access and return a safe profile', async () => {
      const invitation = {
        id: 'inv-1',
        senderId: 'parent-1',
        email: 'staff@test.com',
        role: Role.MANAGER,
        isAgent: true,
        status: 'PENDING',
        token: 'token-1',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const accepted = {
        id: '2',
        email: 'staff@test.com',
        firstName: 'Sam',
        lastName: 'Staff',
        role: Role.MANAGER,
        parentId: 'parent-1',
        isActive: true,
        createdAt: new Date(),
        agentProfile: { id: 'agent-profile-1' },
      };

      mockPrisma.subAccountInvitation.findUnique.mockResolvedValue(invitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '2',
        email: 'staff@test.com',
        agentProfile: null,
      });
      mockPrisma.subAccountInvitation.update.mockResolvedValue(invitation);
      mockPrisma.agentProfile.create.mockResolvedValue({ id: 'agent-profile-1' });
      mockPrisma.user.update.mockResolvedValue(accepted);
      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: typeof mockPrisma) => Promise<unknown>) => callback(mockPrisma),
      );

      const result = await service.acceptInvitation('2', { token: 'token-1' });

      expect(mockPrisma.agentProfile.create).toHaveBeenCalledWith({
        data: { userId: '2' },
      });
      expect(result).toEqual(accepted);
    });
  });

  describe('getSubAccounts', () => {
    it('should return a list of sub-accounts', async () => {
      const subAccounts = [{ id: '2', email: 'sub@test.com' }];
      mockPrisma.user.findMany.mockResolvedValue(subAccounts);

      const result = await service.getSubAccounts('parent-1');
      expect(result).toEqual(subAccounts);
    });
  });

  describe('setSubAccountStatus', () => {
    it('should update sub-account status', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: '2', isActive: false });

      await service.setSubAccountStatus('parent-1', '2', false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '2', parentId: 'parent-1' },
          data: { isActive: false },
        }),
      );
    });
  });

  describe('removeSubAccount', () => {
    it('should remove parentId from sub-account', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: '2', parentId: null });

      const result = await service.removeSubAccount('parent-1', '2');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: '2', parentId: 'parent-1' },
        data: { parentId: null },
      });
    });
  });
});
