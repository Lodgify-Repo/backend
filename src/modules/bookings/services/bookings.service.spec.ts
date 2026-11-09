import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  PropertyCategory,
  PropertyStatus,
} from '@prisma/client';
import { PrismaService } from '@/infra/database/prisma.service';
import { BookingsService } from './bookings.service';
import { BookingErrorCodes } from '../errors';

describe('BookingsService', () => {
  let service: BookingsService;

  const mockPrisma = {
    property: {
      findUnique: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const propertyRecord = {
    id: 'prop-1',
    ownerId: 'owner-1',
    title: 'Metropolitan Haven',
    category: PropertyCategory.HOTEL,
    status: PropertyStatus.AVAILABLE,
    price: 280,
    metadata: {
      location: 'Bali, Indonesia',
      imageUrl: 'https://example.com/cover.jpg',
    },
  };

  const createdBooking = {
    id: 'booking-1',
    propertyId: 'prop-1',
    guestId: 'guest-1',
    checkInDate: new Date(`${futureDate}T00:00:00.000Z`),
    checkOutDate: new Date(`${futureDate}T00:00:00.000Z`),
    nights: 2,
    guests: 2,
    totalAmount: 560,
    status: BookingStatus.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    property: propertyRecord,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBooking', () => {
    it('creates a booking and calculates the total for nightly stays', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(propertyRecord);
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      mockPrisma.booking.create.mockResolvedValue(createdBooking);

      const result = await service.createBooking('guest-1', 'prop-1', {
        checkInDate: futureDate,
        nights: 2,
        guests: 2,
      });

      expect(result.totalAmount).toBe(560);
      expect(result.status).toBe(BookingStatus.PENDING);
      expect(result.property.location).toBe('Bali, Indonesia');
      expect(mockPrisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            propertyId: 'prop-1',
            guestId: 'guest-1',
            nights: 2,
            guests: 2,
            totalAmount: 560,
          }),
        }),
      );
    });

    it('rejects bookings that overlap an active booking', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(propertyRecord);
      mockPrisma.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

      await expect(
        service.createBooking('guest-1', 'prop-1', {
          checkInDate: futureDate,
          nights: 2,
        }),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.BOOKING_CONFLICT,
      });

      expect(mockPrisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects bookings with a past check-in date', async () => {
      mockPrisma.property.findUnique.mockResolvedValue(propertyRecord);

      await expect(
        service.createBooking('guest-1', 'prop-1', {
          checkInDate: '2000-01-01',
          nights: 1,
        }),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.CHECK_IN_IN_PAST,
      });

      expect(mockPrisma.booking.create).not.toHaveBeenCalled();
    });

    it('rejects bookings for delisted properties', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        ...propertyRecord,
        status: PropertyStatus.DELISTED,
      });

      await expect(
        service.createBooking('guest-1', 'prop-1', {
          checkInDate: futureDate,
          nights: 1,
        }),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.PROPERTY_NOT_AVAILABLE,
      });
    });

    it('enforces the property minimum stay', async () => {
      mockPrisma.property.findUnique.mockResolvedValue({
        ...propertyRecord,
        metadata: {
          ...propertyRecord.metadata,
          minNights: 2,
        },
      });

      await expect(
        service.createBooking('guest-1', 'prop-1', {
          checkInDate: futureDate,
          nights: 1,
        }),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.MINIMUM_STAY_NOT_MET,
      });
    });
  });

  describe('getBooking', () => {
    it('returns a booking to the guest', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(createdBooking);

      const result = await service.getBooking('guest-1', 'booking-1');

      expect(result.id).toBe('booking-1');
    });

    it('returns a booking to the property owner', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(createdBooking);

      const result = await service.getBooking('owner-1', 'booking-1');

      expect(result.id).toBe('booking-1');
    });

    it('forbids unrelated users from reading a booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(createdBooking);

      await expect(
        service.getBooking('intruder-1', 'booking-1'),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.BOOKING_ACCESS_DENIED,
      });
    });

    it('throws when the booking does not exist', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await expect(
        service.getBooking('guest-1', 'missing'),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.BOOKING_NOT_FOUND,
      });
    });
  });

  describe('cancelBooking', () => {
    it('cancels a pending booking for the guest', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(createdBooking);
      mockPrisma.booking.update.mockResolvedValue({
        ...createdBooking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.cancelBooking('guest-1', 'booking-1');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(mockPrisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'booking-1' },
          data: { status: BookingStatus.CANCELLED },
        }),
      );
    });

    it('rejects cancelling a completed booking', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...createdBooking,
        status: BookingStatus.COMPLETED,
      });

      await expect(
        service.cancelBooking('guest-1', 'booking-1'),
      ).rejects.toMatchObject({
        code: BookingErrorCodes.BOOKING_NOT_CANCELLABLE,
      });
    });
  });
});
