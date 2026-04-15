import { Module } from '@nestjs/common'
import { TenantController } from './tenant.controller'
import { TenantService } from './tenant.service'
import { PrismaService } from '../prisma/prisma.service'
import { KafkaProducerService } from '../kafka/kafka-producer.service'

@Module({
  controllers: [TenantController],
  providers: [TenantService, PrismaService, KafkaProducerService],
})
export class TenantModule {}
