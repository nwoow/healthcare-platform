import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.permission.findMany();
  }

  findOne(id: string) {
    return this.prisma.permission.findUnique({ where: { id } });
  }

  create(resource: string, action: string, description?: string) {
    return this.prisma.permission.create({ data: { resource, action, description } });
  }

  async findOrCreate(resource: string, action: string, description?: string) {
    const existing = await this.prisma.permission.findFirst({
      where: { resource, action },
    });
    if (existing) return existing;
    return this.create(resource, action, description);
  }
}
