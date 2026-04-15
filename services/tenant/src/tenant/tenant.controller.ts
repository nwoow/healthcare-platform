import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { TenantService } from './tenant.service'
import { OnboardTenantDto, UpdateStatusDto } from './dto/onboard-tenant.dto'

@ApiTags('Tenants')
@Controller('tenants')
export class TenantController {
  constructor(private tenantService: TenantService) {}

  @Post('onboard')
  @ApiOperation({ summary: 'Onboard a new tenant (5-step provisioning)' })
  onboard(@Body() dto: OnboardTenantDto) {
    return this.tenantService.onboard(dto)
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  findAll() { return this.tenantService.findAll() }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant with config and logs' })
  findOne(@Param('id') id: string) { return this.tenantService.findOne(id) }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update tenant status (suspend/activate)' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.tenantService.updateStatus(id, dto.status)
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get provisioning logs' })
  getLogs(@Param('id') id: string) { return this.tenantService.getLogs(id) }

  @Patch(':id/abdm-config')
  @ApiOperation({ summary: 'Update ABDM configuration for a tenant' })
  updateAbdmConfig(@Param('id') id: string, @Body() dto: {
    abdmEnabled?: boolean
    abdmFacilityId?: string
    abdmHipId?: string
    abdmHiuId?: string
    abdmSandboxMode?: boolean
  }) {
    return this.tenantService.updateAbdmConfig(id, dto)
  }

  @Get(':id/abdm-status')
  @ApiOperation({ summary: 'Get ABDM status including ABHA linkage rate' })
  getAbdmStatus(@Param('id') id: string) {
    return this.tenantService.getAbdmStatus(id)
  }
}
