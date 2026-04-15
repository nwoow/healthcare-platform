import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { CreateTenantDto } from './dto'

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post('onboard')
  @ApiOperation({ summary: 'Onboard a new tenant (5-step provisioning pipeline)' })
  onboard(@Body() dto: CreateTenantDto) {
    return this.tenantsService.onboard(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants with config' })
  findAll() {
    return this.tenantsService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tenant by ID with config and last 10 provisioning logs' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id)
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate a tenant' })
  activate(@Param('id') id: string) {
    return this.tenantsService.activate(id)
  }

  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend a tenant' })
  suspend(@Param('id') id: string) {
    return this.tenantsService.suspend(id)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Set tenant status (active/suspended)' })
  setStatus(@Param('id') id: string, @Body() body: { status: string }) {
    if (body.status === 'suspended') return this.tenantsService.suspend(id);
    return this.tenantsService.activate(id);
  }
}
