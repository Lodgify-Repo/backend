import { Injectable } from '@nestjs/common';
import {BookingStatus,Prisma,PropertyCategory,PropertyStatus,} from '@prisma/client';
import { PrismaService } from '@/infra/database/prisma.service';
import { DomainError } from '@/common/domain/error';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { BookingErrorCodes } from '../errors';

const NIGHTLY_CATEGORIES: readonly PropertyCategory[] = [
  PropertyCategory.HOTEL,
  PropertyCategory.SHORTLET,
];

const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];

const BOOKING_PROPERTY_SELECT = {
  id: true,
  ownerId: true,
  title: true,
  category: true,
  status: true,
  price: true,
  metadata: true,
} satisfies Prisma.PropertySelect;

type BookingWithProperty = Prisma.BookingGetPayload<{
  include: { property: { select: typeof BOOKING_PROPERTY_SELECT } };
}>;

interface PropertyLocationMetadata {
  location?: string;
  imageUrl?: string;
  minNights?: number;
  maxNights?: number;
}

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createBooking(
    guestId: string,
    propertyId: string,
    dto: CreateBookingDto,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_PROPERTY_NOT_FOUND,
        'Property not found.',
      );
    }

    if (
      property.status === PropertyStatus.DELISTED ||
      property.status === PropertyStatus.SOLD
    ) {
      throw new DomainError(
        BookingErrorCodes.PROPERTY_NOT_AVAILABLE,
        'This property is not available for booking.',
      );
    }

    const propertyMetadata = this.readLocationMetadata(property.metadata);
    const minNights = Math.max(1, propertyMetadata.minNights ?? 1);
    const maxNights = propertyMetadata.maxNights;

    if (dto.nights < minNights) {
      throw new DomainError(
        BookingErrorCodes.MINIMUM_STAY_NOT_MET,
        `The minimum stay for this property is ${minNights} night${minNights === 1 ? '' : 's'}.`,
      );
    }

    if (maxNights !== undefined && dto.nights > maxNights) {
      throw new DomainError(
        BookingErrorCodes.MAXIMUM_STAY_EXCEEDED,
        `The maximum stay for this property is ${maxNights} night${maxNights === 1 ? '' : 's'}.`,
      );
    }

    const checkInDate = this.parseCheckInDate(dto.checkInDate);
    const checkOutDate = this.addDays(checkInDate, dto.nights);

    const conflictingBooking = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: [...ACTIVE_BOOKING_STATUSES] },
        checkInDate: { lt: checkOutDate },
        checkOutDate: { gt: checkInDate },
      },
      select: { id: true },
    });

    if (conflictingBooking) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_CONFLICT,
        'This property is already booked for the selected dates.',
      );
    }

    const isNightly = NIGHTLY_CATEGORIES.includes(property.category);
    const totalAmount =
      Number(property.price) * (isNightly ? dto.nights : 1);

    const booking = await this.prisma.booking.create({
      data: {
        propertyId,
        guestId,
        checkInDate,
        checkOutDate,
        nights: dto.nights,
        guests: dto.guests ?? 1,
        totalAmount,
      },
      include: {
        property: { select: BOOKING_PROPERTY_SELECT },
      },
    });

    return this.toBookingResponse(booking);
  }

  async getMyBookings(guestId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { guestId },
      include: {
        property: { select: BOOKING_PROPERTY_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((booking) => this.toBookingResponse(booking));
  }

  async getBooking(userId: string, bookingId: string) {
    const booking = await this.findBookingOrThrow(bookingId);

    if (
      booking.guestId !== userId &&
      booking.property.ownerId !== userId
    ) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_ACCESS_DENIED,
        'You do not have access to this booking.',
      );
    }

    return this.toBookingResponse(booking);
  }

  async cancelBooking(userId: string, bookingId: string) {
    const booking = await this.findBookingOrThrow(bookingId);

    const isGuest = booking.guestId === userId;
    const isPropertyOwner = booking.property.ownerId === userId;

    if (!isGuest && !isPropertyOwner) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_ACCESS_DENIED,
        'You do not have access to this booking.',
      );
    }

    if (
      booking.status !== BookingStatus.PENDING &&
      booking.status !== BookingStatus.CONFIRMED
    ) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_NOT_CANCELLABLE,
        'Only pending or confirmed bookings can be cancelled.',
      );
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
      include: {
        property: { select: BOOKING_PROPERTY_SELECT },
      },
    });

    return this.toBookingResponse(updated);
  }

  private async findBookingOrThrow(
    bookingId: string,
  ): Promise<BookingWithProperty> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: BOOKING_PROPERTY_SELECT },
      },
    });

    if (!booking) {
      throw new DomainError(
        BookingErrorCodes.BOOKING_NOT_FOUND,
        'Booking not found.',
      );
    }

    return booking;
  }

  private toBookingResponse(booking: BookingWithProperty) {
    const metadata = this.readLocationMetadata(booking.property.metadata);

    return {
      id: booking.id,
      propertyId: booking.propertyId,
      guestId: booking.guestId,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      nights: booking.nights,
      guests: booking.guests,
      totalAmount: Number(booking.totalAmount),
      status: booking.status,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      property: {
        id: booking.property.id,
        title: booking.property.title,
        category: booking.property.category,
        status: booking.property.status,
        price: Number(booking.property.price),
        location: metadata.location ?? null,
        imageUrl: metadata.imageUrl ?? null,
      },
    };
  }

  private readLocationMetadata(
    value: Prisma.JsonValue | null,
  ): PropertyLocationMetadata {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;

    return {
      location:
        typeof record['location'] === 'string'
          ? record['location']
          : undefined,
      imageUrl:
        typeof record['imageUrl'] === 'string'
          ? record['imageUrl']
          : undefined,
      minNights:
        typeof record['minNights'] === 'number'
          ? record['minNights']
          : undefined,
      maxNights:
        typeof record['maxNights'] === 'number'
          ? record['maxNights']
          : undefined,
    };
  }

  private parseCheckInDate(value: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new DomainError(
        BookingErrorCodes.INVALID_CHECK_IN_DATE,
        'Invalid check-in date.',
      );
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (date < startOfToday) {
      throw new DomainError(
        BookingErrorCodes.CHECK_IN_IN_PAST,
        'Check-in date cannot be in the past.',
      );
    }

    return date;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }
}
