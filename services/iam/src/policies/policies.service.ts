import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PoliciesService {
  constructor(private prisma: PrismaService) {}

  findAll(resourceType?: string) {
    return this.prisma.resourcePolicy.findMany({
      where: resourceType ? { resourceType } : undefined,
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.resourcePolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async findForResource(resourceType: string, resourceId: string) {
    return this.prisma.resourcePolicy.findMany({
      where: { resourceType, resourceId },
    });
  }

  create(resourceType: string, resourceId: string, attributeConditions: Record<string, unknown>) {
    return this.prisma.resourcePolicy.create({
      data: { resourceType, resourceId, attributeConditions: attributeConditions as any },
    });
  }

  async update(id: string, attributeConditions: Record<string, unknown>) {
    await this.findOne(id);
    return this.prisma.resourcePolicy.update({ where: { id }, data: { attributeConditions: attributeConditions as any } });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.resourcePolicy.delete({ where: { id } });
  }

  /**
   * Check if userAttributes satisfy all conditions in a policy.
   * Each condition is a key-value pair; all must match.
   */
  evaluateAttributes(
    userAttributes: Record<string, string>,
    conditions: Record<string, unknown>,
  ): boolean {
    for (const [key, expected] of Object.entries(conditions)) {
      const actual = userAttributes[key];
      if (actual !== String(expected)) return false;
    }
    return true;
  }
}
