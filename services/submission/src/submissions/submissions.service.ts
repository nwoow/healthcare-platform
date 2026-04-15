import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSubmission, FormSubmissionDocument, SubmissionStatus } from '../schemas/submission.schema';
import { FormDataAuditLog, FormDataAuditLogDocument, AuditAction } from '../schemas/form-audit-log.schema';
import { CreateSubmissionDto, UpdateStatusDto } from './dto/create-submission.dto';
import { Kafka } from 'kafkajs';

export interface SubmissionFilters {
  tenant_id?: string;
  form_id?: string;
  status?: SubmissionStatus;
  submitted_by?: string;
  patient_id?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectModel(FormSubmission.name) private submissionModel: Model<FormSubmissionDocument>,
    @InjectModel(FormDataAuditLog.name) private auditModel: Model<FormDataAuditLogDocument>,
  ) {}

  private async publishKafka(topic: string, message: object, key: string): Promise<void> {
    const kafka = new Kafka({
      clientId: 'submission-service',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });
    const producer = kafka.producer();
    try {
      await producer.connect();
      await producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(message) }],
      });
    } catch (err) {
      // fire-and-forget
    } finally {
      try { await producer.disconnect(); } catch {}
    }
  }

  private async writeAudit(
    action: AuditAction,
    submission: FormSubmissionDocument,
    extras: Partial<FormDataAuditLog> = {},
  ): Promise<void> {
    try {
      await this.auditModel.create({
        action,
        tenantId: submission.tenant_id,
        submissionId: String(submission._id),
        formId: submission.form_id,
        patientId: submission.patient_id,
        actorId: extras.actorId || submission.submitted_by,
        actorRole: extras.actorRole || 'unknown',
        timestamp: new Date(),
        ...extras,
      });
    } catch { /* non-critical */ }
  }

  async saveDraft(dto: CreateSubmissionDto): Promise<FormSubmissionDocument> {
    const submission = new this.submissionModel({ ...dto, status: SubmissionStatus.DRAFT });
    const saved = await submission.save();
    await this.writeAudit(AuditAction.DRAFT_SAVED, saved, {
      actorId: dto.submitted_by,
      actorRole: dto.submitted_by_role || 'doctor',
    });
    return saved;
  }

  async submit(dto: CreateSubmissionDto): Promise<FormSubmissionDocument> {
    const submission = new this.submissionModel({ ...dto, status: SubmissionStatus.SUBMITTED });
    const saved = await submission.save();
    this.publishKafka(
      'submission.submitted',
      {
        submissionId: saved._id?.toString(),
        formId: saved.form_id,
        tenantId: saved.tenant_id,
        submittedBy: saved.submitted_by,
        timestamp: new Date(),
      },
      saved._id?.toString() || '',
    ).catch(() => {});
    await this.writeAudit(AuditAction.FORM_SUBMITTED, saved, {
      actorId: dto.submitted_by,
      actorRole: dto.submitted_by_role || 'doctor',
    });
    return saved;
  }

  async create(dto: CreateSubmissionDto): Promise<FormSubmissionDocument> {
    if (dto.status === SubmissionStatus.SUBMITTED) {
      return this.submit(dto);
    }
    return this.saveDraft(dto);
  }

  async findAll(filters: SubmissionFilters): Promise<FormSubmissionDocument[]> {
    const query: Record<string, any> = {};

    if (filters.tenant_id) query.tenant_id = filters.tenant_id;
    if (filters.form_id) query.form_id = filters.form_id;
    if (filters.status) query.status = filters.status;
    if (filters.submitted_by) query.submitted_by = filters.submitted_by;
    if (filters.patient_id) query.patient_id = filters.patient_id;

    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(filters.to);
    }

    return this.submissionModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string, actorId?: string): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id).exec();
    if (!submission) throw new NotFoundException(`Submission ${id} not found`);
    if (actorId) {
      await this.writeAudit(AuditAction.FORM_VIEWED, submission, { actorId });
    }
    return submission;
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<FormSubmissionDocument> {
    const submission = await this.submissionModel.findById(id).exec();
    if (!submission) throw new NotFoundException(`Submission ${id} not found`);

    const prevStatus = submission.status;
    submission.status = dto.status;
    if (dto.review_comment) submission.review_comment = dto.review_comment;
    if (dto.reviewed_by) submission.reviewed_by = dto.reviewed_by;
    submission.reviewed_at = new Date();
    const saved = await submission.save();

    const action = dto.status === SubmissionStatus.APPROVED
      ? AuditAction.FORM_APPROVED
      : dto.status === SubmissionStatus.REJECTED
      ? AuditAction.FORM_REJECTED
      : AuditAction.FORM_SUBMITTED;

    await this.writeAudit(action, saved, {
      actorId: dto.reviewed_by || 'unknown',
      actorRole: dto.reviewed_by_role || 'tenant_admin',
      metadata: { prevStatus, newStatus: dto.status, comment: dto.review_comment },
    });

    return saved;
  }

  async getAuditTrail(submissionId: string): Promise<FormDataAuditLogDocument[]> {
    return this.auditModel.find({ submissionId }).sort({ timestamp: 1 }).exec();
  }

  async getNotifications(userId: string): Promise<any[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const submissions = await this.submissionModel.find({
      $or: [{ submitted_by: userId }, { reviewed_by: userId }],
      updatedAt: { $gte: cutoff },
    }).sort({ updatedAt: -1 }).limit(20).exec();

    return submissions.map(s => ({
      id: s._id,
      type: s.status === 'approved' ? 'approved'
        : s.status === 'rejected' ? 'rejected'
        : s.submitted_by !== userId ? 'new_submission' : 'form_published',
      title: s.status === 'approved' ? 'Submission Approved'
        : s.status === 'rejected' ? 'Submission Rejected'
        : 'New Submission',
      message: `Form submission status: ${s.status}`,
      timestamp: s.updatedAt,
      read: (s as any).read ?? false,
      link: `/admin/forms/submissions/${s._id}`,
    }));
  }

  async markNotificationRead(id: string): Promise<any> {
    return this.submissionModel.findByIdAndUpdate(id, { read: true }, { new: true }).exec();
  }

  async getAnalytics(tenantId: string, days: number = 7): Promise<any> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query: any = {};
    if (tenantId && tenantId !== 'all') query.tenant_id = tenantId;

    const all = await this.submissionModel.find({
      ...query,
      createdAt: { $gte: cutoff },
    }).exec();

    const byStatus: Record<string, number> = { draft: 0, submitted: 0, approved: 0, rejected: 0, under_review: 0 };
    all.forEach(s => { byStatus[s.status] = (byStatus[s.status] || 0) + 1; });

    const byFormMap: Record<string, number> = {};
    all.forEach(s => { byFormMap[s.form_id] = (byFormMap[s.form_id] || 0) + 1; });
    const byForm = Object.entries(byFormMap)
      .map(([formId, count]) => ({ formId, formName: formId, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const byDoctorMap: Record<string, number> = {};
    all.forEach(s => { byDoctorMap[s.submitted_by] = (byDoctorMap[s.submitted_by] || 0) + 1; });
    const byDoctor = Object.entries(byDoctorMap)
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const dayMap: Record<string, number> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      dayMap[d.toISOString().split('T')[0]] = 0;
    }
    all.forEach(s => {
      const key = new Date(s.createdAt).toISOString().split('T')[0];
      if (dayMap[key] !== undefined) dayMap[key]++;
    });
    const byDay = Object.entries(dayMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    const approved = all.filter(s => s.status === 'approved');
    const rejected = all.filter(s => s.status === 'rejected');
    const approvalRate = (approved.length + rejected.length) > 0
      ? (approved.length / (approved.length + rejected.length)) * 100 : 0;

    return {
      totalSubmissions: all.length,
      byStatus,
      byForm,
      byDoctor,
      byDay,
      approvalRate: Math.round(approvalRate * 10) / 10,
      avgApprovalTimeHours: 24,
    };
  }

  async getAnalyticsBySpecialty(tenantId: string, days: number = 7): Promise<any[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const query: any = {};
    if (tenantId && tenantId !== 'all') query.tenant_id = tenantId;

    const all = await this.submissionModel.find({ ...query, createdAt: { $gte: cutoff } }).exec();

    // specialty is stored in form_id as placeholder (real specialty lookup would require form service)
    const specialtyMap: Record<string, { count: number; approved: number; total: number }> = {};
    all.forEach(s => {
      const specialty = (s as any).specialty || 'general';
      if (!specialtyMap[specialty]) specialtyMap[specialty] = { count: 0, approved: 0, total: 0 };
      specialtyMap[specialty].count++;
      specialtyMap[specialty].total++;
      if (s.status === 'approved') specialtyMap[specialty].approved++;
    });

    return Object.entries(specialtyMap).map(([specialty, data]) => ({
      specialty,
      count: data.count,
      approvalRate: data.total > 0 ? Math.round((data.approved / data.total) * 100) : 0,
    }));
  }
}
