import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttributesService {
  constructor(private prisma: PrismaService) {}

  async getUserAttributes(userId: string) {
    return this.prisma.userAttribute.findMany({ where: { userId } });
  }

  async setUserAttribute(userId: string, key: string, value: string) {
    const existing = await this.prisma.userAttribute.findFirst({ where: { userId, key } });
    if (existing) {
      return this.prisma.userAttribute.update({ where: { id: existing.id }, data: { value } });
    }
    return this.prisma.userAttribute.create({ data: { userId, key, value } });
  }

  async deleteUserAttribute(userId: string, key: string) {
    const existing = await this.prisma.userAttribute.findFirst({ where: { userId, key } });
    if (!existing) throw new NotFoundException(`Attribute '${key}' not found for user`);
    return this.prisma.userAttribute.delete({ where: { id: existing.id } });
  }

  async getAttributesMap(userId: string): Promise<Record<string, string>> {
    const attrs = await this.getUserAttributes(userId);
    return Object.fromEntries(attrs.map((a) => [a.key, a.value]));
  }
}
