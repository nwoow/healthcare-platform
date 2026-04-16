'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR, { mutate as globalMutate } from 'swr'
import { ArrowLeft, CheckCircle, XCircle, ClipboardList } from 'lucide-react'
import { submissionApi, formApi, authApi, patientApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Timeline, TimelineItem, TimelineSeparator, TimelineDot,
  TimelineConnector, TimelineContent,
} from '@mui/lab'
import { Box, Typography, Chip } from '@mui/material'

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
  reviewed_by?: string
}

type FormField = { id: string; label: string; type: string }
type FormSection = { id: string; title: string; fields: FormField[] }
type FormSchema = { _id: string; name: string; sections: FormSection[] }

type AuditEntry = {
  _id: string
  action: string
  actorId: string
  actorRole: string
  timestamp: string
  ipAddress?: string
  metadata?: Record<string, any>
}

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

// ── Format a value for display ────────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === undefined || val === null || val === '') return '—'
  if (Array.isArray(val)) return val.join(', ')
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

// ── Reject Dialog ─────────────────────────────────────────────────────────────

function RejectDialog({
  onConfirm, onCancel, loading,
}: { onConfirm: (comment: string) => void; onCancel: () => void; loading: boolean }) {
  const [comment, setComment] = useState('')
  const MIN = 10

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-foreground">Reject Submission</h2>
        <p className="mt-1 text-sm text-muted-foreground">Please provide a reason. Minimum {MIN} characters.</p>
        <div className="relative mt-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            placeholder="Enter rejection reason…"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <span className="absolute bottom-2 right-3 text-[11px] text-muted-foreground">{comment.length} chars</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => onConfirm(comment)}
            disabled={comment.length < MIN || loading}
            className="bg-red-600 hover:bg-red-700 text-white border-transparent"
          >
            <XCircle />
            {loading ? 'Rejecting…' : 'Confirm Reject'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg',
      type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200',
    )}>
      {message}
    </div>
  )
}

// ── Audit dot color by action ─────────────────────────────────────────────────

