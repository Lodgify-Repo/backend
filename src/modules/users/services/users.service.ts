import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { EventBusService } from '@/infra/eventbus';
import {USER_INVITATION_SENT,type SubAccountInvited,} from '@/common/events/user.events';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import {InviteSubAccountDto,AcceptSubAccountDto,} from '../dto/sub-account.dto';
import {CompleteOnboardingDto,ActivateOwnerProfileDto,ActivateAgentProfileDto,} from '../dto/onboarding.dto';
import {UserCapabilities,AccountPersona,} from '@/common/domain/user-capability.types';
import * as crypto from 'crypto';
import { DomainError } from '@/common/domain/error';
import { UserErrorCodes } from '../errors';
import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_EXTENSIONS,
  CLOUDINARY_AVATAR_FOLDER,
} from '../avatar.constants';
import { User, Role } from '@prisma/client';

export interface UploadedAvatarFile {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly size: number;
}

export type UserProfile = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'phone'
  | 'avatarUrl'
  | 'isActive'
  | 'createdAt'
>;

const INVITATION_TTL_DAYS = 7;

function formatInviterName(
  inviter: Pick<User, 'firstName' | 'lastName' | 'email'> | null,
): string {
  const fullName = inviter
    ? `${inviter.firstName} ${inviter.lastName}`.trim()
    : '';

  return fullName || inviter?.email || 'Your administrator';
}

function hasAvatarSignature(buffer: Buffer, mimetype: string): boolean {
  if (buffer.length < 12) {
    return false;
  }

  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimetype === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }

  return false;
}

