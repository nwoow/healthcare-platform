import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto, UpdateStatusDto } from './dto/create-submission.dto';
import { SubmissionStatus } from '../schemas/submission.schema';

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create or save a submission (draft or submitted)' })
  create(@Body() dto: CreateSubmissionDto) {
    return this.submissionsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List submissions with optional filters' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'formId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SubmissionStatus })
  @ApiQuery({ name: 'submittedBy', required: false })
  @ApiQuery({ name: 'patientId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(
    @Query('tenantId') tenant_id?: string,
    @Query('formId') form_id?: string,
    @Query('status') status?: SubmissionStatus,
    @Query('submittedBy') submitted_by?: string,
    @Query('patientId') patient_id?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.submissionsService.findAll({ tenant_id, form_id, status, submitted_by, patient_id, from, to });
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Submission analytics for a tenant' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'days', required: false })
  getAnalytics(
    @Query('tenantId') tenantId?: string,
    @Query('days') days?: string,
  ) {
    return this.submissionsService.getAnalytics(tenantId || 'all', days ? parseInt(days) : 7);
  }

  @Get('analytics/specialty')
  @ApiOperation({ summary: 'Submission analytics grouped by specialty' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'days', required: false })
  getAnalyticsBySpecialty(
    @Query('tenantId') tenantId?: string,
    @Query('days') days?: string,
  ) {
    return this.submissionsService.getAnalyticsBySpecialty(tenantId || 'all', days ? parseInt(days) : 7);
  }

  @Get('notifications/:userId')
  @ApiOperation({ summary: 'Get notifications for a user (last 24h, max 20)' })
  getNotifications(@Param('userId') userId: string) {
    return this.submissionsService.getNotifications(userId);
  }

  @Patch('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string) {
    return this.submissionsService.markNotificationRead(id);
  }

  @Get(':id/audit-trail')
  @ApiOperation({ summary: 'Get full audit trail for a submission' })
  getAuditTrail(@Param('id') id: string) {
    return this.submissionsService.getAuditTrail(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a submission by ID' })
  findOne(@Param('id') id: string, @Query('actorId') actorId?: string) {
    return this.submissionsService.findOne(id, actorId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Approve or reject a submission' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.submissionsService.updateStatus(id, dto);
  }
}
