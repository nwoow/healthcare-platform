'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft, ClipboardList } from 'lucide-react'
import { submissionApi, formApi } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type Submission = {
  _id: string
  form_id: string
  form_version: number
  patient_id: string
  submitted_by: string
  status: string
  data: Record<string, unknown>
  createdAt: string
  review_comment?: string
}

type FormField = { id: string; label: string; type: string }
type FormSection = { id: string; title: string; fields: FormField[] }
type FormSchema = { _id: string; name: string; sections: FormSection[] }

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft:        { label: 'Draft',        cls: 'bg-gray-100 text-gray-600' },
  submitted:    { label: 'Submitted',    cls: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Under Review', cls: 'bg-yellow-100 text-yellow-700' },
  approved:     { label: 'Approved',     cls: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-100 text-red-700' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ClinicianSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const { data: submission } = useSWR<Submission>(
    id ? `clinician-submission-${id}` : null,
    () => submissionApi.get<Submission>(`/submissions/${id}`).then((r) => r.data),
  )

  const { data: form } = useSWR<FormSchema>(
    submission?.form_id ? `form-schema-${submission.form_id}` : null,
    () => formApi.get<FormSchema>(`/forms/${submission!.form_id}`).then((r) => r.data),
  )

  const allFields: FormField[] = form?.sections?.flatMap((s) => s.fields) ?? []

  if (!submission) {
    return (
      <div className="p-8">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Back + header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/clinician/submissions')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              {form?.name ?? 'Submission Detail'}
            </span>
          </div>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {/* Meta row */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">Date:</strong> {new Date(submission.createdAt).toLocaleString()}</span>
        <span><strong className="text-foreground">Form version:</strong> v{submission.form_version}</span>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* LEFT: Field labels */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Form Fields</h2>
          </div>
          <div className="divide-y divide-border">
            {allFields.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {allFields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{field.label}</p>
                  <p className="text-[11px] capitalize text-muted-foreground">{field.type}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Submitted values */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Your Answers</h2>
          </div>
          <div className="divide-y divide-border">
            {allFields.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {allFields.map((field) => {
              const val = submission.data?.[field.id]
              const isEmpty = val === undefined || val === null || val === ''
              return (
                <div key={field.id} className="px-5 py-3.5">
                  {isEmpty ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className="text-sm text-foreground">{formatValue(val)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Rejection comment */}
      {submission.status === 'rejected' && submission.review_comment && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejection Reason</p>
          <p className="mt-1 text-sm text-red-700">{submission.review_comment}</p>
        </div>
      )}

      {/* Approval notice */}
      {submission.status === 'approved' && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm font-medium text-green-700">This submission has been approved.</p>
        </div>
      )}
    </div>
  )
}
