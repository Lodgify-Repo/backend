import { Injectable } from '@nestjs/common';
import { Service } from '@/common/domain/base.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { UpdateUserStatusDto, CreateApiKeyDto } from '../dto/admin.dto';
import { SystemLogsQueryDto, ClearLogsDto } from '../dto/system-logs.dto';
import { DomainError } from '@/common/domain/error';
import { AdminErrorCodes } from '../errors';
import { Prisma, AuditLogLevel, AuditLogAction, User, ApiKey, AuditLog } from '@prisma/client';
import Logger from '@/infra/logger/logger.service';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as crypto from 'crypto';

export type ManagedUser = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'role' | 'isActive' | 'createdAt'>;

export interface AuditLogEntry {
  action: AuditLogAction;
  message: string;
  level?: AuditLogLevel;
  actorId?: string;
  actorEmail?: string;
  targetType?: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedLogLine {
  timestamp: string | null;
  level: string | null;
  message: string;
}

export type SystemLogsResult =
  | { source: 'audit'; data: AuditLog[]; meta: { total: number; page: number; limit: number; totalPages: number } }
  | { source: 'files'; data: ParsedLogLine[]; meta: { filename: string; linesReturned: number } }
  | {
      source: 'all';
      data: { audit: AuditLog[]; files: ParsedLogLine[] };
      meta: {
        audit: { total: number; page: number; limit: number; totalPages: number };
        files: { filename: string; linesReturned: number };
      };
    };

@Injectable()
export class AdminService extends Service {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getAllUsers(): Promise<ManagedUser[]> {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async updateUserStatus(userId: string, dto: UpdateUserStatusDto): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new DomainError(AdminErrorCodes.TARGET_NOT_FOUND, 'User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.status === 'ACTIVE' },
    });
  }

  async createApiKey(dto: CreateApiKeyDto, adminUserId: string): Promise<ApiKey & { rawKey: string }> {
    const rawKey = `ldg_${crypto.randomBytes(24).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: dto.name,
        key: hashedKey,
        tenantId: dto.tenantId,
        ownerId: adminUserId,
        tier: dto.tier ?? 'standard',
        permissions: dto.permissions ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    await this.writeAuditLog({
      action: AuditLogAction.CONFIG_CHANGED,
      message: `API Key "${dto.name}" created for tenant ${dto.tenantId} by admin ${adminUserId}`,
      level: AuditLogLevel.INFO,
      actorId: adminUserId,
      targetType: 'ApiKey',
      targetId: apiKey.id,
    });

    return { ...apiKey, rawKey };
  }

  async listApiKeys(tenantId?: string): Promise<Omit<ApiKey, 'key'>[]> {
    const where: Prisma.ApiKeyWhereInput = tenantId ? { tenantId } : {};
    return this.prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        name: true,
        tenantId: true,
        ownerId: true,
        tier: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeApiKey(id: string, adminUserId?: string): Promise<ApiKey> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      throw new DomainError(AdminErrorCodes.TARGET_NOT_FOUND, 'API Key not found');
    }

    const updated = await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    if (adminUserId) {
      await this.writeAuditLog({
        action: AuditLogAction.CONFIG_CHANGED,
        message: `API Key "${apiKey.name}" revoked by admin ${adminUserId}`,
        level: AuditLogLevel.WARN,
        actorId: adminUserId,
        targetType: 'ApiKey',
        targetId: apiKey.id,
      });
    }

    return updated;
  }

  async getSystemLogs(dto: SystemLogsQueryDto): Promise<SystemLogsResult> {
    const source = dto.source ?? 'audit';

    if (source === 'audit') {
      const audit = await this.getAuditLogs(dto);
      return { source: 'audit', ...audit };
    }

    if (source === 'files') {
      const files = await this.getLogFileEntries(dto.filename ?? 'server', dto.tail ?? 200);
      return {
        source: 'files',
        data: files.entries,
        meta: { filename: files.filename, linesReturned: files.entries.length },
      };
    }

    const [audit, files] = await Promise.all([
      this.getAuditLogs(dto),
      this.getLogFileEntries(dto.filename ?? 'server', dto.tail ?? 200),
    ]);

    return {
      source: 'all',
      data: { audit: audit.data, files: files.entries },
      meta: {
        audit: audit.meta,
        files: { filename: files.filename, linesReturned: files.entries.length },
      },
    };
  }

  async writeAuditLog(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          level: entry.level ?? AuditLogLevel.INFO,
          action: entry.action,
          message: entry.message,
          actorId: entry.actorId ?? null,
          actorEmail: entry.actorEmail ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
          metadata: (entry.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${(error as Error).message}`);
    }
  }

  async clearAuditLogs(dto: ClearLogsDto): Promise<{ deleted: number; olderThan: string }> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (dto.retentionDays ?? 90));

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.info(`Purged ${result.count} audit log entries older than ${dto.retentionDays ?? 90} days`);

    return { deleted: result.count, olderThan: cutoff.toISOString() };
  }

  private async getAuditLogs(dto: SystemLogsQueryDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {};

    if (dto.level) where.level = dto.level;
    if (dto.action) where.action = dto.action;
    if (dto.actorId) where.actorId = dto.actorId;

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    if (dto.search) {
      where.message = { contains: dto.search, mode: 'insensitive' };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private async getLogFileEntries(filename: string, tail: number) {
    const filePath = Logger.getLogFilePath(filename);

    if (!filePath) {
      const available = Logger.getAvailableLogFiles();
      throw new DomainError(
        AdminErrorCodes.LOG_FILE_NOT_FOUND,
        `Invalid log file "${filename}". Available: ${available.join(', ')}`,
      );
    }

    if (!existsSync(filePath)) {
      return { filename, entries: [] };
    }

    const raw = await readFile(filePath, 'utf-8');
    const lines = raw.split('\n').filter((line) => line.trim().length > 0);
    const sliced = lines.slice(-Math.min(tail, lines.length));
    const entries = sliced.map((line) => this.parseLogLine(line));

    return { filename, entries };
  }

  private parseLogLine(line: string): ParsedLogLine {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\]\s(\w+):\s(.+)$/s);
    if (match) {
      return { timestamp: match[1], level: match[2], message: match[3] };
    }
    return { timestamp: null, level: null, message: line };
  }
}
