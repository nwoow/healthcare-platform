import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type FormDocument = FormSchema & Document;

@Schema({ _id: false })
export class FieldOption {
  @Prop({ required: true }) label: string;
  @Prop({ required: true }) value: string;
}

@Schema({ _id: false })
export class FormField {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) type: string; // text | textarea | number | date | dropdown | radio | checkbox | slider | file | repeater
  @Prop({ required: true }) label: string;
  @Prop() placeholder?: string;
  @Prop({ default: false }) required: boolean;
  @Prop() helpText?: string;
  @Prop() min?: number;
  @Prop() max?: number;
  @Prop({ type: [FieldOption], default: [] }) options: FieldOption[];
}

@Schema({ _id: false })
export class FormSection {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) title: string;
  @Prop() description?: string;
  @Prop({ type: [FormField], default: [] }) fields: FormField[];
}

@Schema({ _id: false })
export class ConditionalLogic {
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) fieldId: string;   // source field
  @Prop({ required: true }) operator: string;  // eq | neq | gt | lt | contains
  @Prop({ required: true }) value: string;
  @Prop({ required: true }) action: string;    // show | hide
  @Prop({ required: true }) targetId: string;  // field or section id
}

@Schema({ _id: false })
export class AccessControl {
  @Prop({ type: [String], default: [] }) roles: string[];
  @Prop({ type: Object, default: {} }) attributes: Record<string, any>;
}

@Schema({ collection: 'form_schemas', timestamps: true })
export class FormSchema {
  @Prop({ default: uuidv4 }) form_id: string;
  @Prop({ required: true }) tenant_id: string;
  @Prop({ required: true }) name: string;
  @Prop() description?: string;
  @Prop() specialty?: string;
  @Prop({ default: 1 }) version: number;
  @Prop({ type: [FormSection], default: [] }) sections: FormSection[];
  @Prop({ type: [ConditionalLogic], default: [] }) conditional_logic: ConditionalLogic[];
  @Prop({ type: AccessControl, default: () => ({ roles: [], attributes: {} }) }) access_control: AccessControl;
  @Prop({ enum: ['wizard', 'accordion', 'tabs'], default: 'wizard' }) layoutType: string;
  @Prop({ enum: ['draft', 'published'], default: 'draft' }) status: string;
  @Prop() created_by?: string;
}

export const FormSchemaSchema = SchemaFactory.createForClass(FormSchema);
