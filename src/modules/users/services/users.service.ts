import { Injectable } from '@nestjs/common';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { InviteSubAccountDto, AcceptSubAccountDto } from '../dto/sub-account.dto';
import { CompleteOnboardingDto, ActivateOwnerProfileDto, ActivateAgentProfileDto } from '../dto/onboarding.dto';
import { UserCapabilities, AccountPersona } from '@/common/domain/user-capability.types';
import * as crypto from 'crypto';
import { DomainError } from '@/common/domain/error';
import { UserErrorCodes } from '../errors';
import { User, Role } from '@prisma/client';

export type UserProfile = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'phone' | 'avatarUrl' | 'isActive' | 'createdAt'
>;

@Injectable()
export class UsersService extends Service {
  constructor(private readonly prisma: PrismaService) {
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
        'Agent profile requires explicit details via agent activation endpoint'
      );
    }

    return this.getUserCapabilities(userId);
  }

  async activateOwnerProfile(userId: string, dto: ActivateOwnerProfileDto) {
    const existingProfile = await this.prisma.ownerProfile.findUnique({ where: { userId } });
    if (existingProfile) {
      throw new DomainError(UserErrorCodes.PROFILE_ALREADY_EXISTS, 'Owner profile already activated');
    }

    await this.prisma.ownerProfile.create({
      data: {
        userId,
        businessName: dto.businessName,
      }
    });

    return this.getUserCapabilities(userId);
  }

  async activateAgentProfile(userId: string, dto: ActivateAgentProfileDto) {
    const existingProfile = await this.prisma.agentProfile.findUnique({ where: { userId } });
    if (existingProfile) {
      throw new DomainError(UserErrorCodes.PROFILE_ALREADY_EXISTS, 'Agent profile already activated');
    }

    await this.prisma.agentProfile.create({
      data: {
        userId,
        agencyType: dto.agencyType,
        organizationName: dto.organizationName,
        licenseNumber: dto.licenseNumber,
        defaultCommissionRate: dto.defaultCommissionRate,
      }
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

    return this.prisma.user.update({
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
        updatedAt: true,
      },
    });
  }

  async deleteAccount(userId: string): Promise<{ success: boolean }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { success: true };
  }

  async inviteSubAccount(parentId: string, dto: InviteSubAccountDto) {
    if (dto.role === Role.ADMIN || dto.role === Role.SUPER_ADMIN) {
      throw new DomainError(UserErrorCodes.INVALID_PROFILE_DATA, 'Owners cannot invite administrator sub-accounts');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.prisma.subAccountInvitation.create({
      data: {
        senderId: parentId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '');

    const link = existingUser
      ? `${frontendUrl}/invitations/accept?token=${token}`
      : `${frontendUrl}/register?token=${token}`;

    this.logger.info(`[Invitation] Email to ${dto.email}: ${link}`);

    return invitation;
  }

  async acceptInvitation(userId: string, dto: AcceptSubAccountDto) {
    const invitation = await this.prisma.subAccountInvitation.findUnique({
      where: { token: dto.token },
    });

    if (!invitation) {
      throw new DomainError(UserErrorCodes.RESOURCE_NOT_FOUND, 'Invitation not found or invalid token');
    }

    if (invitation.status !== 'PENDING') {
      throw new DomainError(UserErrorCodes.VALIDATION_FAILED, 'Invitation is no longer pending');
    }

    if (new Date() > invitation.expiresAt) {
      throw new DomainError(UserErrorCodes.VALIDATION_FAILED, 'Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.email !== invitation.email) {
      throw new DomainError(UserErrorCodes.UNAUTHORIZED, 'Invitation email does not match your account');
    }

    // Update user and invitation in a transaction
    return this.prisma.$transaction(async (tx) => {
      await tx.subAccountInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      return tx.user.update({
        where: { id: userId },
        data: {
          parentId: invitation.senderId,
          role: invitation.role,
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

  async setSubAccountStatus(parentId: string, subAccountId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: subAccountId, parentId },
      data: { isActive },
    });
  }

  async removeSubAccount(parentId: string, subAccountId: string) {
    return this.prisma.user.update({
      where: { id: subAccountId, parentId },
      data: { parentId: null },
    });
  }
}
