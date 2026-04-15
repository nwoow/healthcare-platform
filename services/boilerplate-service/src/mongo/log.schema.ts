import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true, collection: 'mongo_logs' })
export class MongoLog extends Document {
  @Prop({ required: true })
  action: string;

  @Prop({ required: true })
  details: string;

  @Prop({ default: 'SYSTEM' })
  source: string;
}

export const MongoLogSchema = SchemaFactory.createForClass(MongoLog);
