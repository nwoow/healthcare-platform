import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { IntegrationConfig, IntegrationConfigDocument, IntegrationStatus } from '../schemas/integration-config.schema';
import { IntegrationLog, IntegrationLogDocument } from '../schemas/integration-log.schema';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectModel(IntegrationConfig.name) private configModel: Model<IntegrationConfigDocument>,
    @InjectModel(IntegrationLog.name) private logModel: Model<IntegrationLogDocument>,
  ) {}

  async create(dto: Partial<IntegrationConfig>): Promise<IntegrationConfigDocument> {
    return this.configModel.create(dto);
  }

  async findAll(tenantId: string): Promise<IntegrationConfigDocument[]> {
    return this.configModel
      .find({ tenantId, status: { $ne: IntegrationStatus.DELETED } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<IntegrationConfigDocument> {
    const doc = await this.configModel.findById(id).exec();
    if (!doc) throw new NotFoundException(`Integration ${id} not found`);
    return doc;
  }

  async update(id: string, dto: Partial<IntegrationConfig>): Promise<IntegrationConfigDocument> {
    await this.findOne(id);
    return this.configModel.findByIdAndUpdate(id, dto, { new: true }).exec() as Promise<IntegrationConfigDocument>;
  }

  async softDelete(id: string): Promise<IntegrationConfigDocument> {
    return this.configModel.findByIdAndUpdate(id, { status: IntegrationStatus.DELETED }, { new: true }).exec() as Promise<IntegrationConfigDocument>;
  }

  async toggleStatus(id: string): Promise<IntegrationConfigDocument> {
    const doc = await this.findOne(id);
    const newStatus = doc.status === IntegrationStatus.ACTIVE ? IntegrationStatus.INACTIVE : IntegrationStatus.ACTIVE;
    return this.configModel.findByIdAndUpdate(id, { status: newStatus }, { new: true }).exec() as Promise<IntegrationConfigDocument>;
  }

  async testConnection(id: string): Promise<{ success: boolean; statusCode?: number; durationMs: number; error?: string }> {
    const integration = await this.findOne(id);
    const url = integration.config?.webhookUrl;
    if (!url) return { success: false, durationMs: 0, error: 'No webhook URL configured' };

    const start = Date.now();
    try {
      const headers = this.buildHeaders(integration);
      const response = await axios.post(url, { test: true, integrationId: id, timestamp: new Date() }, {
        headers,
        timeout: integration.config?.timeoutMs || 5000,
      });
      const durationMs = Date.now() - start;
      return { success: true, statusCode: response.status, durationMs };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      return {
        success: false,
        statusCode: err?.response?.status,
        durationMs,
        error: err?.message || 'Request failed',
      };
    }
  }

  async processEvent(topic: string, payload: Record<string, any>): Promise<void> {
    const tenantId = payload.tenantId || '';
    if (!tenantId) return;

    const integrations = await this.configModel.find({
      tenantId,
      status: IntegrationStatus.ACTIVE,
      'triggers.event': topic,
      'triggers.enabled': true,
    }).exec();

    for (const integration of integrations) {
      const matchingTriggers = integration.triggers.filter(t => t.event === topic && t.enabled);
      for (const trigger of matchingTriggers) {
        await this.callWebhook(integration, trigger, topic, payload);
      }
    }
  }

  private buildHeaders(integration: IntegrationConfigDocument): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(integration.config?.headers || {}),
    };
    const { authType, authConfig } = integration.config || {};
    if (authType === 'bearer' && authConfig?.token) {
      headers['Authorization'] = `Bearer ${authConfig.token}`;
    } else if (authType === 'api_key' && authConfig?.key && authConfig?.headerName) {
      headers[authConfig.headerName] = authConfig.key;
    } else if (authType === 'basic' && authConfig?.username && authConfig?.password) {
      const encoded = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    }
    return headers;
  }

  private buildPayload(trigger: any, eventPayload: Record<string, any>): Record<string, any> {
    if (!trigger.payloadTemplate) return eventPayload;
    try {
      let template = trigger.payloadTemplate;
      Object.entries(eventPayload).forEach(([key, value]) => {
        template = template.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
      });
      return JSON.parse(template);
    } catch {
      return eventPayload;
    }
  }

  private async callWebhook(
    integration: IntegrationConfigDocument,
    trigger: any,
    topic: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const url = integration.config?.webhookUrl;
    if (!url) return;

    const retryAttempts = integration.config?.retryAttempts ?? 3;
    const timeout = integration.config?.timeoutMs ?? 5000;
    const requestPayload = this.buildPayload(trigger, payload);
    const headers = this.buildHeaders(integration);

    let success = false;
    let responseStatus: number | undefined;
    let responseBody: string | undefined;
    let errorMessage: string | undefined;
    const start = Date.now();

    for (let attempt = 0; attempt < retryAttempts && !success; attempt++) {
      try {
        const response = await axios.post(url, requestPayload, { headers, timeout });
        responseStatus = response.status;
        responseBody = JSON.stringify(response.data).slice(0, 500);
        success = true;
      } catch (err: any) {
        responseStatus = err?.response?.status;
        responseBody = err?.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : undefined;
        errorMessage = err?.message;
        if (attempt < retryAttempts - 1) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    const durationMs = Date.now() - start;

    // Save log
    try {
      await this.logModel.create({
        integrationId: String(integration._id),
        tenantId: integration.tenantId,
        event: topic,
        submissionId: payload.submissionId,
        requestPayload,
        responseStatus,
        responseBody,
        durationMs,
        success,
        errorMessage,
        timestamp: new Date(),
      });
    } catch { /* non-critical */ }

    // Update stats
    try {
      const update: Record<string, any> = {
        $inc: {
          'stats.totalCalled': 1,
          'stats.totalSuccess': success ? 1 : 0,
          'stats.totalFailed': success ? 0 : 1,
        },
        $set: {
          'stats.lastCalledAt': new Date(),
          'stats.lastStatus': success ? 'success' : 'failed',
          status: success ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR,
        },
      };
      await this.configModel.findByIdAndUpdate(integration._id, update).exec();
    } catch { /* non-critical */ }
  }

  async getLogs(integrationId: string, limit = 50): Promise<IntegrationLogDocument[]> {
    return this.logModel.find({ integrationId }).sort({ timestamp: -1 }).limit(limit).exec();
  }
}
