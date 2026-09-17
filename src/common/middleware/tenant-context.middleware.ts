import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { JWT_SECRET } from '@/common/constants';
import { PrismaService } from '@/infra/database/prisma.service';

export interface TenantPayload {
  id: string;
  tier: 'standard' | 'enterprise';
  apiKeyId?: string;
  permissions?: string[];
}

interface JwtTenantClaims {
  sub: string;
  id?: string;
  tenantId?: string;
  tier?: 'standard' | 'enterprise';
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantPayload;
    }
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET', '') || JWT_SECRET || '';
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const apiKeyHeader = (req.headers['x-api-key'] || req.headers['x-apikey']) as string | undefined;

      let tenantId: string | undefined;
      let tier: 'standard' | 'enterprise' = 'standard';
      let apiKeyId: string | undefined;
      let permissions: string[] | undefined;

      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (!token) {
          throw new UnauthorizedException('Authentication token is missing.');
        }

        if (!this.jwtSecret) {
          throw new UnauthorizedException('JWT authentication is not configured on the server.');
        }

        let decoded: JwtTenantClaims;
        try {
          decoded = jwt.verify(token, this.jwtSecret) as unknown as JwtTenantClaims;
        } catch {
          throw new UnauthorizedException('Invalid or expired authentication token for tenant context.');
        }

        tenantId = decoded.tenantId ?? decoded.sub ?? decoded.id;
        tier = decoded.tier === 'enterprise' ? 'enterprise' : 'standard';
      } else if (apiKeyHeader) {
        const rawKey = apiKeyHeader.trim();
        if (!rawKey) {
          throw new UnauthorizedException('API key cannot be empty.');
        }

        const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');
        const apiKey = await this.prisma.apiKey.findFirst({
          where: {
            OR: [{ key: rawKey }, { key: hashedKey }],
            isActive: true,
          },
        });

        if (!apiKey) {
          throw new UnauthorizedException('Invalid API key provided.');
        }

        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
          throw new UnauthorizedException('API key has expired.');
        }

        tenantId = apiKey.tenantId;
        tier = apiKey.tier?.toLowerCase() === 'enterprise' ? 'enterprise' : 'standard';
        apiKeyId = apiKey.id;
        permissions = apiKey.permissions;

        await this.prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { lastUsedAt: new Date() },
        });
      }

      if (tenantId) {
        req.tenant = {
          id: tenantId,
          tier,
          ...(apiKeyId && { apiKeyId }),
          ...(permissions && { permissions }),
        };
      }

      next();
    } catch (error) {
      next(error);
    }
  }
}
