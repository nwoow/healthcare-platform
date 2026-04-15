import {
  Controller, Get, Post, Put, Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';

@ApiTags('forms')
@Controller('forms')
export class FormsController {
  constructor(private formsService: FormsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new form (draft)' })
  @ApiResponse({ status: 201, description: 'Form created' })
  create(@Body() dto: CreateFormDto) {
    return this.formsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all forms (optional tenant filter)' })
  @ApiQuery({ name: 'tenantId', required: false })
  findAll(@Query('tenantId') tenantId?: string) {
    return this.formsService.findAll(tenantId);
  }

  @Get('debug')
  @ApiOperation({ summary: '[DEBUG] Show tenant_id + access_control.roles for every form' })
  @ApiQuery({ name: 'tenantId', required: false })
  async debugForms(@Query('tenantId') tenantId?: string) {
    const forms = await this.formsService.findAll(tenantId);
    return forms.map(f => ({
      id: f._id,
      name: f.name,
      status: f.status,
      tenant_id: (f as any).tenant_id,
      access_control_roles: (f as any).access_control?.roles ?? [],
      version: (f as any).version,
    }));
  }

  @Get('accessible')
  @ApiOperation({ summary: 'Get forms accessible to a user role within a tenant' })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'role', required: true })
  @ApiQuery({ name: 'tenantId', required: false })
  findAccessible(
    @Query('userId') userId: string,
    @Query('role') role: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.formsService.findAccessible(userId, role, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a form by ID' })
  findOne(@Param('id') id: string) {
    return this.formsService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a form (increments version)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateFormDto>) {
    return this.formsService.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a form' })
  publish(@Param('id') id: string) {
    return this.formsService.publish(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Get all published versions of a form' })
  getVersions(@Param('id') id: string) {
    return this.formsService.getVersions(id);
  }
}
