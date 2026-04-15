import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PatientHistoryDocument = PatientHistory & Document

@Schema({ collection: 'patient_histories', timestamps: true })
export class PatientHistory {
  @Prop({ required: true }) patientId: string
  @Prop({ required: true }) visitDate: Date
  @Prop({ required: true }) doctorId: string
  @Prop({ required: true }) diagnosis: string
  @Prop({ type: [String], default: [] }) medications: string[]
  @Prop({ type: Object, default: {} }) vitals: Record<string, unknown>
  @Prop({ type: [Object], default: [] }) attachments: Record<string, unknown>[]
  @Prop() notes: string
}

export const PatientHistorySchema = SchemaFactory.createForClass(PatientHistory)
