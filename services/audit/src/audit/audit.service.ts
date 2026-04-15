import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async log(
    topic: string,
    action: string,
    payload: object,
    actorId?: string,
    resourceId?: string,
    tenantId?: string,
  ) {
    try {
      return await this.prisma.auditLog.create({
        data: { topic, action, payload, actorId, resourceId, tenantId },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }

  async findAll(filters: {
    topic?: string;
    actorId?: string;
    tenantId?: string;
    from?: string;
    to?: string;
  }) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.topic ? { topic: filters.topic } : {}),
        ...(filters.actorId ? { actorId: filters.actorId } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters.from || filters.to
          ? {
              createdAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getComplianceReport(tenantId: string, from: string, to: string) {
    const where: any = {
      createdAt: {
        gte: from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        lte: to ? new Date(to) : new Date(),
      },
      ...(tenantId ? { tenantId } : {}),
    };

    const logs = await this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'asc' } });

    const phiAccessCount = logs.filter(l => l.action.includes('PHI') || l.action.includes('FHIR')).length;
    const fhirExportCount = logs.filter(l => l.topic === 'fhir.exported' || l.action.includes('FHIR')).length;
    const consentCheckCount = logs.filter(l => l.action.includes('CONSENT')).length;
    const approvalCount = logs.filter(l => l.action === 'SUBMISSION_SUBMITTED' && (l.payload as any)?.status === 'approved').length;
    const rejectionCount = logs.filter(l => l.action === 'SUBMISSION_SUBMITTED' && (l.payload as any)?.status === 'rejected').length;

    const actorMap: Record<string, number> = {};
    logs.forEach(l => {
      if (l.actorId) actorMap[l.actorId] = (actorMap[l.actorId] || 0) + 1;
    });
    const topActors = Object.entries(actorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([actorId, count]) => ({ actorId, count }));

    const dayMap: Record<string, number> = {};
    logs.forEach(l => {
      const day = new Date(l.createdAt).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
    });
    const eventsByDay = Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return {
      phiAccessCount,
      fhirExportCount,
      consentCheckCount,
      approvalCount,
      rejectionCount,
      topActors,
      eventsByDay,
    };
  }
}
