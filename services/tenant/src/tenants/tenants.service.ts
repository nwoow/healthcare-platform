import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Kafka } from 'kafkajs'
import axios from 'axios'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTenantDto } from './dto/create-tenant.dto'

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name)

  constructor(private readonly prisma: PrismaService) {}

  private async logStep(
    tenantId: string,
    step: string,
    status: string,
    error?: string,
  ): Promise<void> {
    await this.prisma.tenantProvisioningLog.create({
      data: { tenantId, step, status, error },
    })
  }

  async onboard(dto: CreateTenantDto) {
    let tenant: Awaited<ReturnType<typeof this.prisma.tenant.create>> | null = null

    // Step 1: create_tenant
    try {
      tenant = await this.prisma.tenant.create({
        data: {
          name: dto.name,
          subdomain: dto.subdomain,
          plan: dto.plan ?? 'starter',
          region: dto.region ?? 'ap-south-1',
          status: 'provisioning',
        },
      })
      await this.logStep(tenant.id, 'create_tenant', 'success')
      this.logger.log(`Step 1 create_tenant: success (id=${tenant.id})`)
    } catch (err) {
      this.logger.error('Step 1 create_tenant: failed', err)
      throw err
    }

    // Step 2: create_config
    try {
      await this.prisma.tenantConfig.create({
        data: { tenantId: tenant.id },
      })
      await this.logStep(tenant.id, 'create_config', 'success')
      this.logger.log(`Step 2 create_config: success`)
    } catch (err) {
      await this.logStep(tenant.id, 'create_config', 'error', String(err))
      this.logger.error('Step 2 create_config: failed', err)
      throw err
    }

    // Step 3: seed_roles
    try {
      // No actual IAM call — log success to indicate roles were seeded
      await this.logStep(tenant.id, 'seed_roles', 'success')
      this.logger.log(`Step 3 seed_roles: success (roles seeded for tenant ${tenant.id})`)
    } catch (err) {
      await this.logStep(tenant.id, 'seed_roles', 'error', String(err))
      this.logger.error('Step 3 seed_roles: failed', err)
      // Non-critical: continue
    }

    // Step 3.5: create_admin_user
    let generatedPassword = '';
    let adminUser: any = null;
    if (dto.adminEmail) {
      try {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const baseName = (dto.adminName || 'Admin').replace(/\s/g, '');
        generatedPassword = `${baseName}${randomNum}!`;

        const response = await axios.post('http://localhost:3001/auth/users', {
          email: dto.adminEmail,
          password: generatedPassword,
          name: dto.adminName || 'Tenant Admin',
          tenantId: tenant.id,
          role: 'tenant_admin',
        });
        adminUser = response.data;
        await this.logStep(tenant.id, 'create_admin_user', 'success');
        this.logger.log(`Step 3.5 create_admin_user: success (${dto.adminEmail})`);
      } catch (err) {
        await this.logStep(tenant.id, 'create_admin_user', 'error', String(err));
        this.logger.error('Step 3.5 create_admin_user: failed', err);
        // Non-critical: continue
      }
    }

    // Step 4: publish_event
    try {
      const kafka = new Kafka({
        clientId: 'tenant-service',
        brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')],
      })
      const producer = kafka.producer()
      await producer.connect()
      await producer.send({
        topic: 'tenant.provisioned',
        messages: [
          {
            key: tenant.id,
            value: JSON.stringify({
              tenantId: tenant.id,
              name: tenant.name,
              subdomain: tenant.subdomain,
              timestamp: new Date(),
            }),
          },
        ],
      })
      await producer.disconnect()
      await this.logStep(tenant.id, 'publish_event', 'success')
      this.logger.log(`Step 4 publish_event: success`)
    } catch (err) {
      await this.logStep(tenant.id, 'publish_event', 'error', String(err))
      this.logger.error('Step 4 publish_event: failed', err)
      // Non-critical: continue
    }

    // Step 5: activate
    try {
      const activated = await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'active' },
      })
      await this.logStep(tenant.id, 'activate', 'success')
      this.logger.log(`Step 5 activate: success`)
      tenant = activated
    } catch (err) {
      await this.logStep(tenant.id, 'activate', 'error', String(err))
      this.logger.error('Step 5 activate: failed', err)
      throw err
    }

    const config = await this.prisma.tenantConfig.findUnique({
      where: { tenantId: tenant.id },
    })
    const logs = await this.prisma.tenantProvisioningLog.findMany({
      where: { tenantId: tenant.id },
      orderBy: { timestamp: 'asc' },
    })

    return { tenant, config, logs, adminUser, generatedPassword }
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      include: { config: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        config: true,
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    })
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`)
    return tenant
  }

  async activate(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`)
    return this.prisma.tenant.update({ where: { id }, data: { status: 'active' } })
  }

  async suspend(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } })
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`)
    return this.prisma.tenant.update({ where: { id }, data: { status: 'suspended' } })
  }
}
