import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CaslAbilityFactory } from '../casl/casl-ability.factory';
import { RolesService } from '../roles/roles.service';
import { AttributesService } from '../attributes/attributes.service';
import { PoliciesService } from '../policies/policies.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { EvaluateDto } from './evaluate.dto';

@ApiTags('iam')
@Controller('iam')
export class EvaluateController {
  constructor(
    private caslAbilityFactory: CaslAbilityFactory,
    private rolesService: RolesService,
    private attributesService: AttributesService,
    private policiesService: PoliciesService,
    private cache: RedisCacheService,
  ) {}

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate if a user can perform an action on a resource (ABAC + RBAC, Redis-cached)' })
  @ApiResponse({ status: 200, description: 'Returns allowed boolean and reason' })
  async evaluate(@Body() dto: EvaluateDto) {
    const cacheKey = this.cache.evaluateCacheKey(
      dto.userId,
      dto.tenantId || 'system',
      dto.action,
      dto.resource,
      dto.resourceId,
    );

    // Check cache first
    const cached = await this.cache.get<{ allowed: boolean; reason: string }>(cacheKey);
    if (cached) return { ...cached, cached: true };

    try {
      // --- RBAC check via CASL ---
      const roles = await this.rolesService.getUserRolesWithPermissions(dto.userId, dto.tenantId || 'system');
      const isSuperAdmin = roles.some(r => r.name === 'super_admin');
      if (isSuperAdmin) {
        return { allowed: true, reason: 'super_admin bypass', cached: false };
      }

      const ability = await this.caslAbilityFactory.createForUser(
        dto.userId,
        dto.tenantId || 'system',
      );
      const rbacAllowed = ability.can(dto.action, dto.resource);

      if (!rbacAllowed) {
        const result = {
          allowed: false,
          reason: `User is not permitted to ${dto.action} on ${dto.resource}`,
        };
        await this.cache.set(cacheKey, result, 60);
        return result;
      }

      // --- ABAC check: if resourceId provided, evaluate resource policies ---
      if (dto.resourceId) {
        const policies = await this.policiesService.findForResource(dto.resource, dto.resourceId);
        if (policies.length > 0) {
          const userAttrs = await this.attributesService.getAttributesMap(dto.userId);
          const abacAllowed = policies.some((p) =>
            this.policiesService.evaluateAttributes(
              userAttrs,
              p.attributeConditions as Record<string, unknown>,
            ),
          );
          const result = {
            allowed: abacAllowed,
            reason: abacAllowed
              ? `ABAC conditions satisfied for ${dto.action} on ${dto.resource}/${dto.resourceId}`
              : `ABAC conditions not met for ${dto.action} on ${dto.resource}/${dto.resourceId}`,
          };
          await this.cache.set(cacheKey, result, 60);
          return result;
        }
      }

      const result = {
        allowed: true,
        reason: `User is permitted to ${dto.action} on ${dto.resource}`,
      };
      await this.cache.set(cacheKey, result, 60);
      return result;
    } catch {
      return { allowed: false, reason: 'Error evaluating permissions' };
    }
  }

  @Get('users/:userId/roles')
  @ApiOperation({ summary: 'Get roles assigned to a user' })
  @ApiResponse({ status: 200, description: 'Returns array of roles for the user' })
  async getUserRoles(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId: string = 'system',
  ) {
    return this.rolesService.getUserRolesWithPermissions(userId, tenantId);
  }
}
