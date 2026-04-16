'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { ClipboardList, Eye } from 'lucide-react'
import Link from 'next/link'
import { submissionApi, formApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { DataTable, type Column } from '@/components/ui/data-table'

type Submission = {
  _id: string
  form_id: string
  status: string
  createdAt: string
  tenant_id: string
  patient_id: string
}

type FormMeta = {
  _id: string
  name: string
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-700',
  submitted: 'bg-blue-100 text-blue-700',
  under_review: 'bg-violet-100 text-violet-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-slate-100 text-slateate-600'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${color}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function ClinicianSubmissionsPage() {
  const [userId, setUserId] = useState('')

  useEffect(() => {
    const user = getUser()
    if (user) setUserId(user.id)
  }, [])

  const { data: submissions = [], isLoading } = useSWR(
    userId ? `my-submissions-${userId}` : null,
    () =>
      submissionApi
        .get<Submission[]>('/submissions', { params: { submittedBy: userId } })
        .then((r) => r.data),
  )

  const { data: forms = [] } = useSWR<FormMeta[]>(
    'all-forms-meta',
    () => formApi.get<FormMeta[]>('/forms').then((r) => r.data),
  )

  const formNameMap = Object.fromEntries(forms.map((f) => [f._id, f.name]))

  const columns: Column<Submission>[] = [
    {
      key: 'form_id',
      header: 'Form',
      render: (row) => (
        <span className="font-medium text-sm text-foreground">
          {formNameMap[row.form_id] ?? (
            <span className="font-mono text-xs text-muted-foreground">{row.form_id}</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      sortable: true,
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: '_id',
      header: '',
      render: (row) => (
        <Link
          href={`/clinician/submissions/${row._id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Eye className="size-3.5" />
          View
        </Link>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
            <ClipboardList className="size-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">My Submissions</h1>
            <p className="text-sm text-muted-foreground">Forms you have submitted</p>
          </div>
        </div>
      </div>

      <DataTable
        data={submissions}
        columns={columns}
        filterPlaceholder="Filter by form name or status…"
        emptyMessage="No submissions yet."
        loading={isLoading}
        getFilterString={(row) => `${formNameMap[row.form_id] ?? row.form_id} ${row.status}`}
      />
    </div>
  )
}
