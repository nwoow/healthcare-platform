'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import { formApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

type FormDoc = {
  _id: string
  name: string
  specialty?: string
  status: 'draft' | 'published'
  version: number
  createdAt: string
}

const fetchForms = () => {
  const tenantId = getCurrentTenantId()
  return formApi.get<FormDoc[]>('/forms', { params: { tenantId } }).then((r) => r.data)
}

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return (
    <span
      className={
        status === 'published'
          ? 'inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      }
    >
      {status}
    </span>
  )
}

export default function FormsPage() {
  const router = useRouter()
  const { data: forms = [], isLoading } = useSWR('admin/forms', fetchForms)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const handlePublish = async (id: string) => {
    setPublishingId(id)
    try {
      await formApi.post(`/forms/${id}/publish`)
      await mutate('admin/forms')
    } catch {
      // ignore for prototype
    } finally {
      setPublishingId(null)
    }
  }

  const columns: Column<FormDoc>[] = [
    {
      key: 'name',
      header: 'Form Name',
      sortable: true,
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'specialty',
      header: 'Specialty',
      sortable: true,
      render: (row) => (
        <span className="capitalize text-muted-foreground">{row.specialty || '—'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'version',
      header: 'Version',
      render: (row) => <span className="text-muted-foreground">v{row.version}</span>,
    },
    {
      key: 'createdAt',
      header: 'Created',
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
      key: 'actions',
      header: '',
      className: 'w-44 text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/admin/forms/builder?id=${row._id}`)}
          >
            <Pencil />
            Edit
          </Button>
          {row.status === 'draft' && (
            <Button
              size="sm"
              onClick={() => handlePublish(row._id)}
              disabled={publishingId === row._id}
            >
              <Send />
              {publishingId === row._id ? 'Publishing…' : 'Publish'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Forms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create and manage clinical forms
          </p>
        </div>
        <Button onClick={() => router.push('/admin/forms/builder')}>
          <Plus />
          New Form
        </Button>
      </div>

      <DataTable
        data={forms}
        columns={columns}
        filterPlaceholder="Filter by name…"
        emptyMessage="No forms yet. Click 'New Form' to create one."
        loading={isLoading}
        getFilterString={(row) => `${row.name} ${row.specialty ?? ''}`}
      />
    </div>
  )
}
