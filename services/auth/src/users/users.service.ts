import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(email: string, password: string, name?: string, tenantId?: string) {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: { email, passwordHash, name, tenantId },
    });
  }

  async findAll(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        tenantId: true,
        isActive: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureAdminExists() {
    const existing = await this.findByEmail('admin@hospital.com');
    if (!existing) {
      await this.create('admin@hospital.com', 'Admin@123', 'Hospital Admin', 'system');
    }
    const superAdmin = await this.findByEmail('superadmin@platform.com');
    if (!superAdmin) {
      await this.create('superadmin@platform.com', 'SuperAdmin@123', 'Super Admin', 'PLATFORM');
    }
  }
}
