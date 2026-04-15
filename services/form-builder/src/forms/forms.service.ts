import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FormSchema, FormDocument } from '../schemas/form.schema';
import { FormVersion, FormVersionDocument } from '../schemas/form-version.schema';
import { CreateFormDto } from './dto/create-form.dto';
import { Kafka } from 'kafkajs';

@Injectable()
export class FormsService {
  constructor(
    @InjectModel(FormSchema.name) private formModel: Model<FormDocument>,
    @InjectModel(FormVersion.name) private formVersionModel: Model<FormVersionDocument>,
  ) {}

  private async publishKafka(topic: string, message: object, key: string): Promise<void> {
    const kafka = new Kafka({
      clientId: 'form-builder-service',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });
    const producer = kafka.producer();
    try {
      await producer.connect();
      await producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(message) }],
      });
    } catch (err) {
      // fire-and-forget: swallow errors so Kafka never breaks form-builder flow
    } finally {
      try { await producer.disconnect(); } catch {}
    }
  }

  async create(dto: CreateFormDto, userId?: string): Promise<FormDocument> {
    const form = new this.formModel({
      ...dto,
      created_by: userId || dto.created_by,
      status: 'draft',
      version: 1,
    });
    return form.save();
  }

  async findAll(tenantId?: string): Promise<FormDocument[]> {
    const filter = tenantId ? { tenant_id: tenantId } : {};
    return this.formModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<FormDocument> {
    const form = await this.formModel.findById(id).exec();
    if (!form) throw new NotFoundException(`Form ${id} not found`);
    return form;
  }

  async update(id: string, dto: Partial<CreateFormDto>): Promise<FormDocument> {
    const form = await this.findOne(id);
    Object.assign(form, dto);
    form.version = (form.version || 1) + 1;
    // Editing a published form creates a new draft that must be re-published
    if (form.status === 'published') {
      form.status = 'draft';
    }
    return form.save();
  }

  async publish(id: string, userId?: string): Promise<FormDocument> {
    const form = await this.findOne(id);

    // Save a version snapshot
    await this.formVersionModel.create({
      form_id: form._id.toString(),
      version: form.version,
      tenant_id: form.tenant_id,
      name: form.name,
      snapshot: form.toObject(),
      published_by: userId,
    });

    form.status = 'published';
    const saved = await form.save();

    this.publishKafka(
      'form.published',
      {
        formId: saved._id?.toString(),
        tenantId: saved.tenant_id,
        name: saved.name,
        version: saved.version,
        publishedBy: userId,
        timestamp: new Date(),
      },
      saved._id?.toString() || '',
    ).catch(() => {});

    return saved;
  }

  async getVersions(id: string): Promise<FormVersionDocument[]> {
    return this.formVersionModel
      .find({ form_id: id })
      .sort({ version: -1 })
      .exec();
  }

  async findAccessible(userId: string, role: string, tenantId?: string): Promise<FormDocument[]> {
    // Fetch all published forms for the tenant first, then filter by role in JS.
    // This avoids Mongoose subdocument array query ambiguity.
    const filter: Record<string, unknown> = { status: 'published' };
    if (tenantId) filter.tenant_id = tenantId;

    const forms = await this.formModel.find(filter).sort({ createdAt: -1 }).exec();

    return forms.filter((form) => {
      const roles: string[] = form.access_control?.roles ?? [];
      // If no roles set on form, visible to all. Otherwise check membership.
      return roles.length === 0 || roles.includes(role);
    });
  }
}
