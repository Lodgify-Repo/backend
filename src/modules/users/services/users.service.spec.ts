import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { EventBusService } from '@/infra/eventbus';
import { DomainError } from '@/common/domain/error';
import { Role } from '@prisma/client';

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
    },
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
      const updatedUser = { ...user, firstName: 'Updated' };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('1', { firstName: 'Updated' });
      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('should soft delete user account', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: '1' });

      const result = await service.deleteAccount('1');
      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false }),
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
      expect(mockPrisma.subAccountInvitation.create).toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'user:sub-account-invited',
        expect.objectContaining({
          email: 'staff@test.com',
          role: Role.MANAGER,
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
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: '2', parentId: 'parent-1' },
        data: { isActive: false },
      });
    });
  });

  describe('removeSubAccount', () => {
    it('should remove parentId from sub-account', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: '2', parentId: null });

      await service.removeSubAccount('parent-1', '2');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: '2', parentId: 'parent-1' },
        data: { parentId: null },
      });
    });
  });
});
