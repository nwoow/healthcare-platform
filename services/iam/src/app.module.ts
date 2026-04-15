import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { CaslModule } from './casl/casl.module';
import { AttributesModule } from './attributes/attributes.module';
import { PoliciesModule } from './policies/policies.module';
import { CacheModule } from './cache/cache.module';
import { AttributesService } from './attributes/attributes.service';
import { PoliciesService } from './policies/policies.service';
import { RedisCacheService } from './cache/redis-cache.service';
import { EvaluateController } from './evaluate/evaluate.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PermissionsModule,
    RolesModule,
    CaslModule,
    AttributesModule,
    PoliciesModule,
    CacheModule,
  ],
  controllers: [EvaluateController],
  providers: [],
})
export class AppModule {}
