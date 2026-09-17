import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Controller, Get, Body, UseGuards, Request, Patch, Delete, Post, Param } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { InviteSubAccountDto } from '../dto/sub-account.dto';
import { CompleteOnboardingDto, ActivateOwnerProfileDto, ActivateAgentProfileDto } from '../dto/onboarding.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('capabilities')
  @ApiOperation({ summary: 'Get current user active capabilities and personas' })
  async getCapabilities(@Request() req: any) {
    return this.usersService.getUserCapabilities(req.user.id);
  }

  @Post('onboarding')
  @ApiOperation({ summary: 'Complete initial user onboarding' })
  async completeOnboarding(@Request() req: any, @Body() dto: CompleteOnboardingDto) {
    return this.usersService.completeOnboarding(req.user.id, dto);
  }

  @Post('personas/owner')
  @ApiOperation({ summary: 'Activate property owner profile' })
  async activateOwnerProfile(@Request() req: any, @Body() dto: ActivateOwnerProfileDto) {
    return this.usersService.activateOwnerProfile(req.user.id, dto);
  }

  @Post('personas/agent')
  @ApiOperation({ summary: 'Activate property agent profile' })
  async activateAgentProfile(@Request() req: any, @Body() dto: ActivateAgentProfileDto) {
    return this.usersService.activateAgentProfile(req.user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get profile' })
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update profile' })
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, dto);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account' })
  async deleteAccount(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Post('sub-accounts/invite')
  @ApiOperation({ summary: 'Invite staff sub-account' })
  async inviteSubAccount(@Request() req: any, @Body() dto: InviteSubAccountDto) {
    return this.usersService.inviteSubAccount(req.user.id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Get('sub-accounts')
  @ApiOperation({ summary: 'List sub-accounts' })
  async getSubAccounts(@Request() req: any) {
    return this.usersService.getSubAccounts(req.user.id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Patch('sub-accounts/:id/status')
  @ApiOperation({ summary: 'Activate/deactivate sub-account' })
  async setSubAccountStatus(@Request() req: any, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setSubAccountStatus(req.user.id, id, isActive);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.MANAGER)
  @Delete('sub-accounts/:id')
  @ApiOperation({ summary: 'Remove sub-account from organization' })
  async removeSubAccount(@Request() req: any, @Param('id') id: string) {
    return this.usersService.removeSubAccount(req.user.id, id);
  }
}
