import { Controller, Get, Post, Put, Delete, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { IntegrationConfig } from '../schemas/integration-config.schema';

@ApiTags('Integrations')
@Controller('integrations')
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Get()
  @ApiOperation({ summary: 'List all integrations for a tenant' })
  @ApiQuery({ name: 'tenantId', required: true })
  findAll(@Query('tenantId') tenantId: string) {
    return this.integrationService.findAll(tenantId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  create(@Body() dto: Partial<IntegrationConfig>) {
    return this.integrationService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration by ID' })
  findOne(@Param('id') id: string) {
    return this.integrationService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration' })
  update(@Param('id') id: string, @Body() dto: Partial<IntegrationConfig>) {
    return this.integrationService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete integration (status=deleted)' })
  remove(@Param('id') id: string) {
    return this.integrationService.softDelete(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Toggle integration status active/inactive' })
  toggle(@Param('id') id: string) {
    return this.integrationService.toggleStatus(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  test(@Param('id') id: string) {
    return this.integrationService.testConnection(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get integration logs' })
  @ApiQuery({ name: 'limit', required: false })
  getLogs(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.integrationService.getLogs(id, limit ? parseInt(limit) : 50);
  }
}
