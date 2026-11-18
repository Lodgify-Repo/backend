import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  BadRequestException,
  Controller,
  Get,
  Body,
  UseGuards,
  Request,
  Patch,
  Delete,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import {
  UsersService,
  type UploadedAvatarFile,
} from '../services/users.service';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_BYTES,
} from '../avatar.constants';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { InviteSubAccountDto, AcceptSubAccountDto } from '../dto/sub-account.dto';
import { CompleteOnboardingDto, ActivateOwnerProfileDto, ActivateAgentProfileDto } from '../dto/onboarding.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CapabilityGuard } from '@/common/guards/capability.guard';
import { RequireCapability } from '@/common/decorators/capability.decorator';

const AVATAR_UPLOAD_OPTIONS: MulterOptions = {
  limits: { fileSize: AVATAR_MAX_BYTES },
  fileFilter: (_request, file, callback) => {
    if (!AVATAR_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException('Avatar must be a PNG, JPEG, or WebP image.'),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

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

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('avatar', AVATAR_UPLOAD_OPTIONS))
  async uploadAvatar(
    @Request() req: any,
    @UploadedFile() file?: UploadedAvatarFile,
  ) {
    if (!file) {
      throw new BadRequestException('Avatar image is required.');
    }

    return this.usersService.uploadAvatar(req.user.id, file);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete account' })
  async deleteAccount(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }

  @UseGuards(CapabilityGuard)
  @RequireCapability('OWNER')
  @Post('sub-accounts/invite')
  @ApiOperation({ summary: 'Invite sub-account (e.g., manager or agent)' })
  async inviteSubAccount(@Request() req: any, @Body() dto: InviteSubAccountDto) {
    return this.usersService.inviteSubAccount(req.user.id, dto);
  }

  @UseGuards(CapabilityGuard)
  @RequireCapability('OWNER')
  @Get('sub-accounts')
  @ApiOperation({ summary: 'List owner sub-accounts' })
  async getSubAccounts(@Request() req: any) {
    return this.usersService.getSubAccounts(req.user.id);
  }

  @Post('sub-accounts/accept')
  @ApiOperation({ summary: 'Accept a sub-account invitation' })
  async acceptInvitation(@Request() req: any, @Body() dto: AcceptSubAccountDto) {
    return this.usersService.acceptInvitation(req.user.id, dto);
  }

  @UseGuards(CapabilityGuard)
  @RequireCapability('OWNER')
  @Patch('sub-accounts/:id/status')
  @ApiOperation({ summary: 'Activate/deactivate sub-account' })
  async setSubAccountStatus(@Request() req: any, @Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.usersService.setSubAccountStatus(req.user.id, id, isActive);
  }

  @UseGuards(CapabilityGuard)
  @RequireCapability('OWNER')
  @Delete('sub-accounts/:id')
  @ApiOperation({ summary: 'Remove sub-account from organization' })
  async removeSubAccount(@Request() req: any, @Param('id') id: string) {
    return this.usersService.removeSubAccount(req.user.id, id);
  }
}
