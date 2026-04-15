import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FormVersionDocument = FormVersion & Document;

@Schema({ collection: 'form_versions', timestamps: true })
export class FormVersion {
  @Prop({ required: true }) form_id: string;
  @Prop({ required: true }) version: number;
  @Prop({ required: true }) tenant_id: string;
  @Prop({ required: true }) name: string;
  @Prop({ type: Object, required: true }) snapshot: Record<string, any>; // full form snapshot
  @Prop() published_by?: string;
  @Prop({ default: () => new Date() }) published_at: Date;
}

export const FormVersionSchema = SchemaFactory.createForClass(FormVersion);
