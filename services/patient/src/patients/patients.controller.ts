import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { PatientsService } from './patients.service'
import { CreatePatientDto } from './dto/create-patient.dto'
import { AddHistoryDto } from './dto/add-history.dto'
import { LinkAbhaDto } from './dto/link-abha.dto'

@ApiTags('Patients')
@Controller('patients')
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new patient (auto MRN)' })
  create(@Body() dto: CreatePatientDto) {
    return this.patientsService.create(dto)
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Patient analytics for a tenant' })
  @ApiQuery({ name: 'tenantId', required: false })
  getAnalytics(@Query('tenantId') tenantId?: string) {
    return this.patientsService.getAnalytics(tenantId || 'all')
  }

  @Get()
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiOperation({ summary: 'List patients with optional tenantId filter and search' })
  findAll(@Query('tenantId') tenantId?: string, @Query('search') search?: string) {
    return this.patientsService.findAll(tenantId, search)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update patient details' })
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>) {
    return this.patientsService.update(id, dto)
  }

  @Post(':id/history')
  @ApiOperation({ summary: 'Add a visit history entry for a patient' })
  addHistory(@Param('id') id: string, @Body() dto: AddHistoryDto) {
    return this.patientsService.addHistory(id, dto)
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get all visit history entries for a patient' })
  getHistory(@Param('id') id: string) {
    return this.patientsService.getHistory(id)
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get patient visit timeline' })
  getTimeline(@Param('id') id: string) {
    return this.patientsService.getTimeline(id)
  }

  // ── ABHA ────────────────────────────────────────────────────────────────

  @Post(':id/link-abha')
  @ApiOperation({ summary: 'Link ABHA number to patient (validates format, marks verified)' })
  linkAbha(@Param('id') id: string, @Body() dto: LinkAbhaDto) {
    return this.patientsService.linkAbha(id, dto)
  }

  @Get(':id/abha-status')
  @ApiOperation({ summary: 'Get ABHA linkage status (masked number)' })
  getAbhaStatus(@Param('id') id: string) {
    return this.patientsService.getAbhaStatus(id)
  }

  // ── FHIR ────────────────────────────────────────────────────────────────

  @Get(':id/fhir')
  @ApiOperation({ summary: 'Get FHIR R4 Patient resource' })
  getFhirPatient(@Param('id') id: string) {
    return this.patientsService.getFhirPatient(id)
  }

  @Get(':id/fhir/observations')
  @ApiOperation({ summary: 'Get FHIR R4 Bundle of Observations from patient history' })
  getFhirObservations(@Param('id') id: string) {
    return this.patientsService.getFhirObservations(id)
  }

  // ── Consent ──────────────────────────────────────────────────────────────

  @Post(':id/consent/request')
  @ApiOperation({ summary: 'Request consent from patient (auto-granted after 2s in demo mode)' })
  requestConsent(
    @Param('id') id: string,
    @Body() dto: { purpose: string; dataCategories: string[]; dateRange: { from: string; to: string }; requestedBy: string; tenantId?: string },
  ) {
    return this.patientsService.requestConsent(id, dto)
  }

  @Get(':id/consent')
  @ApiOperation({ summary: 'Get all consent artifacts for patient' })
  getConsents(@Param('id') id: string) {
    return this.patientsService.getConsents(id)
  }

  @Patch(':id/consent/:consentId')
  @ApiOperation({ summary: 'Grant, deny, or revoke a consent artifact' })
  updateConsent(
    @Param('id') id: string,
    @Param('consentId') consentId: string,
    @Body() body: { action: 'grant' | 'deny' | 'revoke' },
  ) {
    return this.patientsService.updateConsent(id, consentId, body.action)
  }

  @Get(':id/consent/:consentId/verify')
  @ApiOperation({ summary: 'Verify if a consent artifact is currently valid' })
  verifyConsent(@Param('id') id: string, @Param('consentId') consentId: string) {
    return this.patientsService.verifyConsent(id, consentId)
  }
}
