import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { Kafka, Consumer } from 'kafkajs'

@Injectable()
export class KafkaConsumerService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name)
  private consumers: Consumer[] = []

  async subscribe(
    topic: string,
    groupId: string,
    handler: (message: string) => Promise<void>,
  ) {
    const kafka = new Kafka({
      clientId: `healthcare-consumer-${groupId}`,
      brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
    })
    const consumer = kafka.consumer({ groupId })
    this.consumers.push(consumer)
    try {
      await consumer.connect()
      await consumer.subscribe({ topic, fromBeginning: false })
      await consumer.run({
        eachMessage: async ({ message }) => {
          const value = message.value?.toString() || '{}'
          try {
            await handler(value)
          } catch (err) {
            this.logger.error(`Error handling message from ${topic}`, err)
          }
        },
      })
      this.logger.log(`Subscribed to ${topic} with groupId ${groupId}`)
    } catch (err) {
      this.logger.error(`Failed to subscribe to ${topic}`, err)
    }
  }

  async onModuleDestroy() {
    for (const c of this.consumers) {
      try { await c.disconnect() } catch {}
    }
  }
}
