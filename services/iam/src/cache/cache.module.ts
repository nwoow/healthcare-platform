import { Module } from '@nestjs/common';
import { RedisCacheService } from './redis-cache.service';
import { IamKafkaConsumer } from './iam-kafka.consumer';

@Module({
  providers: [RedisCacheService, IamKafkaConsumer],
  exports: [RedisCacheService],
})
export class CacheModule {}
