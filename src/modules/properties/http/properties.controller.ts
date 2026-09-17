import { Controller, Post, Get, Body, UseGuards, Request, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PropertiesService } from '../services/properties.service';
import { CreatePropertyDto, AuthorizeAgentDto, RespondAuthorizationDto } from '../dto/property.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CapabilityGuard } from '@/common/guards/capability.guard';
import { RequireCapability } from '@/common/decorators/capability.decorator';

@ApiTags('Properties')
@ApiBearerAuth('access-token')
@Controller('properties')
@UseGuards(JwtAuthGuard, CapabilityGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Post()
  @RequireCapability('OWNER')
  @ApiOperation({ summary: 'Create a new property (Hotel, Shortlet, Rental, or Sale)' })
  async createProperty(@Request() req: any, @Body() dto: CreatePropertyDto) {
    return this.propertiesService.createProperty(req.user.id, dto);
  }

  @Get('portfolio')
  @RequireCapability('OWNER')
  @ApiOperation({ summary: 'Get unified property portfolio for owner' })
  async getPortfolio(@Request() req: any) {
    return this.propertiesService.getOwnerPortfolio(req.user.id);
  }

  @Post(':id/authorize-agent')
  @RequireCapability('OWNER')
  @ApiOperation({ summary: 'Authorize an agent to manage a property' })
  async authorizeAgent(
    @Request() req: any,
    @Param('id') propertyId: string,
    @Body() dto: AuthorizeAgentDto,
  ) {
    return this.propertiesService.authorizeAgent(req.user.id, propertyId, dto);
  }

  @Patch('authorizations/:authId/revoke')
  @RequireCapability('OWNER')
  @ApiOperation({ summary: 'Revoke an agent authorization' })
  async revokeAuthorization(@Request() req: any, @Param('authId') authId: string) {
    return this.propertiesService.revokeAuthorization(req.user.id, authId);
  }

  // Agent Endpoints
  @Get('agent/assignments')
  @RequireCapability('AGENT')
  @ApiOperation({ summary: 'Get properties assigned to this agent' })
  async getAgentAssignments(@Request() req: any) {
    return this.propertiesService.getAgentAssignments(req.user.id);
  }

  @Patch('agent/authorizations/:authId/respond')
  @RequireCapability('AGENT')
  @ApiOperation({ summary: 'Accept or reject an authorization request' })
  async respondToAuthorization(
    @Request() req: any,
    @Param('authId') authId: string,
    @Body() dto: RespondAuthorizationDto,
  ) {
    return this.propertiesService.respondToAuthorization(req.user.id, authId, dto);
  }
}
