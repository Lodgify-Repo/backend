import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PropertiesService } from '../services/properties.service';
import { SearchPropertiesDto } from '../dto/search-properties.dto';

@ApiTags('Properties')
@Controller('properties')
export class PublicPropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  @ApiOperation({ summary: 'Search published properties (public)' })
  async search(@Query() query: SearchPropertiesDto) {
    return this.propertiesService.searchProperties(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get property details (public)' })
  async findOne(@Param('id') id: string) {
    return this.propertiesService.getPropertyDetails(id);
  }
}
