import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { AuditService } from './audit.service';

const TOPICS_TO_CONSUME = [
  'tenant.provisioned',
  'auth.login.success',
  'auth.login.failed',
  'iam.policy.updated',
  'form.published',
  'submission.submitted',
  'workflow.started',
  'patient.history.updated',
  'audit.action.logged',
];

@Injectable()
export class AuditConsumers implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditConsumers.name);
  private consumers: Consumer[] = [];

  constructor(private auditService: AuditService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'audit-service',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });

    for (const topic of TOPICS_TO_CONSUME) {
      const consumer = kafka.consumer({ groupId: `audit-${topic.replace(/\./g, '-')}` });
      this.consumers.push(consumer);

      try {
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });
        await consumer.run({
          eachMessage: async ({ topic: t, message }) => {
            const raw = message.value?.toString() || '{}';
            let payload: Record<string, unknown> = {};
            try {
              payload = JSON.parse(raw);
            } catch {}

            const action = t.replace(/\./g, '_').toUpperCase();
            const actorId = String(
              payload.userId || payload.actorId || payload.tenantId || message.key?.toString() || '',
            );
            const resourceId = String(
              payload.submissionId || payload.formId || payload.patientId || payload.tenantId || '',
            );
            const tenantId = String(payload.tenantId || '');

            await this.auditService.log(
              t,
              action,
              payload,
              actorId || undefined,
              resourceId || undefined,
              tenantId || undefined,
            );
            this.logger.debug(`Logged audit for ${t}`);
          },
        });
        this.logger.log(`Audit consumer started for topic: ${topic}`);
      } catch (err) {
        this.logger.error(`Failed to start consumer for ${topic}`, err);
      }
    }
  }

  async onModuleDestroy() {
    for (const c of this.consumers) {
      try {
        await c.disconnect();
      } catch {}
    }
  }
}
