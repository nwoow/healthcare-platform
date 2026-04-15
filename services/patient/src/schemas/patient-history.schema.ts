import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type PatientHistoryDocument = PatientHistory & Document

@Schema({ collection: 'patient_histories', timestamps: true })
export class PatientHistory {
  @Prop({ required: true, index: true }) patientId: string
  @Prop({ required: true, index: true }) tenantId: string
  @Prop({
    type: {
      prevEndoscopy: { type: Boolean, default: false },
      prevSurgery: { type: Boolean, default: false },
      chronicConditions: { type: [String], default: [] },
      allergies: { type: [String], default: [] },
      medications: [{
        name: String,
        dose: String,
        frequency: String,
      }],
      smokingStatus: String,
      alcoholUse: String,
      familyHistory: { type: [String], default: [] },
    },
    default: {},
  })
  historyFlags: {
    prevEndoscopy?: boolean
    prevSurgery?: boolean
    chronicConditions?: string[]
    allergies?: string[]
    medications?: Array<{ name: string; dose: string; frequency: string }>
    smokingStatus?: string
    alcoholUse?: string
    familyHistory?: string[]
  }
  @Prop({ type: Date, default: Date.now }) lastUpdated: Date
}

export const PatientHistorySchema = SchemaFactory.createForClass(PatientHistory)
