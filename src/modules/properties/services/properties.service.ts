import { Injectable } from '@nestjs/common';
import { Prisma, Property, PropertyCategory, PropertyStatus } from '@prisma/client';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import {CreatePropertyDto,UpdatePropertyDto,AuthorizeAgentDto,RespondAuthorizationDto,} from '../dto/property.dto';
import { AssignPropertyStaffDto } from '../dto/assignment.dto';
import { SearchPropertiesDto } from '../dto/search-properties.dto';
import { DomainError } from '@/common/domain/error';
import { PropertyErrorCodes } from '../errors';

const SEARCH_SCAN_LIMIT = 200;
const DEFAULT_RESULT_LIMIT = 24;
const NEARBY_RADIUS_KM = 100;

interface SearchableMetadata {
  location?: string;
  imageUrl?: string;
  type?: string;
  rating?: number;
  bedrooms?: number;
  lat?: number;
  lng?: number;
}

export interface PropertyReview {
  guestName: string;
  guestLocation: string | null;
  rating: number;
  comment: string;
}

interface PropertyMetadata extends SearchableMetadata {
  description?: string;
  images?: string[];
  amenities?: string[];
  bathrooms?: number;
  reviews?: PropertyReview[];
  minNights?: number;
  maxNights?: number;
}

export interface SearchResultItem {
  id: string;
  title: string;
  category: string;
  status: string;
  price: number;
  location: string | null;
  imageUrl: string | null;
  type: string | null;
  rating: number | null;
  bedrooms: number | null;
  distanceKm: number | null;
}

export interface PropertyDetailItem {
  id: string;
  title: string;
  category: PropertyCategory;
  status: PropertyStatus;
  price: number;
  location: string | null;
  imageUrl: string | null;
  images: string[];
  type: string | null;
  rating: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  distanceKm: number | null;
  description: string | null;
  amenities: string[];
  reviews: PropertyReview[];
  minNights: number;
  maxNights: number | null;
  currency: string;
}

@Injectable()
export class PropertiesService extends Service {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createProperty(ownerId: string, dto: CreatePropertyDto) {
    const ownerProfile = await this.prisma.ownerProfile.findUnique({ where: { userId: ownerId } });
    if (!ownerProfile) {
      throw new DomainError(
        PropertyErrorCodes.OWNER_PROFILE_REQUIRED,
        'An active Owner profile is required to create a property.',
      );
    }

    return this.prisma.property.create({
      data: {
        ownerId,
        title: dto.title,
        category: dto.category,
        price: dto.price,
        metadata: this.buildPropertyMetadata(dto),
      },
    });
  }

