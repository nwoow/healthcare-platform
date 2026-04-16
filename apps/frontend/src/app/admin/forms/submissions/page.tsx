'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { Eye, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { submissionApi, formApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type Submission = {
  _id: string
  form_id: string
  patient_id: string
  submitted_by: string
  status: string
  createdAt: string
  tenant_id: string
  form_version: number
}

type FormOption = { _id: string; name: string }

// ── Status badge ──────────────────────────────────────────────────────────────

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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubmissionsPage() {
  const router = useRouter()
  const [formId,    setFormId]    = useState('')
  const [status,    setStatus]    = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate,   setEndDate]   = useState('')
  const [page,      setPage]      = useState(1)

  // Form options for selector
  const { data: forms = [] } = useSWR<FormOption[]>('forms-all', () =>
    formApi.get<FormOption[]>('/forms').then((r) => r.data),
  )

  // Build query params
  const buildParams = () => {
    const p: Record<string, string> = {}
    if (formId)    p.formId    = formId
    if (status)    p.status    = status
    if (startDate) p.from      = startDate
    if (endDate)   p.to        = endDate
    return p
  }

  const swrKey = `submissions-${formId}-${status}-${startDate}-${endDate}`
  const { data: allSubmissions = [], isLoading } = useSWR<Submission[]>(swrKey, () =>
    submissionApi.get<Submission[]>('/submissions', { params: buildParams() }).then((r) => r.data),
  )

  const total     = allSubmissions.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const sliced    = allSubmissions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilter = () => setPage(1)

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage all form submissions
        </p>
      </div>

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Form</label>
          <select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All forms</option>
            {forms.map((f) => (
              <option key={f._id} value={f._id}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>

        <Button size="sm" onClick={handleFilter} className="gap-1.5">
          <Filter className="size-3.5" />
          Apply
        </Button>

        {(formId || status || startDate || endDate) && (
          <button
            onClick={() => { setFormId(''); setStatus(''); setStartDate(''); setEndDate(''); setPage(1) }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Form ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                  </tr>
                ))
              )}

              {!isLoading && sliced.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No submissions match the selected filters.
                  </td>
                </tr>
              )}

              {!isLoading && sliced.map((sub) => (
                <tr
                  key={sub._id}
                  className="border-b border-border transition-colors hover:bg-blue-50/40 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sub.patient_id?.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {sub.form_id?.slice(0, 12)}…
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">{sub.submitted_by}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(sub.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={sub.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/admin/forms/submissions/${sub._id}`)}
                    >
                      <Eye />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className={cn(
          'flex items-center justify-between border-t border-border px-4 py-3',
          totalPages <= 1 && total === 0 && 'hidden',
        )}>
          <p className="text-xs text-muted-foreground">
            {total} submission{total !== 1 ? 's' : ''} · page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
