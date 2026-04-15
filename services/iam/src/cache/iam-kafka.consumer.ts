import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer } from 'kafkajs';
import { RedisCacheService } from './redis-cache.service';

@Injectable()
export class IamKafkaConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IamKafkaConsumer.name);
  private consumer: Consumer;

  constructor(private cache: RedisCacheService) {}

  async onModuleInit() {
    const kafka = new Kafka({
      clientId: 'iam-service-consumer',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    });
    this.consumer = kafka.consumer({ groupId: 'iam-policy-invalidation' });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({ topic: 'iam.policy.updated', fromBeginning: false });
      await this.consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString() || '{}';
          let payload: { userId?: string } = {};
          try { payload = JSON.parse(raw); } catch {}

          if (payload.userId) {
            await this.cache.del(this.cache.userCachePattern(payload.userId));
            this.logger.log(`Cache invalidated for user ${payload.userId}`);
          } else {
            // Broad invalidation when no userId specified
            await this.cache.del('iam:eval:*');
            this.logger.log('Full IAM eval cache invalidated');
          }
        },
      });
      this.logger.log('IAM Kafka consumer started (iam.policy.updated)');
    } catch (err) {
      this.logger.error('IAM Kafka consumer failed to start', err);
    }
  }

  async onModuleDestroy() {
    try { await this.consumer.disconnect(); } catch {}
  }
}
