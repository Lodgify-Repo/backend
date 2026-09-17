import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { DomainError } from '@/common/domain/error';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;

  const mockPrisma = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: '1', email: 'a@b.com' }]);
      const result = await service.getAllUsers();
      expect(result).toHaveLength(1);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });
      mockPrisma.user.update.mockResolvedValue({ id: '1', isActive: false });

      const result = await service.updateUserStatus('1', { status: 'SUSPENDED' });
      expect(result.isActive).toBe(false);
    });

    it('should throw DomainError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.updateUserStatus('999', { status: 'SUSPENDED' })).rejects.toThrow(DomainError);
    });
  });

  describe('createApiKey', () => {
    it('should create an API key and return it with rawKey', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Test Key',
        tenantId: 'tenant-1',
      });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.createApiKey(
        { name: 'Test Key', tenantId: 'tenant-1' },
        'admin-1',
      );

      expect(result.id).toBe('key-1');
      expect(result.rawKey).toBeDefined();
      expect(result.rawKey.startsWith('ldg_')).toBe(true);
      expect(mockPrisma.apiKey.create).toHaveBeenCalled();
    });
  });

  describe('revokeApiKey', () => {
    it('should deactivate the API key', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', name: 'Test Key' });
      mockPrisma.apiKey.update.mockResolvedValue({ id: 'key-1', isActive: false });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.revokeApiKey('key-1', 'admin-1');
      expect(result.isActive).toBe(false);
    });
  });
});
