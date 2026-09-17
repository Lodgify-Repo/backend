import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from '../services/admin.service';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: AdminService;

  const mockAdminService = {
    getAllUsers: jest.fn(),
    updateUserStatus: jest.fn(),
    createApiKey: jest.fn(),
    listApiKeys: jest.fn(),
    revokeApiKey: jest.fn(),
    getSystemLogs: jest.fn(),
    clearAuditLogs: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      mockAdminService.getAllUsers.mockResolvedValue([{ id: '1' }]);
      const result = await controller.getAllUsers();
      expect(result).toHaveLength(1);
    });
  });

  describe('createApiKey', () => {
    it('should create an API key', async () => {
      const req = { user: { id: 'admin-1' } };
      const dto = { name: 'New Key', tenantId: 'tenant-1' };
      mockAdminService.createApiKey.mockResolvedValue({ id: 'key-1', rawKey: 'ldg_123' });

      const result = await controller.createApiKey(req, dto);
      expect(result.id).toBe('key-1');
      expect(mockAdminService.createApiKey).toHaveBeenCalledWith(dto, 'admin-1');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke an API key', async () => {
      const req = { user: { id: 'admin-1' } };
      mockAdminService.revokeApiKey.mockResolvedValue({ id: 'key-1', isActive: false });

      const result = await controller.revokeApiKey(req, 'key-1');
      expect(result.isActive).toBe(false);
      expect(mockAdminService.revokeApiKey).toHaveBeenCalledWith('key-1', 'admin-1');
    });
  });
});
