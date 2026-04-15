import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { IntegrationService } from './integration.service';

const TOPICS = [
  'tenant.provisioned',
  'auth.login.success',
  'auth.login.failed',
  'iam.policy.updated',
  'form.published',
  'submission.submitted',
  'workflow.started',
  'patient.history.updated',
  'patient.abha.linked',
];

@Injectable()
export class IntegrationConsumers implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IntegrationConsumers.name);
  private consumers: Consumer[] = [];

  constructor(private integrationService: IntegrationService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'integration-service',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });

    for (const topic of TOPICS) {
      const consumer = kafka.consumer({ groupId: `integration-${topic.replace(/\./g, '-')}` });
      this.consumers.push(consumer);

      try {
        await consumer.connect();
        await consumer.subscribe({ topic, fromBeginning: false });
        await consumer.run({
          eachMessage: async ({ topic: t, message }) => {
            const raw = message.value?.toString() || '{}';
            let payload: Record<string, any> = {};
            try { payload = JSON.parse(raw); } catch {}
            await this.integrationService.processEvent(t, payload);
          },
        });
        this.logger.log(`Integration consumer started for: ${topic}`);
      } catch (err) {
        this.logger.error(`Failed to subscribe to ${topic}`, err);
      }
    }
  }

  async onModuleDestroy() {
    for (const c of this.consumers) {
      try { await c.disconnect(); } catch {}
    }
  }
}
