import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

export type ConsentArtifactDocument = ConsentArtifact & Document

export enum ConsentPurpose {
  CARE_MANAGEMENT = 'CARE_MANAGEMENT',
  BREAK_THE_GLASS = 'BREAK_THE_GLASS',
  PAYMENT = 'PAYMENT',
  RESEARCH = 'RESEARCH',
}

export enum ConsentStatus {
  REQUESTED = 'REQUESTED',
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

@Schema({ collection: 'consent_artifacts', timestamps: true })
export class ConsentArtifact {
  @Prop({ default: uuidv4 }) consentId: string
  @Prop({ required: true, index: true }) patientId: string
  @Prop({ required: true }) tenantId: string
  @Prop({ required: true }) requestedBy: string

  @Prop({ type: String, enum: ConsentPurpose, required: true })
  purpose: ConsentPurpose

  @Prop({ type: [String], default: [] })
  dataCategories: string[]

  @Prop({ type: Object, default: {} })
  dateRange: { from?: string; to?: string }

  @Prop({ type: String, enum: ConsentStatus, default: ConsentStatus.REQUESTED })
  status: ConsentStatus

  @Prop() grantedAt?: Date
  @Prop() expiresAt?: Date
  @Prop() revokedAt?: Date
}

export const ConsentArtifactSchema = SchemaFactory.createForClass(ConsentArtifact)
ConsentArtifactSchema.index({ patientId: 1, status: 1 })
