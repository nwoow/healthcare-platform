import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FormSubmissionDocument = FormSubmission & Document;

export enum SubmissionStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Schema({ collection: 'form_submissions', timestamps: true })
export class FormSubmission {
  @Prop({ default: uuidv4 }) submission_id: string;
  @Prop({ required: true }) tenant_id: string;
  @Prop({ required: true }) form_id: string;
  @Prop({ required: true }) form_version: number;
  @Prop({ required: true }) patient_id: string;
  @Prop({ required: true }) submitted_by: string;

  @Prop({
    type: String,
    enum: SubmissionStatus,
    default: SubmissionStatus.DRAFT,
  })
  status: SubmissionStatus;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  data: Record<string, any>;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  workflow_state: Record<string, any>;

  @Prop() review_comment?: string;
  @Prop() reviewed_by?: string;
  @Prop() reviewed_at?: Date;
  @Prop({ default: false }) read: boolean;

  // Auto-managed by timestamps: true
  createdAt: Date;
  updatedAt: Date;
}

export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

// Indexes for common query patterns
FormSubmissionSchema.index({ tenant_id: 1, form_id: 1 });
FormSubmissionSchema.index({ tenant_id: 1, submitted_by: 1 });
FormSubmissionSchema.index({ tenant_id: 1, status: 1 });
FormSubmissionSchema.index({ patient_id: 1 });
