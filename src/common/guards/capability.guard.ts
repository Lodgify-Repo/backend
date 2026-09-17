import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITY_KEY } from '../decorators/capability.decorator';
import { AccountPersona } from '../domain/user-capability.types';
import { PrismaService } from '@/infra/database/prisma.service';

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCapabilities = this.reflector.getAllAndOverride<AccountPersona[]>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.id) {
      throw new ForbiddenException('User payload missing in request.');
    }

    // CUSTOMER capability is implicitly available to all authenticated users
    if (requiredCapabilities.includes('CUSTOMER')) {
      return true;
    }

    // Fetch user with profiles to check capabilities
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        ownerProfile: true,
        agentProfile: true,
      },
    });

    if (!userRecord) {
      throw new ForbiddenException('User record not found.');
    }

    const hasOwner = !!userRecord.ownerProfile;
    const hasAgent = !!userRecord.agentProfile;

    if (requiredCapabilities.includes('OWNER') && hasOwner) {
      return true;
    }
    if (requiredCapabilities.includes('AGENT') && hasAgent) {
      return true;
    }

    throw new ForbiddenException(`Requires active capability: ${requiredCapabilities.join(' or ')}`);
  }
}
