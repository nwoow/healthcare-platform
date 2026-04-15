import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: Redis;

  onModuleInit() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.logger.log('Redis client initialized');
  }

  async onModuleDestroy() {
    try { await this.client.quit(); } catch {}
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.client.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch { return null; }
  }

  async set(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {}
  }

  async del(pattern: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) await this.client.del(...keys);
    } catch {}
  }

  evaluateCacheKey(userId: string, tenantId: string, action: string, resource: string, resourceId?: string): string {
    return `iam:eval:${userId}:${tenantId}:${action}:${resource}:${resourceId || '*'}`;
  }

  userCachePattern(userId: string): string {
    return `iam:eval:${userId}:*`;
  }
}
