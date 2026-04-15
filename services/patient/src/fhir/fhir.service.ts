import { Injectable } from '@nestjs/common'

@Injectable()
export class FhirService {
  /** Convert a Prisma Patient row to FHIR R4 Patient resource */
  patientToFhir(patient: Record<string, any>): object {
    const identifier: object[] = [
      {
        system: 'https://healthid.ndhm.gov.in',
        value: patient.mrn,
        type: { coding: [{ code: 'MR', display: 'Medical Record Number' }] },
      },
    ]
    if (patient.abhaNumber) {
      identifier.push({
        system: 'https://abha.abdm.gov.in',
        value: patient.abhaNumber,
        type: { coding: [{ code: 'ABHA', display: 'Ayushman Bharat Health Account' }] },
      })
    }

    const resource: Record<string, any> = {
      resourceType: 'Patient',
      id: patient.id,
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient'],
        lastUpdated: patient.updatedAt ?? patient.createdAt,
      },
      identifier,
      name: [{ use: 'official', text: patient.name }],
      gender: patient.gender === 'male' ? 'male' : patient.gender === 'female' ? 'female' : 'other',
      birthDate: patient.dob
        ? new Date(patient.dob).toISOString().split('T')[0]
        : undefined,
      telecom: [] as object[],
    }

    if (patient.contactPhone) {
      resource.telecom.push({ system: 'phone', value: patient.contactPhone, use: 'home' })
    }
    if (patient.contactEmail) {
      resource.telecom.push({ system: 'email', value: patient.contactEmail })
    }

    if (patient.bloodGroup) {
      resource.extension = [
        {
          url: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/BloodGroup',
          valueCodeableConcept: {
            coding: [{ code: patient.bloodGroup, display: patient.bloodGroup }],
          },
        },
      ]
    }

    return resource
  }

  /** Convert a submission + form schema to FHIR R4 Bundle of Observations */
  submissionToFhir(submission: Record<string, any>, formSchema: Record<string, any>): object {
    const fields: Record<string, any>[] = (formSchema?.sections ?? []).flatMap(
      (s: any) => s.fields ?? [],
    )

    const entries = Object.entries(submission.data ?? {}).map(([fieldId, value]) => {
      const field = fields.find((f) => f.id === fieldId)
      const observation: Record<string, any> = {
        resource: {
          resourceType: 'Observation',
          id: `obs-${submission._id ?? submission.id}-${fieldId}`,
          status: 'final',
          code: {
            coding: [{ system: 'https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-observation', code: fieldId }],
            text: field?.label ?? fieldId,
          },
          subject: { reference: `Patient/${submission.patient_id}` },
          effectiveDateTime: submission.createdAt,
          valueString: String(value),
        },
        request: { method: 'POST', url: 'Observation' },
      }
      return observation
    })

    return {
      resourceType: 'Bundle',
      id: `bundle-${submission._id ?? submission.id}`,
      type: 'transaction',
      timestamp: new Date().toISOString(),
      entry: entries,
    }
  }

  /** Convert a consultation submission + patient to FHIR Composition */
  consultationToFhir(submission: Record<string, any>, patient: Record<string, any>): object {
    return {
      resourceType: 'Composition',
      id: `composition-${submission._id ?? submission.id}`,
      meta: {
        profile: ['https://nrces.in/ndhm/fhir/r4/StructureDefinition/OPConsultationRecord'],
      },
      status: 'final',
      type: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '371530004',
            display: 'Clinical consultation report',
          },
        ],
      },
      subject: { reference: `Patient/${patient.id}`, display: patient.name },
      date: submission.createdAt,
      author: [{ reference: `Practitioner/${submission.submitted_by}` }],
      title: 'OP Consultation Record',
      section: [
        {
          title: 'Chief Complaint',
          code: {
            coding: [{ system: 'http://snomed.info/sct', code: '422843007', display: 'Chief complaint section' }],
          },
          entry: Object.keys(submission.data ?? {}).map((fieldId) => ({
            reference: `Observation/obs-${submission._id}-${fieldId}`,
          })),
        },
      ],
    }
  }
}
