import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { CaslAbilityFactory } from './casl-ability.factory';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) throw new ForbiddenException('No user in request');

    const tenantId = request.headers['x-tenant-id'] || 'system';
    const ability = await this.caslAbilityFactory.createForUser(user.id, tenantId);

    const allowed = requiredRoles.some((role) => ability.can(role, 'all'));
    if (!allowed) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}
