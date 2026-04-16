'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box, Typography, Button, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Tooltip, Skeleton,
  IconButton,
} from '@mui/material'
import { ArrowBack as BackIcon, Refresh as RetryIcon } from '@mui/icons-material'
import { integrationApi } from '@/lib/api'

interface IntegrationLog {
  _id: string; logId: string; integrationId: string; event: string
  requestPayload: Record<string, any>; responseStatus?: number
  responseBody?: string; durationMs?: number; success: boolean
  errorMessage?: string; timestamp: string
}

export default function IntegrationLogsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const { data: logs, isLoading, mutate } = useSWR<IntegrationLog[]>(
    id ? `integration-logs-${id}` : null,
    () => integrationApi.get<IntegrationLog[]>(`/integrations/${id}/logs?limit=50`).then(r => r.data),
  )

  const handleRetry = async (log: IntegrationLog) => {
    try {
      await integrationApi.post(`/integrations/${id}/test`)
      mutate()
    } catch { /* silent */ }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.push('/admin/integrations')}>
            Integrations
          </Button>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Delivery Logs</Typography>
        </Box>
        <Button startIcon={<RetryIcon />} variant="outlined" size="small" onClick={() => mutate()}>
          Refresh
        </Button>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              {['Timestamp', 'Event', 'Status', 'HTTP', 'Duration', 'Payload', 'Actions'].map(h => (
                <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && Array.from({ length: 10 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 7 }).map((__, j) => (
                  <TableCell key={j}><Skeleton height={20} /></TableCell>
                ))}
              </TableRow>
            ))}
            {!isLoading && (logs ?? []).map(log => (
              <TableRow key={log._id} hover>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={log.event} size="small" variant="outlined" sx={{ fontSize: 10 }} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={log.success ? 'success' : 'failed'}
                    color={log.success ? 'success' : 'error'}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {log.responseStatus ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{log.durationMs != null ? `${log.durationMs}ms` : '—'}</Typography>
                </TableCell>
                <TableCell sx={{ maxWidth: 200 }}>
                  <Tooltip title={JSON.stringify(log.requestPayload).slice(0, 200)}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', cursor: 'help' }}>
                      {JSON.stringify(log.requestPayload).slice(0, 40)}…
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  {!log.success && (
                    <Tooltip title="Retry (re-test integration)">
                      <IconButton size="small" onClick={() => handleRetry(log)}>
                        <RetryIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (logs ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">No logs yet</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
