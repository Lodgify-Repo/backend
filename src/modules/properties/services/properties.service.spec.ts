import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService } from './properties.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { PropertyAssignmentRole, PropertyCategory } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { DomainError } from '@/common/domain/error';

describe('PropertiesService', () => {
  let service: PropertiesService;

  const mockPrisma = {
    ownerProfile: {
      findUnique: jest.fn(),
    },
    agentProfile: {
      findUnique: jest.fn(),
    },
    property: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    propertyAssignment: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    agentPropertyAuthorization: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProperty', () => {
    it('should create property when owner profile exists', async () => {
      mockPrisma.ownerProfile.findUnique.mockResolvedValue({ id: 'owner-prof-1' });
      mockPrisma.property.create.mockResolvedValue({ id: 'prop-1', title: 'Hotel Grand' });

      const result = await service.createProperty('owner-1', {
        title: 'Hotel Grand',
        category: PropertyCategory.HOTEL,
        price: 500,
      });

      expect(result.id).toBe('prop-1');
      expect(mockPrisma.property.create).toHaveBeenCalled();
    });

    it('should throw DomainError when owner profile does not exist', async () => {
      mockPrisma.ownerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.createProperty('owner-1', {
          title: 'Hotel Grand',
          category: PropertyCategory.HOTEL,
          price: 500,
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('assignStaff', () => {
    it('should assign a branch manager to a property', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'mgr-1',
        email: 'mgr@hotel.com',
        parentId: 'owner-1',
      });
      mockPrisma.propertyAssignment.upsert.mockResolvedValue({
        id: 'assign-1',
        propertyId: 'prop-1',
        userId: 'mgr-1',
        role: PropertyAssignmentRole.MANAGER,
      });

      const result = await service.assignStaff('owner-1', 'prop-1', {
        userId: 'mgr-1',
        role: PropertyAssignmentRole.MANAGER,
        permissions: ['MANAGE_OPERATIONS'],
      });

      expect(result.id).toBe('assign-1');
      expect(mockPrisma.propertyAssignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            propertyId_userId_role: {
              propertyId: 'prop-1',
              userId: 'mgr-1',
              role: PropertyAssignmentRole.MANAGER,
            },
          },
        }),
      );
    });

    it('should assign an authorized agent to the same property', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'agent-1',
        email: 'agent@broker.com',
        agentProfile: { id: 'ap-1' },
      });
      mockPrisma.propertyAssignment.upsert.mockResolvedValue({
        id: 'assign-2',
        propertyId: 'prop-1',
        userId: 'agent-1',
        role: PropertyAssignmentRole.AGENT,
      });

      const result = await service.assignStaff('owner-1', 'prop-1', {
        email: 'agent@broker.com',
        role: PropertyAssignmentRole.AGENT,
      });

      expect(result.id).toBe('assign-2');
    });

    it('should throw NotFoundException if property not owned by user', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.assignStaff('owner-1', 'prop-1', {
          userId: 'mgr-1',
          role: PropertyAssignmentRole.MANAGER,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unassignStaff', () => {
    it('should delete assignment when owned by user', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({ id: 'prop-1', ownerId: 'owner-1' });
      mockPrisma.propertyAssignment.findFirst.mockResolvedValue({ id: 'assign-1' });
      mockPrisma.propertyAssignment.delete.mockResolvedValue({ id: 'assign-1' });

      const result = await service.unassignStaff('owner-1', 'prop-1', 'assign-1');
      expect(result.success).toBe(true);
      expect(mockPrisma.propertyAssignment.delete).toHaveBeenCalledWith({ where: { id: 'assign-1' } });
    });
  });

  describe('getStaffAssignments', () => {
    it('should return properties assigned to a manager or agent', async () => {
      mockPrisma.propertyAssignment.findMany.mockResolvedValue([
        { id: 'assign-1', property: { id: 'prop-1', title: 'Hotel Grand' } },
      ]);

      const result = await service.getStaffAssignments('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].property.title).toBe('Hotel Grand');
    });
  });
});
