import {
  Controller, Get, Post, Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { RolesService } from './roles.service';

class AssignRoleDto {
  @IsString()
  roleId: string;

  @IsString()
  @IsOptional()
  tenantId?: string;

  @IsString()
  @IsOptional()
  assignedBy?: string;
}

@ApiTags('iam')
@Controller('iam')
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get('roles')
  @ApiOperation({ summary: 'List all roles, optionally filtered by tenantId' })
  @ApiResponse({ status: 200, description: 'Returns array of roles with their permissions' })
  findAll(@Query('tenantId') tenantId?: string) {
    return this.rolesService.findAll(tenantId);
  }

  @Post('users/:userId/roles')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a role to a user' })
  @ApiResponse({ status: 201, description: 'Returns the created user-role assignment' })
  assignRole(
    @Param('userId') userId: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.rolesService.assignRoleToUser(
      userId,
      dto.roleId,
      dto.tenantId ?? 'system',
      dto.assignedBy ?? 'admin',
    );
  }
}
