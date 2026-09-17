import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { UpdateUserStatusDto, CreateApiKeyDto } from '../dto/admin.dto';
import { SystemLogsQueryDto, ClearLogsDto } from '../dto/system-logs.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user status' })
  async updateUserStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(id, dto);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create a new server-to-server API Key' })
  async createApiKey(@Request() req: any, @Body() dto: CreateApiKeyDto) {
    return this.adminService.createApiKey(dto, req.user.id);
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'List generated API Keys' })
  async listApiKeys(@Query('tenantId') tenantId?: string) {
    return this.adminService.listApiKeys(tenantId);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke an API Key' })
  async revokeApiKey(@Request() req: any, @Param('id') id: string) {
    return this.adminService.revokeApiKey(id, req.user.id);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get system logs' })
  async getSystemLogs(@Query() dto: SystemLogsQueryDto) {
    return this.adminService.getSystemLogs(dto);
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear audit logs' })
  async clearAuditLogs(@Body() dto: ClearLogsDto) {
    return this.adminService.clearAuditLogs(dto);
  }
}
