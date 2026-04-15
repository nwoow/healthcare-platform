import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PrismaService } from './prisma/prisma.service';
import { MongoLog } from './mongo/log.schema';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectModel(MongoLog.name) private readonly mongoLogModel: Model<MongoLog>,
  ) {}

  // Postgres CRUD
  async createPostgresNote(data: { title: string; content: string }) {
    return this.prisma.postgresNote.create({ data });
  }

  async getAllPostgresNotes() {
    return this.prisma.postgresNote.findMany();
  }

  async deletePostgresNote(id: string) {
    return this.prisma.postgresNote.delete({ where: { id } });
  }

  // Mongo CRUD
  async createMongoLog(data: { action: string; details: string; source?: string }) {
    const newLog = new this.mongoLogModel(data);
    return newLog.save();
  }

  async getAllMongoLogs() {
    return this.mongoLogModel.find().sort({ createdAt: -1 }).exec();
  }

  async deleteMongoLog(id: string) {
    return this.mongoLogModel.findByIdAndDelete(id);
  }
}
