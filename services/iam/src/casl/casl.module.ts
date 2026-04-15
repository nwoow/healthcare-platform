import { Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { RolesGuard } from './roles.guard';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [RolesModule],
  providers: [CaslAbilityFactory, RolesGuard],
  exports: [CaslAbilityFactory, RolesGuard],
})
export class CaslModule {}
