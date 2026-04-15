import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FormDataAuditLogDocument = FormDataAuditLog & Document;

export enum AuditAction {
  FORM_OPENED       = 'FORM_OPENED',
  DRAFT_SAVED       = 'DRAFT_SAVED',
  FORM_SUBMITTED    = 'FORM_SUBMITTED',
  FORM_APPROVED     = 'FORM_APPROVED',
  FORM_REJECTED     = 'FORM_REJECTED',
  FORM_VIEWED       = 'FORM_VIEWED',
  FHIR_EXPORTED     = 'FHIR_EXPORTED',
  CONSENT_CHECKED   = 'CONSENT_CHECKED',
}

@Schema({ collection: 'form_data_audit_logs', timestamps: false })
export class FormDataAuditLog {
  @Prop({ default: uuidv4 }) auditId: string;
  @Prop({ required: true, index: true }) tenantId: string;
  @Prop({ required: true, index: true }) submissionId: string;
  @Prop({ required: true }) formId: string;
  @Prop({ required: true }) patientId: string;
  @Prop({ required: true }) actorId: string;
  @Prop({ default: 'unknown' }) actorRole: string;

  @Prop({ type: String, enum: AuditAction, required: true })
  action: AuditAction;

  @Prop() fieldId?: string;
  @Prop() fieldLabel?: string;
  @Prop() oldValue?: string;
  @Prop() newValue?: string;

  @Prop({ default: 'unknown' }) ipAddress: string;
  @Prop({ default: '' }) userAgent: string;
  @Prop({ default: '' }) sessionId: string;

  @Prop({ default: Date.now, index: true }) timestamp: Date;

  @Prop({ type: Object, default: {} }) metadata: Record<string, any>;
}

export const FormDataAuditLogSchema = SchemaFactory.createForClass(FormDataAuditLog);
FormDataAuditLogSchema.index({ submissionId: 1, timestamp: 1 });
FormDataAuditLogSchema.index({ tenantId: 1, timestamp: -1 });