const ACTION_COLOR: Record<string, 'grey' | 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info'> = {
  DRAFT_SAVED: 'grey',
  FORM_SUBMITTED: 'primary',
  FORM_APPROVED: 'success',
  FORM_REJECTED: 'error',
  FORM_VIEWED: 'info',
  FHIR_EXPORTED: 'secondary',
  CONSENT_CHECKED: 'warning',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'fields' | 'audit'>('fields')
  const [showReject, setShowReject] = useState(false)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const { data: submission, mutate: mutateSubmission } = useSWR<Submission>(
    id ? `submission-${id}` : null,
    () => submissionApi.get<Submission>(`/submissions/${id}`).then((r) => r.data),
  )

  const { data: form } = useSWR<FormSchema>(
    submission?.form_id ? `form-schema-${submission.form_id}` : null,
    () => formApi.get<FormSchema>(`/forms/${submission!.form_id}`).then((r) => r.data),
  )

  const { data: auditTrail } = useSWR<AuditEntry[]>(
    id && activeTab === 'audit' ? `audit-trail-${id}` : null,
    () => submissionApi.get<AuditEntry[]>(`/submissions/${id}/audit-trail`).then(r => r.data),
  )

  type UserRecord = { id: string; name?: string; email: string }
  const { data: allUsers } = useSWR<UserRecord[]>(
    'all-users',
    () => authApi.get<UserRecord[]>('/auth/users').then(r => r.data),
  )
  const userMap = Object.fromEntries((allUsers ?? []).map(u => [u.id, u.name || u.email]))

  type PatientRecord = { id: string; name: string }
  const { data: patientRecord } = useSWR<PatientRecord>(
    submission?.patient_id ? `patient-${submission.patient_id}` : null,
    () => patientApi.get<PatientRecord>(`/patients/${submission!.patient_id}`).then(r => r.data),
  )

  const allFields: FormField[] = form?.sections?.flatMap((s) => s.fields) ?? []
  const canAct = submission?.status === 'submitted' || submission?.status === 'under_review'

  const handleApprove = async () => {
    setActing(true)
    const user = getUser()
    try {
      await submissionApi.patch(`/submissions/${id}/status`, {
        status: 'approved',
        reviewed_by: user?.id ?? 'unknown',
        reviewed_by_role: user?.role ?? 'tenant_admin',
      })
      await mutateSubmission()
      showToast('Submission approved', 'success')
    } catch {
      showToast('Failed to approve', 'error')
    } finally {
      setActing(false)
    }
  }

  const handleReject = async (comment: string) => {
    setActing(true)
    const user = getUser()
    try {
      await submissionApi.patch(`/submissions/${id}/status`, {
        status: 'rejected',
        review_comment: comment,
        reviewed_by: user?.id ?? 'unknown',
        reviewed_by_role: user?.role ?? 'tenant_admin',
      })
      await mutateSubmission()
      setShowReject(false)
      showToast('Submission rejected', 'error')
    } catch {
      showToast('Failed to reject', 'error')
    } finally {
      setActing(false)
    }
  }

  const handleExportAuditCsv = () => {
    if (!auditTrail) return
    const rows = [
      ['Timestamp', 'Action', 'Actor', 'Role', 'IP'],
      ...auditTrail.map(e => [
        new Date(e.timestamp).toISOString(),
        e.action,
        userMap[e.actorId] ?? e.actorId,
        e.actorRole,
        e.ipAddress || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `audit-trail-${id}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

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
            onClick={() => router.push('/admin/forms/submissions')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2">
            <ClipboardList className="size-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Submission Detail</span>
          </div>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {/* Meta row */}
      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">Patient:</strong> {patientRecord?.name ?? submission.patient_id}</span>
        <span><strong className="text-foreground">Submitted by:</strong> {userMap[submission.submitted_by] ?? submission.submitted_by}</span>
        <span><strong className="text-foreground">Date:</strong> {new Date(submission.createdAt).toLocaleString()}</span>
        <span><strong className="text-foreground">Form version:</strong> v{submission.form_version}</span>
      </div>

      {/* Tab selector */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/30 p-1 w-fit">
        {(['fields', 'audit'] as const).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === t
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'fields' ? 'Form Fields' : 'Audit Trail'}
          </button>
        ))}
      </div>

      {/* Fields tab */}
      {activeTab === 'fields' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Form Fields</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Original field labels</p>
            </div>
            <div className="divide-y divide-border">
              {allFields.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading field schema…</p>
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

          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Submitted Values</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Values entered by the clinician</p>
            </div>
            <div className="divide-y divide-border">
              {allFields.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Loading values…</p>}
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
      )}

      {/* Audit Trail tab */}
      {activeTab === 'audit' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportAuditCsv}
              disabled={!auditTrail || auditTrail.length === 0}
            >
              Export CSV
            </Button>
          </Box>
          {(!auditTrail || auditTrail.length === 0) ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography color="text.secondary">No audit entries yet.</Typography>
            </Box>
          ) : (
            <Timeline>
              {auditTrail.map((entry, i) => (
                <TimelineItem key={entry._id} sx={{ '&::before': { display: 'none' } }}>
                  <TimelineSeparator>
                    <TimelineDot color={ACTION_COLOR[entry.action] ?? 'grey'} />
                    {i < auditTrail.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent sx={{ pb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip label={entry.action.replace(/_/g, ' ')} size="small" sx={{ fontWeight: 600, fontSize: 11 }} />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(entry.timestamp).toLocaleString()}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Actor: {userMap[entry.actorId] ?? entry.actorId} • Role: {entry.actorRole}
                      {entry.ipAddress && entry.ipAddress !== 'unknown' ? ` • IP: ${entry.ipAddress}` : ''}
                    </Typography>
                  </TimelineContent>
                </TimelineItem>
              ))}
            </Timeline>
          )}
        </Box>
      )}

      {/* Rejection comment */}
      {submission.status === 'rejected' && submission.review_comment && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejection Reason</p>
          <p className="mt-1 text-sm text-red-700">{submission.review_comment}</p>
        </div>
      )}

      {/* Action bar */}
      {canAct && (
        <div className="mt-6 flex items-center justify-end gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <p className="mr-auto text-sm text-muted-foreground">Review this submission:</p>
          <Button
            onClick={() => setShowReject(true)}
            disabled={acting}
            className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            variant="outline"
            size="sm"
          >
            <XCircle />
            Reject
          </Button>
          <Button
            onClick={handleApprove}
            disabled={acting}
            className="bg-green-600 text-white hover:bg-green-700 border-transparent"
            size="sm"
          >
            <CheckCircle />
            {acting ? 'Approving…' : 'Approve'}
          </Button>
        </div>
      )}

      {showReject && (
        <RejectDialog
          onConfirm={handleReject}
          onCancel={() => setShowReject(false)}
          loading={acting}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
