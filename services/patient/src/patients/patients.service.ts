import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Kafka } from 'kafkajs'
import { PrismaService } from '../prisma/prisma.service'
import { PatientHistory, PatientHistoryDocument } from './schemas/patient-history.schema'
import { ConsentArtifact, ConsentArtifactDocument, ConsentStatus } from '../consent/consent.schema'
import { FhirService } from '../fhir/fhir.service'
import { CreatePatientDto } from './dto/create-patient.dto'
import { AddHistoryDto } from './dto/add-history.dto'
import { LinkAbhaDto } from './dto/link-abha.dto'

@Injectable()
export class PatientsService {
  constructor(
    private prisma: PrismaService,
    private fhirService: FhirService,
    @InjectModel(PatientHistory.name) private historyModel: Model<PatientHistoryDocument>,
    @InjectModel(ConsentArtifact.name) private consentModel: Model<ConsentArtifactDocument>,
  ) {}

  private generateMrn() {
    return 'P' + Date.now()
  }

  private async publishKafka(topic: string, payload: object, key: string) {
    try {
      const kafka = new Kafka({ clientId: 'patient-service', brokers: [(process.env.KAFKA_BROKERS || 'localhost:9092')] })
      const producer = kafka.producer()
      await producer.connect()
      await producer.send({ topic, messages: [{ key, value: JSON.stringify(payload) }] })
      await producer.disconnect()
    } catch { /* non-critical */ }
  }

  async create(dto: CreatePatientDto) {
    return this.prisma.patient.create({
      data: { ...dto, dob: new Date(dto.dob), mrn: this.generateMrn() },
    })
  }