  async updateProperty(
    ownerId: string,
    propertyId: string,
    dto: UpdatePropertyDto,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });

    if (!property) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found or you do not have permission to update it.',
      );
    }

    return this.prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        metadata: this.mergePropertyMetadata(property.metadata, dto),
      },
    });
  }

  async getPropertyDetails(id: string): Promise<PropertyDetailItem> {
    const property = await this.prisma.property.findUnique({ where: { id } });

    if (!property || property.status === PropertyStatus.DELISTED) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found.',
      );
    }

    const metadata = this.readPropertyMetadata(property.metadata);
    const images =
      metadata.images ??
      (metadata.imageUrl !== undefined ? [metadata.imageUrl] : []);

    return {
      id: property.id,
      title: property.title,
      category: property.category,
      status: property.status,
      price: Number(property.price),
      location: metadata.location ?? null,
      imageUrl: images[0] ?? null,
      images,
      type: metadata.type ?? null,
      rating: metadata.rating ?? null,
      bedrooms: metadata.bedrooms ?? null,
      bathrooms: metadata.bathrooms ?? null,
      distanceKm: null,
      description: metadata.description ?? null,
      amenities: metadata.amenities ?? [],
      reviews: metadata.reviews ?? [],
      minNights: Math.max(1, Math.trunc(metadata.minNights ?? 1)),
      maxNights:
        metadata.maxNights !== undefined
          ? Math.max(1, Math.trunc(metadata.maxNights))
          : null,
      currency: 'NGN',
    };
  }

  async getOwnerPortfolio(ownerId: string) {
    return this.prisma.property.findMany({
      where: { ownerId },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                phone: true,
              },
            },
          },
        },
        authorizations: {
          include: { agent: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async authorizeAgent(ownerId: string, propertyId: string, dto: AuthorizeAgentDto) {
    const property = await this.prisma.property.findFirst({ where: { id: propertyId, ownerId } });
    if (!property) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found or not owned by you.',
      );
    }

    let agentId = dto.agentId;
    if (!agentId && dto.agentEmail) {
      const agentUser = await this.prisma.user.findUnique({ where: { email: dto.agentEmail } });
      if (!agentUser) {
        throw new DomainError(
          PropertyErrorCodes.AGENT_NOT_FOUND,
          'Agent user not found with provided email.',
        );
      }
      agentId = agentUser.id;
    }

    if (!agentId) {
      throw new DomainError(
        PropertyErrorCodes.VALIDATION_FAILED,
        'Must provide either agentId or agentEmail',
      );
    }

    const agentProfile = await this.prisma.agentProfile.findUnique({ where: { userId: agentId } });
    if (!agentProfile) {
      throw new DomainError(
        PropertyErrorCodes.AGENT_PROFILE_REQUIRED,
        'The targeted user does not have an active Agent profile.',
      );
    }

    return this.prisma.agentPropertyAuthorization.create({
      data: {
        propertyId,
        agentId,
        ownerId,
        commissionType: dto.commissionType,
        commissionValue: dto.commissionValue,
        permissions: dto.permissions ?? [],
      }
    });
  }

  async getAgentAssignments(agentId: string) {
    return this.prisma.agentPropertyAuthorization.findMany({
      where: { agentId },
      include: {
        property: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async respondToAuthorization(agentId: string, authId: string, dto: RespondAuthorizationDto) {
    const auth = await this.prisma.agentPropertyAuthorization.findFirst({
      where: { id: authId, agentId }
    });

    if (!auth) {
      throw new DomainError(
        PropertyErrorCodes.AUTHORIZATION_NOT_FOUND,
        'Authorization request not found.',
      );
    }

    if (auth.status !== 'PENDING') {
      throw new DomainError(
        PropertyErrorCodes.INVALID_AUTHORIZATION_STATE,
        'Authorization is not pending.',
      );
    }

    const newStatus = dto.accept ? 'ACTIVE' : 'REJECTED';

    return this.prisma.agentPropertyAuthorization.update({
      where: { id: authId },
      data: { status: newStatus },
    });
  }

  async revokeAuthorization(ownerId: string, authId: string) {
    const auth = await this.prisma.agentPropertyAuthorization.findFirst({
      where: { id: authId, ownerId },
    });

    if (!auth) {
      throw new DomainError(
        PropertyErrorCodes.AUTHORIZATION_NOT_FOUND,
        'Authorization request not found or not yours.',
      );
    }

    return this.prisma.agentPropertyAuthorization.update({
      where: { id: authId },
      data: { status: 'REVOKED', validUntil: new Date() },
    });
  }

  async assignStaff(ownerId: string, propertyId: string, dto: AssignPropertyStaffDto) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });
    if (!property) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found or not owned by you.',
      );
    }

    let targetUserId = dto.userId;
    if (!targetUserId && dto.email) {
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (!user) {
        throw new DomainError(
          PropertyErrorCodes.ASSIGNEE_NOT_FOUND,
          'Assignee user not found with provided email.',
        );
      }
      targetUserId = user.id;
    }
    if (!targetUserId) {
      throw new DomainError(
        PropertyErrorCodes.VALIDATION_FAILED,
        'Must provide either userId or email',
      );
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { agentProfile: true },
    });
    if (!targetUser) {
      throw new DomainError(
        PropertyErrorCodes.ASSIGNEE_NOT_FOUND,
        'Target user not found.',
      );
    }

    if (targetUser.parentId !== ownerId && !targetUser.agentProfile) {
      throw new DomainError(
        PropertyErrorCodes.INVALID_ASSIGNEE,
        'Assignee must be either your sub-account staff or an authorized agent',
      );
    }

    return this.prisma.propertyAssignment.upsert({
      where: {
        propertyId_userId_role: {
          propertyId,
          userId: targetUserId,
          role: dto.role,
        },
      },
      update: {
        permissions: dto.permissions ?? [],
      },
      create: {
        propertyId,
        userId: targetUserId,
        role: dto.role,
        permissions: dto.permissions ?? [],
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            phone: true,
          },
        },
      },
    });
  }

  async unassignStaff(ownerId: string, propertyId: string, assignmentId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });
    if (!property) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found or not owned by you.',
      );
    }

    const assignment = await this.prisma.propertyAssignment.findFirst({
      where: { id: assignmentId, propertyId },
    });
    if (!assignment) {
      throw new DomainError(
        PropertyErrorCodes.ASSIGNMENT_NOT_FOUND,
        'Assignment not found on this property.',
      );
    }

    await this.prisma.propertyAssignment.delete({ where: { id: assignmentId } });
    return { success: true };
  }

  async getPropertyAssignments(ownerId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });
    if (!property) {
      throw new DomainError(
        PropertyErrorCodes.PROPERTY_NOT_FOUND,
        'Property not found or not owned by you.',
      );
    }

    return this.prisma.propertyAssignment.findMany({
      where: { propertyId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStaffAssignments(userId: string) {
    return this.prisma.propertyAssignment.findMany({
      where: { userId },
      include: {
        property: {
          include: {
            owner: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchProperties(dto: SearchPropertiesDto) {
    const where: Prisma.PropertyWhereInput = {
      status: { not: PropertyStatus.DELISTED },
    };

    const categories = this.parseCategories(dto.categories);

    if (categories.length > 0) {
      where.category = { in: categories };
    } else if (dto.category) {
      where.category = dto.category;
    }

    if (dto.minPrice !== undefined || dto.maxPrice !== undefined) {
      where.price = {
        ...(dto.minPrice !== undefined ? { gte: dto.minPrice } : {}),
        ...(dto.maxPrice !== undefined ? { lte: dto.maxPrice } : {}),
      };
    }

    const properties = await this.prisma.property.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: SEARCH_SCAN_LIMIT,
    });

    const matched = properties
      .map((property) => ({
        property,
        metadata: this.readPropertyMetadata(property.metadata),
      }))
      .filter(({ property, metadata }) => this.matchesQuery(property, metadata, dto.q))
      .filter(({ metadata }) => this.matchesType(metadata, dto.type))
      .filter(({ metadata }) => this.matchesRating(metadata, dto.rating))
      .map(({ property, metadata }) => this.toSearchResult(property, metadata, dto));

    const nearby = this.filterNearby(matched, dto.lat, dto.lng);
    const limit = dto.limit ?? DEFAULT_RESULT_LIMIT;

    return {
      total: nearby.length,
      results: nearby.slice(0, limit),
    };
  }

  private matchesQuery(
    property: Property,
    metadata: SearchableMetadata,
    query?: string,
  ): boolean {
    const term = query?.trim().toLowerCase();
    if (!term) {
      return true;
    }

    const haystack = [property.title, metadata.location, metadata.type]
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.toLowerCase());

    return haystack.some((value) => value.includes(term));
  }

  private matchesType(metadata: SearchableMetadata, type?: string): boolean {
    if (!type) {
      return true;
    }
    return metadata.type?.toLowerCase() === type.toLowerCase();
  }

  private parseCategories(value?: string): PropertyCategory[] {
    if (!value) {
      return [];
    }

    const validCategories = new Set<string>(Object.values(PropertyCategory));

    return value
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter((entry): entry is PropertyCategory => validCategories.has(entry));
  }

  private matchesRating(metadata: SearchableMetadata, rating?: number): boolean {
    if (rating === undefined) {
      return true;
    }
    return typeof metadata.rating === 'number' && metadata.rating >= rating;
  }

  private toSearchResult(
    property: Property,
    metadata: SearchableMetadata,
    dto: SearchPropertiesDto,
  ): SearchResultItem {
    return {
      id: property.id,
      title: property.title,
      category: property.category,
      status: property.status,
      price: Number(property.price),
      location: metadata.location ?? null,
      imageUrl: metadata.imageUrl ?? null,
      type: metadata.type ?? null,
      rating: metadata.rating ?? null,
      bedrooms: metadata.bedrooms ?? null,
      distanceKm: this.distanceKm(dto.lat, dto.lng, metadata.lat, metadata.lng),
    };
  }

  private filterNearby(
    results: SearchResultItem[],
    lat?: number,
    lng?: number,
  ): SearchResultItem[] {
    if (lat === undefined || lng === undefined) {
      return results;
    }

    return results
      .filter(
        (result) =>
          result.distanceKm !== null && result.distanceKm <= NEARBY_RADIUS_KM,
      )
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  private distanceKm(
    fromLat?: number,
    fromLng?: number,
    toLat?: number,
    toLng?: number,
  ): number | null {
    if (
      fromLat === undefined ||
      fromLng === undefined ||
      toLat === undefined ||
      toLng === undefined
    ) {
      return null;
    }

    const earthRadiusKm = 6371;
    const deltaLat = this.toRadians(toLat - fromLat);
    const deltaLng = this.toRadians(toLng - fromLng);
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(this.toRadians(fromLat)) *
        Math.cos(this.toRadians(toLat)) *
        Math.sin(deltaLng / 2) ** 2;

    return Math.round(2 * earthRadiusKm * Math.asin(Math.sqrt(a)) * 10) / 10;
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }

  private buildPropertyMetadata(dto: CreatePropertyDto): Prisma.InputJsonObject {
    return {
      ...(dto.metadata ?? {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.images !== undefined ? { images: dto.images } : {}),
      ...(dto.amenities !== undefined ? { amenities: dto.amenities } : {}),
    };
  }

  private mergePropertyMetadata(
    existing: Prisma.JsonValue | null,
    dto: UpdatePropertyDto,
  ): Prisma.InputJsonObject {
    const base: Prisma.InputJsonObject =
      typeof existing === 'object' &&
      existing !== null &&
      !Array.isArray(existing)
        ? (existing as Prisma.InputJsonObject)
        : {};

    return {
      ...base,
      ...(dto.metadata ?? {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.images !== undefined ? { images: dto.images } : {}),
      ...(dto.amenities !== undefined ? { amenities: dto.amenities } : {}),
    };
  }

  private readPropertyMetadata(value: Prisma.JsonValue | null): PropertyMetadata {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    const record = value as Record<string, unknown>;

    return {
      location: this.readString(record['location']),
      imageUrl: this.readString(record['imageUrl']),
      type: this.readString(record['type']),
      rating: this.readNumber(record['rating']),
      bedrooms: this.readNumber(record['bedrooms']),
      lat: this.readNumber(record['lat']),
      lng: this.readNumber(record['lng']),
      description: this.readString(record['description']),
      images: this.readStringArray(record['images']),
      amenities: this.readStringArray(record['amenities']),
      bathrooms: this.readNumber(record['bathrooms']),
      reviews: this.readReviews(record['reviews']),
      minNights: this.readNumber(record['minNights']),
      maxNights: this.readNumber(record['maxNights']),
    };
  }

  private readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() !== '' ? value : undefined;
  }

  private readStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const items = value
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && entry.trim() !== '',
      )
      .map((entry) => entry.trim());

    return items.length > 0 ? items : undefined;
  }

  private readReviews(value: unknown): PropertyReview[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }

    const reviews = value
      .map((entry): PropertyReview | null => {
        if (
          typeof entry !== 'object' ||
          entry === null ||
          Array.isArray(entry)
        ) {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const guestName = this.readString(record['guestName']);
        const comment = this.readString(record['comment']);
        const rating = this.readNumber(record['rating']);

        if (!guestName || !comment || rating === undefined) {
          return null;
        }

        return {
          guestName,
          guestLocation:
            this.readString(record['guestLocation']) ??
            this.readString(record['location']) ??
            null,
          rating,
          comment,
        };
      })
      .filter((review): review is PropertyReview => review !== null);

    return reviews.length > 0 ? reviews : undefined;
  }

  private readNumber(value: unknown): number | undefined {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  }
}
