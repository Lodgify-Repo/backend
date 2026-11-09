import { Test, TestingModule } from '@nestjs/testing';
import { PropertiesService } from './properties.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { PropertyAssignmentRole, PropertyCategory, PropertyStatus } from '@prisma/client';
import { PropertyErrorCodes } from '../errors';

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
      findUnique: jest.fn(),
      update: jest.fn(),
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
      ).rejects.toMatchObject({
        code: PropertyErrorCodes.OWNER_PROFILE_REQUIRED,
      });
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

    it('should throw DomainError if property not owned by user', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.assignStaff('owner-1', 'prop-1', {
          userId: 'mgr-1',
          role: PropertyAssignmentRole.MANAGER,
        }),
      ).rejects.toMatchObject({
        code: PropertyErrorCodes.PROPERTY_NOT_FOUND,
      });
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

  describe('getPropertyDetails', () => {
    it('should return per-property description, images, amenities and reviews', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        title: 'Metropolitan Haven',
        category: PropertyCategory.HOTEL,
        status: PropertyStatus.AVAILABLE,
        price: 280,
        metadata: {
          location: 'Bali, Indonesia',
          description: 'A serene escape surrounded by rice terraces.',
          images: ['https://example.com/one.jpg', 'https://example.com/two.jpg'],
          amenities: ['2 Bedrooms', 'Wi-Fi', 'City View'],
          bathrooms: 1,
          rating: 4.8,
          minNights: 2,
          maxNights: 14,
          reviews: [
            {
              guestName: 'Emma J.',
              guestLocation: 'Sydney, Australia',
              rating: 5,
              comment: 'A perfect getaway.',
            },
          ],
        },
      });

      const result = await service.getPropertyDetails('prop-1');

      expect(result.title).toBe('Metropolitan Haven');
      expect(result.description).toBe('A serene escape surrounded by rice terraces.');
      expect(result.images).toEqual([
        'https://example.com/one.jpg',
        'https://example.com/two.jpg',
      ]);
      expect(result.amenities).toEqual(['2 Bedrooms', 'Wi-Fi', 'City View']);
      expect(result.reviews).toHaveLength(1);
      expect(result.minNights).toBe(2);
      expect(result.maxNights).toBe(14);
    });

    it('should fall back to the cover image when no gallery is configured', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        id: 'prop-2',
        title: 'Lakeside Cabin',
        category: PropertyCategory.SHORTLET,
        status: PropertyStatus.AVAILABLE,
        price: 150,
        metadata: {
          imageUrl: 'https://example.com/cover.jpg',
        },
      });

      const result = await service.getPropertyDetails('prop-2');

      expect(result.images).toEqual(['https://example.com/cover.jpg']);
      expect(result.imageUrl).toBe('https://example.com/cover.jpg');
      expect(result.description).toBeNull();
      expect(result.reviews).toEqual([]);
    });

    it('should throw DomainError when the property does not exist', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(null);

      await expect(
        service.getPropertyDetails('missing'),
      ).rejects.toMatchObject({
        code: PropertyErrorCodes.PROPERTY_NOT_FOUND,
      });
    });
  });

  describe('updateProperty', () => {
    it('should merge details-page fields into existing metadata', async () => {
      mockPrisma.property.findFirst.mockResolvedValue({
        id: 'prop-1',
        ownerId: 'owner-1',
        metadata: {
          location: 'Lekki Phase 1, Lagos',
          imageUrl: 'https://example.com/cover.jpg',
          type: 'house',
        },
      });
      mockPrisma.property.update.mockResolvedValue({ id: 'prop-1' });

      await service.updateProperty('owner-1', 'prop-1', {
        description: 'A bright family home with a private garden.',
        images: [
          'https://example.com/living-room.jpg',
          'https://example.com/garden.jpg',
        ],
        amenities: ['Wi-Fi', 'Parking', 'Garden'],
      });

      expect(mockPrisma.property.update).toHaveBeenCalledWith({
        where: { id: 'prop-1' },
        data: {
          metadata: {
            location: 'Lekki Phase 1, Lagos',
            imageUrl: 'https://example.com/cover.jpg',
            type: 'house',
            description: 'A bright family home with a private garden.',
            images: [
              'https://example.com/living-room.jpg',
              'https://example.com/garden.jpg',
            ],
            amenities: ['Wi-Fi', 'Parking', 'Garden'],
          },
        },
      });
    });

    it('should reject updates for properties the user does not own', async () => {
      mockPrisma.property.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProperty('owner-1', 'prop-1', { price: 100 }),
      ).rejects.toMatchObject({
        code: PropertyErrorCodes.PROPERTY_NOT_FOUND,
      });
    });
  });
});
