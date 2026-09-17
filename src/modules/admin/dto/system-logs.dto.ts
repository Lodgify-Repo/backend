import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AuditLogLevel, AuditLogAction } from '@prisma/client';

export type LogSource = 'audit' | 'files' | 'all';

export class SystemLogsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by log level', enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'] })
  @IsOptional()
  @IsEnum(AuditLogLevel)
  level?: AuditLogLevel;

  @ApiPropertyOptional({ description: 'Filter by action type' })
  @IsOptional()
  @IsEnum(AuditLogAction)
  action?: AuditLogAction;

  @ApiPropertyOptional({ description: 'Filter by actor/user ID', example: 'clxyz123' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Free-text search query', example: 'user created' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601)', example: '2026-08-21' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Log source', enum: ['audit', 'files', 'all'], default: 'audit' })
  @IsOptional()
  @IsEnum(['audit', 'files', 'all'] as const)
  source?: LogSource = 'audit';

  @ApiPropertyOptional({ description: 'Filter by log filename (for file-based logs)', example: 'server.log' })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({ description: 'Number of tail lines to return from file logs', example: 200, default: 200 })
  @IsOptional()
  @Type(() => Number)
  tail?: number = 200;
}

export class ClearLogsDto {
  @ApiPropertyOptional({ description: 'Retention period in days (logs older will be deleted)', example: 90, default: 90 })
  @IsOptional()
  @Type(() => Number)
  retentionDays?: number = 90;
}
