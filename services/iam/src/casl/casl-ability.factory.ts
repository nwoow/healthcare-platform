import { Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { RolesService } from '../roles/roles.service';

export type AppAbility = MongoAbility;

@Injectable()
export class CaslAbilityFactory {
  constructor(private rolesService: RolesService) {}

  async createForUser(userId: string, tenantId: string): Promise<AppAbility> {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const roles = await this.rolesService.getUserRolesWithPermissions(userId, tenantId);

    for (const role of roles) {
      for (const rp of role.rolePermissions) {
        const { resource, action } = rp.permission;

        if (action === 'manage' && resource === 'all') {
          can('manage', 'all');
        } else {
          can(action, resource, rp.conditions as any ?? undefined);
        }
      }
    }

    return build();
  }
}
