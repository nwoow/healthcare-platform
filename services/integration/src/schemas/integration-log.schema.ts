import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type IntegrationLogDocument = IntegrationLog & Document;

@Schema({ collection: 'integration_logs', timestamps: false })
export class IntegrationLog {
  @Prop({ default: uuidv4 }) logId: string;
  @Prop({ required: true, index: true }) integrationId: string;
  @Prop({ required: true }) tenantId: string;
  @Prop({ required: true }) event: string;
  @Prop() submissionId?: string;
  @Prop({ type: Object, default: {} }) requestPayload: Record<string, any>;
  @Prop() responseStatus?: number;
  @Prop() responseBody?: string;
  @Prop() durationMs?: number;
  @Prop({ default: false }) success: boolean;
  @Prop() errorMessage?: string;
  @Prop({ default: Date.now, index: true }) timestamp: Date;
}

export const IntegrationLogSchema = SchemaFactory.createForClass(IntegrationLog);
IntegrationLogSchema.index({ integrationId: 1, timestamp: -1 });
