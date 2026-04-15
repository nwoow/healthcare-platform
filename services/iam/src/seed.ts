import { PrismaService } from './prisma/prisma.service';
import { RolesService } from './roles/roles.service';
import { PermissionsService } from './permissions/permissions.service';

const SYSTEM_TENANT = 'system';

const ROLE_PERMISSIONS: Record<string, { resource: string; action: string; description: string }[]> = {
  super_admin: [
    { resource: 'all', action: 'manage', description: 'Full access to everything' },
  ],
  tenant_admin: [
    { resource: 'form', action: 'manage', description: 'Manage forms' },
    { resource: 'submission', action: 'manage', description: 'Manage submissions' },
    { resource: 'user', action: 'manage', description: 'Manage users within tenant' },
  ],
  doctor: [
    { resource: 'form', action: 'read', description: 'Read forms' },
    { resource: 'form', action: 'submit', description: 'Submit forms' },
    { resource: 'submission', action: 'read', description: 'Read own submissions' },
  ],
  nurse: [
    { resource: 'form', action: 'read', description: 'Read nursing forms' },
    { resource: 'form', action: 'submit', description: 'Submit nursing forms' },
    { resource: 'submission', action: 'read', description: 'Read own submissions' },
  ],
  receptionist: [
    { resource: 'patient', action: 'create', description: 'Create patients' },
    { resource: 'appointment', action: 'read', description: 'Read appointments' },
  ],
};

export async function seedSystemRoles(
  prisma: PrismaService,
  rolesService: RolesService,
  permissionsService: PermissionsService,
) {
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const existing = await rolesService.findByName(roleName, SYSTEM_TENANT);
    let roleId: string;

    if (!existing) {
      const created = await rolesService.create({
        name: roleName,
        tenantId: SYSTEM_TENANT,
        description: `System role: ${roleName}`,
        isSystemRole: true,
      });
      roleId = created.id;
    } else {
      roleId = existing.id;
    }

    for (const perm of perms) {
      const permission = await permissionsService.findOrCreate(
        perm.resource,
        perm.action,
        perm.description,
      );
      await rolesService.assignPermission(roleId, permission.id);
    }
  }

  console.log('System roles seeded: super_admin, tenant_admin, doctor, nurse, receptionist');
}
