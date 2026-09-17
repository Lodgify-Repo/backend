import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreatePropertyDto, AuthorizeAgentDto, RespondAuthorizationDto } from '../dto/property.dto';
import { AssignPropertyStaffDto } from '../dto/assignment.dto';
import { DomainError } from '@/common/domain/error';

@Injectable()
export class PropertiesService extends Service {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createProperty(ownerId: string, dto: CreatePropertyDto) {
    const ownerProfile = await this.prisma.ownerProfile.findUnique({ where: { userId: ownerId } });
    if (!ownerProfile) {
      throw new DomainError('OWNER_PROFILE_REQUIRED', 'An active Owner profile is required to create a property.');
    }

    return this.prisma.property.create({
      data: {
        ownerId,
        title: dto.title,
        category: dto.category,
        price: dto.price,
        metadata: dto.metadata ?? {},
      },
    });
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
      throw new NotFoundException('Property not found or not owned by you.');
    }

    let agentId = dto.agentId;
    if (!agentId && dto.agentEmail) {
      const agentUser = await this.prisma.user.findUnique({ where: { email: dto.agentEmail } });
      if (!agentUser) throw new NotFoundException('Agent user not found with provided email.');
      agentId = agentUser.id;
    }

    if (!agentId) {
      throw new DomainError('VALIDATION_FAILED', 'Must provide either agentId or agentEmail');
    }

    const agentProfile = await this.prisma.agentProfile.findUnique({ where: { userId: agentId } });
    if (!agentProfile) {
      throw new DomainError('AGENT_PROFILE_REQUIRED', 'The targeted user does not have an active Agent profile.');
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
      throw new NotFoundException('Authorization request not found.');
    }

    if (auth.status !== 'PENDING') {
      throw new DomainError('INVALID_STATE', 'Authorization is not pending.');
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
      throw new NotFoundException('Authorization request not found or not yours.');
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
      throw new NotFoundException('Property not found or not owned by you.');
    }

    let targetUserId = dto.userId;
    if (!targetUserId && dto.email) {
      const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (!user) {
        throw new NotFoundException('Assignee user not found with provided email.');
      }
      targetUserId = user.id;
    }
    if (!targetUserId) {
      throw new DomainError('VALIDATION_FAILED', 'Must provide either userId or email');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { agentProfile: true },
    });
    if (!targetUser) {
      throw new NotFoundException('Target user not found.');
    }

    if (targetUser.parentId !== ownerId && !targetUser.agentProfile) {
      throw new DomainError(
        'INVALID_ASSIGNEE',
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
      throw new NotFoundException('Property not found or not owned by you.');
    }

    const assignment = await this.prisma.propertyAssignment.findFirst({
      where: { id: assignmentId, propertyId },
    });
    if (!assignment) {
      throw new NotFoundException('Assignment not found on this property.');
    }

    await this.prisma.propertyAssignment.delete({ where: { id: assignmentId } });
    return { success: true };
  }

  async getPropertyAssignments(ownerId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, ownerId },
    });
    if (!property) {
      throw new NotFoundException('Property not found or not owned by you.');
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
}
