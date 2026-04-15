import { Injectable, Logger, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { KafkaProducerService } from '../kafka/kafka-producer.service'
import { OnboardTenantDto } from './dto/onboard-tenant.dto'
import axios from 'axios'

const IAM_URL = process.env.IAM_URL || 'http://localhost:3002'
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:3001'
const DEFAULT_ROLES = ['super_admin', 'tenant_admin', 'doctor', 'nurse', 'receptionist']

function generatePassword(name: string): string {
  const base = (name || 'Admin').replace(/\s+/g, '').replace(/[^a-zA-Z]/g, '').slice(0, 6) || 'Admin'
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return base.charAt(0).toUpperCase() + base.slice(1) + digits + '!'
}

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name)

  constructor(
    private prisma: PrismaService,
    private kafkaProducer: KafkaProducerService,
  ) {}

  private async log(tenantId: string, step: string, status: string, error?: string) {
    await this.prisma.tenantProvisioningLog.create({
      data: { tenantId, step, status, error },
    })
  }

  async onboard(dto: OnboardTenantDto) {
    const existing = await this.prisma.tenant.findUnique({ where: { subdomain: dto.subdomain } })
    if (existing) throw new ConflictException(`Subdomain ${dto.subdomain} already exists`)

    // Step 1: Create tenant record
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        subdomain: dto.subdomain,
        plan: dto.plan || 'starter',
        region: dto.region || 'ap-south-1',
        status: 'provisioning',
        adminEmail: dto.adminEmail || null,
      },
    })
    await this.log(tenant.id, 'create_tenant', 'success')

    // Step 2: Create config
    await this.prisma.tenantConfig.create({
      data: { tenantId: tenant.id },
    })
    await this.log(tenant.id, 'create_config', 'success')

    // Step 3: Resolve tenant_admin role from system roles
    // System roles are shared across all tenants — look them up, don't create per-tenant copies
    let tenantAdminRoleId: string | null = null
    try {
      const rolesRes = await axios.get(`${IAM_URL}/iam/roles?tenantId=system`).catch(() => null)
      const roles: Array<{ id: string; name: string }> = rolesRes?.data ?? []
      tenantAdminRoleId = roles.find(r => r.name === 'tenant_admin')?.id ?? null
      await this.log(tenant.id, 'seed_roles', 'success')
    } catch (err) {
      await this.log(tenant.id, 'seed_roles', 'error', String(err))
    }

    // Step 4: Create admin user (if adminEmail provided)
    let generatedPassword: string | null = null
    if (dto.adminEmail) {
      try {
        generatedPassword = generatePassword(dto.adminName || dto.adminEmail)
        const userRes = await axios.post(`${AUTH_URL}/auth/users`, {
          email: dto.adminEmail,
          password: generatedPassword,
          name: dto.adminName || undefined,
          tenantId: tenant.id,
        })
        const newUserId: string = userRes.data?.id

        // Assign tenant_admin role via IAM
        if (newUserId && tenantAdminRoleId) {
          await axios.post(`${IAM_URL}/iam/users/${newUserId}/roles`, {
            roleId: tenantAdminRoleId,
            tenantId: tenant.id,
            assignedBy: 'system',
          }).catch(() => {})
        }
        await this.log(tenant.id, 'create_admin', 'success')
      } catch (err) {
        generatedPassword = null
        await this.log(tenant.id, 'create_admin', 'error', String(err))
      }
    }

    // Step 5: Publish Kafka event
    try {
      await this.kafkaProducer.publish('tenant.provisioned', {
        tenantId: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        timestamp: new Date().toISOString(),
      }, tenant.id)
      await this.log(tenant.id, 'publish_event', 'success')
    } catch (err) {
      await this.log(tenant.id, 'publish_event', 'error', String(err))
    }

    // Step 6: Activate
    const activated = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { status: 'active' },
    })
    await this.log(tenant.id, 'activate', 'success')

    const result = await this.findOne(activated.id)
    return { ...result, generatedPassword, adminEmail: dto.adminEmail }
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: { config: true, logs: { orderBy: { timestamp: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: { config: true, logs: { orderBy: { timestamp: 'asc' } } },
    })
  }

  async updateStatus(id: string, status: string) {
    return this.prisma.tenant.update({ where: { id }, data: { status } })
  }

  async getLogs(id: string) {
    return this.prisma.tenantProvisioningLog.findMany({
      where: { tenantId: id },
      orderBy: { timestamp: 'asc' },
    })
  }

  async updateAbdmConfig(id: string, dto: {
    abdmEnabled?: boolean
    abdmFacilityId?: string
    abdmHipId?: string
    abdmHiuId?: string
    abdmSandboxMode?: boolean
  }) {
    return this.prisma.tenantConfig.upsert({
      where: { tenantId: id },
      create: { tenantId: id, ...dto },
      update: dto,
    })
  }

  async getAbdmStatus(id: string) {
    const config = await this.prisma.tenantConfig.findUnique({ where: { tenantId: id } })
    // Count patients with ABHA linked for this tenant — requires calling patient service
    // For now return config + placeholder stats
    const patientsWithAbha = 0
    const totalPatients = 0
    return {
      abdmEnabled: config?.abdmEnabled ?? false,
      abdmFacilityId: config?.abdmFacilityId ?? null,
      abdmHipId: config?.abdmHipId ?? null,
      abdmHiuId: config?.abdmHiuId ?? null,
      abdmSandboxMode: config?.abdmSandboxMode ?? true,
      patientsWithAbha,
      linkageRate: totalPatients > 0 ? Math.round((patientsWithAbha / totalPatients) * 100) : 0,
    }
  }
}
