import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type IntegrationConfigDocument = IntegrationConfig & Document;

export enum IntegrationType {
  WEBHOOK       = 'WEBHOOK',
  REST_API      = 'REST_API',
  FHIR_ENDPOINT = 'FHIR_ENDPOINT',
  LAB_SYSTEM    = 'LAB_SYSTEM',
  PHARMACY      = 'PHARMACY',
  INSURANCE     = 'INSURANCE',
  ERP           = 'ERP',
  CUSTOM        = 'CUSTOM',
}

export enum IntegrationStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
  ERROR    = 'error',
  DELETED  = 'deleted',
}

@Schema({ collection: 'integration_configs', timestamps: true })
export class IntegrationConfig {
  @Prop({ default: uuidv4 }) integrationId: string;
  @Prop({ required: true, index: true }) tenantId: string;
  @Prop({ required: true }) name: string;

  @Prop({ type: String, enum: IntegrationStatus, default: IntegrationStatus.INACTIVE })
  status: IntegrationStatus;

  @Prop({ type: String, enum: IntegrationType, required: true })
  type: IntegrationType;

  @Prop({
    type: Object,
    default: {},
  })
  config: {
    webhookUrl?: string;
    httpMethod?: string;
    headers?: Record<string, string>;
    authType?: 'none' | 'bearer' | 'basic' | 'api_key';
    authConfig?: Record<string, string>;
    retryAttempts?: number;
    timeoutMs?: number;
  };

  @Prop({
    type: [Object],
    default: [],
  })
  triggers: Array<{
    event: string;
    formIds?: string[];
    conditions?: Record<string, any>;
    payloadTemplate?: string;
    enabled: boolean;
  }>;

  @Prop({
    type: Object,
    default: { totalCalled: 0, totalSuccess: 0, totalFailed: 0, lastCalledAt: null, lastStatus: null },
  })
  stats: {
    totalCalled: number;
    totalSuccess: number;
    totalFailed: number;
    lastCalledAt?: Date;
    lastStatus?: string;
  };
}

export const IntegrationConfigSchema = SchemaFactory.createForClass(IntegrationConfig);
IntegrationConfigSchema.index({ tenantId: 1, status: 1 });
