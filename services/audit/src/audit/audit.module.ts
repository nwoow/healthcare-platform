import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditConsumers } from './audit.consumers';

@Module({
  providers: [AuditService, AuditConsumers],
  controllers: [AuditController],
})
export class AuditModule {}
