import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { Role } from '@prisma/client';

import { PrismaService } from '@/infra/database/prisma.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
    inviteSubAccount: jest.fn(),
    getSubAccounts: jest.fn(),
    setSubAccountStatus: jest.fn(),
    removeSubAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const req = { user: { id: '1' } };
      mockUsersService.getProfile.mockResolvedValue({ id: '1', email: 'test@test.com' });

      const result = await controller.getProfile(req);
      expect(result.id).toBe('1');
    });
  });

  describe('updateProfile', () => {
    it('should update and return user profile', async () => {
      const req = { user: { id: '1' } };
      const dto = { firstName: 'Updated' };
      mockUsersService.updateProfile.mockResolvedValue({ id: '1', ...dto });

      const result = await controller.updateProfile(req, dto);
      expect(result.firstName).toBe('Updated');
    });
  });

  describe('deleteAccount', () => {
    it('should call usersService.deleteAccount', async () => {
      const req = { user: { id: '1' } };
      mockUsersService.deleteAccount.mockResolvedValue({ success: true });

      const result = await controller.deleteAccount(req);
      expect(result).toEqual({ success: true });
    });
  });

  describe('inviteSubAccount', () => {
    it('should call usersService.inviteSubAccount', async () => {
      const req = { user: { id: 'parent-1' } };
      const dto = { email: 'staff@test.com', role: Role.MANAGER };
      mockUsersService.inviteSubAccount.mockResolvedValue({ id: 'inv-1' });

      const result = await controller.inviteSubAccount(req, dto);
      expect(result.id).toBe('inv-1');
    });
  });

  describe('getSubAccounts', () => {
    it('should return list of sub-accounts', async () => {
      const req = { user: { id: 'parent-1' } };
      mockUsersService.getSubAccounts.mockResolvedValue([{ id: '2' }]);

      const result = await controller.getSubAccounts(req);
      expect(result).toHaveLength(1);
    });
  });

  describe('setSubAccountStatus', () => {
    it('should update status', async () => {
      const req = { user: { id: 'parent-1' } };
      mockUsersService.setSubAccountStatus.mockResolvedValue({ id: '2', isActive: false });

      const result = await controller.setSubAccountStatus(req, '2', false);
      expect(result.isActive).toBe(false);
    });
  });

  describe('removeSubAccount', () => {
    it('should remove sub-account', async () => {
      const req = { user: { id: 'parent-1' } };
      mockUsersService.removeSubAccount.mockResolvedValue({ id: '2', parentId: null });

      const result = await controller.removeSubAccount(req, '2');
      expect(result.parentId).toBeNull();
    });
  });
});
