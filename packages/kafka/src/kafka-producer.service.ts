import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Kafka, Producer } from 'kafkajs'

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name)
  private producer: Producer

  constructor() {
    const kafka = new Kafka({
      clientId: 'healthcare-producer',
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    })
    this.producer = kafka.producer()
  }

  async onModuleInit() {
    try {
      await this.producer.connect()
      this.logger.log('Kafka producer connected')
    } catch (err) {
      this.logger.error('Kafka producer connect failed', err)
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect()
    } catch {}
  }

  async publish(topic: string, message: object, key = 'default') {
    try {
      await this.producer.send({
        topic,
        messages: [{ key, value: JSON.stringify(message) }],
      })
    } catch (err) {
      this.logger.error(`Failed to publish to ${topic}`, err)
    }
  }
}