@Injectable()
export class UsersService extends Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {
    super();
  }

  async getUserCapabilities(userId: string): Promise<UserCapabilities> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { ownerProfile: true, agentProfile: true },
    });

    if (!user) {
      throw new DomainError(UserErrorCodes.USER_NOT_FOUND);
    }

    const activePersonas: AccountPersona[] = ['CUSTOMER'];
    const isOwner = !!user.ownerProfile;
    const isAgent = !!user.agentProfile;

    if (isOwner) activePersonas.push('OWNER');
    if (isAgent) activePersonas.push('AGENT');

    return {
      isCustomer: true,
      isOwner,
      isAgent,
      activePersonas,
    };
  }

  async completeOnboarding(userId: string, dto: CompleteOnboardingDto) {
    const capabilities = await this.getUserCapabilities(userId);

    if (dto.intent === 'OWNER' && !capabilities.isOwner) {
      await this.activateOwnerProfile(userId, {});
    } else if (dto.intent === 'AGENT' && !capabilities.isAgent) {
      throw new DomainError(
        UserErrorCodes.INVALID_PROFILE_DATA,
        'Agent profile requires explicit details via agent activation endpoint',
      );
    }

    return this.getUserCapabilities(userId);
  }

  async activateOwnerProfile(userId: string, dto: ActivateOwnerProfileDto) {
    const existingProfile = await this.prisma.ownerProfile.findUnique({
      where: { userId },
    });
    if (existingProfile) {
      throw new DomainError(
        UserErrorCodes.PROFILE_ALREADY_EXISTS,
        'Owner profile already activated',
      );
    }

    await this.prisma.ownerProfile.create({
      data: {
        userId,
        businessName: dto.businessName,
      },
    });

    return this.getUserCapabilities(userId);
  }

  async activateAgentProfile(userId: string, dto: ActivateAgentProfileDto) {
    const existingProfile = await this.prisma.agentProfile.findUnique({
      where: { userId },
    });
    if (existingProfile) {
      throw new DomainError(
        UserErrorCodes.PROFILE_ALREADY_EXISTS,
        'Agent profile already activated',
      );
    }

    await this.prisma.agentProfile.create({
      data: {
        userId,
        agencyType: dto.agencyType,
        organizationName: dto.organizationName,
        licenseNumber: dto.licenseNumber,
        defaultCommissionRate: dto.defaultCommissionRate,
      },
    });

    return this.getUserCapabilities(userId);
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new DomainError(UserErrorCodes.USER_NOT_FOUND);
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new DomainError(UserErrorCodes.USER_NOT_FOUND);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (dto.avatarUrl === null) {
      await this.removeCloudinaryAvatar(user.avatarUrl);
    }

    return updated;
  }

  async uploadAvatar(userId: string, file: UploadedAvatarFile) {
    if (!AVATAR_MIME_EXTENSIONS[file.mimetype]) {
      throw new BadRequestException(
        'Avatar must be a PNG, JPEG, or WebP image.',
      );
    }

    if (
      !file.buffer ||
      file.buffer.length === 0 ||
      file.size > AVATAR_MAX_BYTES
    ) {
      throw new BadRequestException(
        'Avatar must be a non-empty image no larger than 2 MB.',
      );
    }

    if (!hasAvatarSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('The uploaded file is not a valid image.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      throw new DomainError(UserErrorCodes.USER_NOT_FOUND);
    }

    const upload = await this.uploadToCloudinary(file);

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarUrl: upload.secure_url },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await this.removeCloudinaryAvatar(user.avatarUrl);

      return updated;
    } catch (error) {
      await this.destroyCloudinaryImage(upload.public_id);
      throw error;
    }
  }

  private async uploadToCloudinary(
    file: UploadedAvatarFile,
  ): Promise<UploadApiResponse> {
    this.configureCloudinary();

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: CLOUDINARY_AVATAR_FOLDER,
          public_id: crypto.randomUUID(),
          resource_type: 'image',
          overwrite: false,
          transformation: [
            {
              width: 512,
              height: 512,
              crop: 'fill',
              gravity: 'face',
              quality: 'auto',
              fetch_format: 'auto',
            },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(
              error ??
                new InternalServerErrorException(
                  'Cloudinary did not return an uploaded image.',
                ),
            );
            return;
          }

          resolve(result);
        },
      );

      stream.end(file.buffer);
    });
  }

  private async removeCloudinaryAvatar(avatarUrl: string | null): Promise<void> {
    const publicId = this.extractCloudinaryPublicId(avatarUrl);

    if (publicId) {
      await this.destroyCloudinaryImage(publicId);
    }
  }

  private async destroyCloudinaryImage(publicId: string): Promise<void> {
    try {
      this.configureCloudinary();
      await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
    } catch {
      return;
    }
  }

  private extractCloudinaryPublicId(avatarUrl: string | null): string | null {
    if (!avatarUrl || !avatarUrl.includes('res.cloudinary.com')) {
      return null;
    }

    const uploadMarker = '/upload/';
    const uploadIndex = avatarUrl.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    const uploadedPath = avatarUrl.slice(uploadIndex + uploadMarker.length);
    const versionMatch = uploadedPath.match(/v\d+\/(.+)$/);

    if (!versionMatch) {
      return null;
    }

    return versionMatch[1].replace(/\.[^/.]+$/, '');
  }

  private configureCloudinary(): void {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new InternalServerErrorException(
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  }

  async deleteAccount(userId: string): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false, refreshToken: null },
    });

    return { success: true };
  }

  async inviteSubAccount(parentId: string, dto: InviteSubAccountDto) {
    if (dto.role !== Role.MANAGER && dto.role !== Role.USER) {
      throw new DomainError(
        UserErrorCodes.INVALID_PROFILE_DATA,
        'Owners cannot invite administrator sub-accounts',
      );
    }

    const [existingUser, inviter] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      this.prisma.user.findUnique({
        where: { id: parentId },
        select: { firstName: true, lastName: true, email: true },
      }),
    ]);

    const token = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.prisma.subAccountInvitation.create({
      data: {
        senderId: parentId,
        email: dto.email,
        role: dto.role,
        isAgent: dto.isAgent ?? false,
        token,
        expiresAt,
      },
    });

    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:4200'
    ).replace(/\/+$/, '');

    const link = existingUser
      ? `${frontendUrl}/invitations/accept?token=${token}`
      : `${frontendUrl}/register?token=${token}`;

    this.events.emit(USER_INVITATION_SENT, {
      event: USER_INVITATION_SENT,
      email: dto.email,
      role: dto.role,
      isAgent: dto.isAgent ?? false,
      link,
      inviterName: formatInviterName(inviter),
      expiresInDays: INVITATION_TTL_DAYS,
    } satisfies SubAccountInvited);

    return { ...invitation, link };
  }

  async acceptInvitation(userId: string, dto: AcceptSubAccountDto) {
    const invitation = await this.prisma.subAccountInvitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation) {
      throw new DomainError(
        UserErrorCodes.RESOURCE_NOT_FOUND,
        'Invitation not found or invalid token',
      );
    }

    if (invitation.status !== 'PENDING') {
      throw new DomainError(
        UserErrorCodes.VALIDATION_FAILED,
        'Invitation is no longer pending',
      );
    }

    if (new Date() > invitation.expiresAt) {
      throw new DomainError(
        UserErrorCodes.VALIDATION_FAILED,
        'Invitation has expired',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { agentProfile: true },
    });

    if (!user || user.email !== invitation.email) {
      throw new DomainError(
        UserErrorCodes.UNAUTHORIZED,
        'Invitation email does not match your account',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.subAccountInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      if (invitation.isAgent && !user.agentProfile) {
        await tx.agentProfile.create({
          data: { userId },
        });
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          parentId: invitation.senderId,
          role: invitation.role,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          parentId: true,
          isActive: true,
          createdAt: true,
          agentProfile: {
            select: {
              id: true,
              agencyType: true,
              organizationName: true,
              isVerified: true,
            },
          },
        },
      });
    });
  }

  async getSubAccounts(parentId: string) {
    return this.prisma.user.findMany({
      where: { parentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        agentProfile: {
          select: {
            id: true,
            agencyType: true,
            organizationName: true,
            isVerified: true,
          },
        },
        propertyAssignments: {
          include: {
            property: {
              select: {
                id: true,
                title: true,
                category: true,
                status: true,
                price: true,
              },
            },
          },
        },
      },
    });
  }

  async setSubAccountStatus(
    parentId: string,
    subAccountId: string,
    isActive: boolean,
  ) {
    return this.prisma.user.update({
      where: { id: subAccountId, parentId },
      data: { isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        parentId: true,
        isActive: true,
        createdAt: true,
        agentProfile: {
          select: {
            id: true,
            agencyType: true,
            organizationName: true,
            isVerified: true,
          },
        },
      },
    });
  }

  async removeSubAccount(parentId: string, subAccountId: string) {
    await this.prisma.user.update({
      where: { id: subAccountId, parentId },
      data: { parentId: null },
    });

    return { success: true };
  }
}
