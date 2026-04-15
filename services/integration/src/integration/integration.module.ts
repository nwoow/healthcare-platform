import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { IntegrationConsumers } from './integration.consumers';
import { IntegrationConfig, IntegrationConfigSchema } from '../schemas/integration-config.schema';
import { IntegrationLog, IntegrationLogSchema } from '../schemas/integration-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationConfig.name, schema: IntegrationConfigSchema },
      { name: IntegrationLog.name, schema: IntegrationLogSchema },
    ]),
  ],
  providers: [IntegrationService, IntegrationConsumers],
  controllers: [IntegrationController],
})
export class IntegrationModule {}
