import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  findAll(tenantId?: string) {
    return this.prisma.role.findMany({
      where: tenantId ? { tenantId } : undefined,
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  findByName(name: string, tenantId: string) {
    return this.prisma.role.findFirst({
      where: { name, tenantId },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  create(data: { name: string; tenantId: string; description?: string; isSystemRole?: boolean }) {
    return this.prisma.role.create({ data });
  }

  async assignPermission(roleId: string, permissionId: string, conditions?: any) {
    return this.prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId, conditions },
      update: { conditions },
    });
  }

  async getUserRolesWithPermissions(userId: string, tenantId: string) {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId, tenantId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    return userRoles.map((ur) => ur.role);
  }

  async assignRoleToUser(userId: string, roleId: string, tenantId: string, assignedBy: string) {
    return this.prisma.userRole.create({
      data: { userId, roleId, tenantId, assignedBy },
    });
  }
}