  async findAll(tenantId?: string, search?: string) {
    return this.prisma.patient.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id } })
    if (!patient) throw new NotFoundException('Patient not found')
    return patient
  }

  async addHistory(patientId: string, dto: AddHistoryDto) {
    await this.findOne(patientId)
    const entry = await this.historyModel.create({ patientId, ...dto, visitDate: new Date(dto.visitDate) })
    await this.publishKafka('patient.history.updated', { patientId, historyId: String(entry._id), timestamp: new Date() }, patientId)
    return entry
  }

  async getHistory(patientId: string) {
    await this.findOne(patientId)
    return this.historyModel.find({ patientId }).sort({ visitDate: -1 }).exec()
  }

  async getTimeline(patientId: string) {
    await this.findOne(patientId)
    const history = await this.historyModel.find({ patientId }).sort({ visitDate: -1 }).exec()
    return history.map((h) => ({
      date: h.visitDate,
      type: 'visit',
      summary: h.diagnosis,
      doctorId: h.doctorId,
      medications: h.medications,
    }))
  }

  async update(id: string, dto: Partial<CreatePatientDto>) {
    await this.findOne(id)
    return this.prisma.patient.update({ where: { id }, data: dto })
  }

  // ── ABHA ──────────────────────────────────────────────────────────────────

  async linkAbha(id: string, dto: LinkAbhaDto) {
    await this.findOne(id)
    const existing = await this.prisma.patient.findFirst({ where: { abhaNumber: dto.abhaNumber, id: { not: id } } })
    if (existing) throw new BadRequestException('ABHA number already linked to another patient')

    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        abhaNumber: dto.abhaNumber,
        abhaAddress: dto.abhaAddress,
        abhaVerified: true,
        abhaLinkedAt: new Date(),
      },
    })

    await this.publishKafka('patient.abha.linked', {
      patientId: id,
      abhaNumber: dto.abhaNumber,
      abhaAddress: dto.abhaAddress,
      timestamp: new Date(),
    }, id)

    return updated
  }

  async getAbhaStatus(id: string) {
    const patient = await this.findOne(id)
    const masked = patient.abhaNumber
      ? patient.abhaNumber.slice(0, 6) + '********'
      : null
    return {
      abhaLinked: patient.abhaVerified,
      maskedAbhaNumber: masked,
      abhaAddress: patient.abhaAddress,
      abhaVerified: patient.abhaVerified,
      abhaLinkedAt: patient.abhaLinkedAt,
    }
  }

  // ── FHIR ──────────────────────────────────────────────────────────────────

  async getFhirPatient(id: string) {
    const patient = await this.findOne(id)
    return this.fhirService.patientToFhir(patient)
  }

  async getFhirObservations(id: string) {
    const patient = await this.findOne(id)
    const history = await this.historyModel.find({ patientId: id }).exec()
    // Build a pseudo-submission from history data
    const pseudoSubmission = {
      _id: `hist-${id}`,
      patient_id: patient.id,
      submitted_by: 'system',
      createdAt: new Date().toISOString(),
      data: Object.fromEntries(history.map((h, i) => [`diagnosis_${i}`, h.diagnosis])),
    }
    return this.fhirService.submissionToFhir(pseudoSubmission, { sections: [] })
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics(tenantId: string) {
    const where = tenantId && tenantId !== 'all' ? { tenantId } : {}
    const all = await this.prisma.patient.findMany({ where })

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const abhaLinked = all.filter(p => p.abhaVerified).length
    const newThisMonth = all.filter(p => p.createdAt >= startOfMonth).length

    const byGender: Record<string, number> = {}
    all.forEach(p => { byGender[p.gender] = (byGender[p.gender] || 0) + 1 })

    const byBloodGroup: Record<string, number> = {}
    all.forEach(p => {
      const bg = p.bloodGroup || 'Unknown'
      byBloodGroup[bg] = (byBloodGroup[bg] || 0) + 1
    })

    const totalAge = all.reduce((sum, p) => {
      const age = Math.floor((now.getTime() - new Date(p.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      return sum + age
    }, 0)
    const avgAge = all.length > 0 ? Math.round(totalAge / all.length) : 0

    return {
      totalPatients: all.length,
      abhaLinked,
      abhaLinkageRate: all.length > 0 ? Math.round((abhaLinked / all.length) * 1000) / 10 : 0,
      byGender: Object.entries(byGender).map(([gender, count]) => ({ gender, count })),
      byBloodGroup: Object.entries(byBloodGroup).map(([bloodGroup, count]) => ({ bloodGroup, count })),
      newThisMonth,
      avgAge,
    }
  }

  // ── Consent ───────────────────────────────────────────────────────────────

  async requestConsent(patientId: string, dto: {
    purpose: string
    dataCategories: string[]
    dateRange: { from: string; to: string }
    requestedBy: string
    tenantId?: string
  }) {
    await this.findOne(patientId)
    const artifact = await this.consentModel.create({
      patientId,
      tenantId: dto.tenantId || 'unknown',
      requestedBy: dto.requestedBy,
      purpose: dto.purpose,
      dataCategories: dto.dataCategories,
      dateRange: dto.dateRange,
      status: ConsentStatus.REQUESTED,
    })

    // Auto-grant after 2s (demo mode)
    setTimeout(async () => {
      try {
        await this.consentModel.findByIdAndUpdate(artifact._id, {
          status: ConsentStatus.GRANTED,
          grantedAt: new Date(),
          expiresAt: dto.dateRange?.to ? new Date(dto.dateRange.to) : undefined,
        })
      } catch { /* non-critical */ }
    }, 2000)

    return artifact
  }

  async getConsents(patientId: string) {
    await this.findOne(patientId)
    return this.consentModel.find({ patientId }).sort({ createdAt: -1 }).exec()
  }

  async updateConsent(patientId: string, consentId: string, action: 'grant' | 'deny' | 'revoke') {
    await this.findOne(patientId)
    const update: Record<string, any> = {}
    if (action === 'grant') {
      update.status = ConsentStatus.GRANTED
      update.grantedAt = new Date()
    } else if (action === 'deny') {
      update.status = ConsentStatus.DENIED
    } else if (action === 'revoke') {
      update.status = ConsentStatus.REVOKED
      update.revokedAt = new Date()
    }
    return this.consentModel.findByIdAndUpdate(consentId, update, { new: true }).exec()
  }

  async verifyConsent(patientId: string, consentId: string) {
    const consent = await this.consentModel.findById(consentId).exec()
    if (!consent || consent.patientId !== patientId) {
      return { valid: false, reason: 'Consent not found' }
    }
    if (consent.status === ConsentStatus.EXPIRED) return { valid: false, reason: 'Consent expired' }
    if (consent.status === ConsentStatus.REVOKED) return { valid: false, reason: 'Consent revoked' }
    if (consent.status === ConsentStatus.DENIED) return { valid: false, reason: 'Consent denied' }
    if (consent.status !== ConsentStatus.GRANTED) return { valid: false, reason: 'Consent not yet granted' }
    if (consent.expiresAt && consent.expiresAt < new Date()) {
      await this.consentModel.findByIdAndUpdate(consentId, { status: ConsentStatus.EXPIRED })
      return { valid: false, reason: 'Consent has expired' }
    }
    return { valid: true, reason: 'Consent is valid and active' }
  }
}
