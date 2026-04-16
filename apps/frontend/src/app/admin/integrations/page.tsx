'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Select, FormControl, InputLabel, Checkbox, FormControlLabel, FormGroup,
  Alert, IconButton, Tooltip, Divider, Stepper, Step, StepLabel, Skeleton,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, PlayArrow as TestIcon,
  PowerSettingsNew as ToggleIcon, List as LogsIcon, Delete as DeleteIcon,
  Extension as ExtensionIcon, CheckCircle as OkIcon, Error as ErrIcon,
} from '@mui/icons-material'
import { integrationApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

interface Integration {
  _id: string
  integrationId: string
  tenantId: string
  name: string
  type: string
  status: string
  config: { webhookUrl?: string; authType?: string; retryAttempts?: number; timeoutMs?: number }
  triggers: Array<{ event: string; enabled: boolean }>
  stats: { totalCalled: number; totalSuccess: number; totalFailed: number; lastCalledAt?: string; lastStatus?: string }
}

const KAFKA_TOPICS = [
  { event: 'submission.submitted', label: 'Submission Submitted', description: 'Fires when a clinician submits a form' },
  { event: 'form.published', label: 'Form Published', description: 'Fires when admin publishes a new form' },
  { event: 'patient.history.updated', label: 'Patient History Updated', description: 'Fires when a patient history entry is added' },
  { event: 'auth.login.success', label: 'User Login', description: 'Fires on successful authentication' },
  { event: 'tenant.provisioned', label: 'Tenant Provisioned', description: 'Fires when a new hospital is onboarded' },
  { event: 'iam.policy.updated', label: 'Policy Updated', description: 'Fires when IAM policies change' },
  { event: 'patient.abha.linked', label: 'ABHA Linked', description: 'Fires when a patient links their ABHA' },
]

const TYPE_COLORS: Record<string, string> = {
  WEBHOOK: '#0E7C7B', REST_API: '#1565C0', FHIR_ENDPOINT: '#6B3FA0',
  LAB_SYSTEM: '#E65100', PHARMACY: '#2E7D32', INSURANCE: '#AD1457',
  ERP: '#37474F', CUSTOM: '#795548',
}

function IntegrationCard({ integration, onEdit, onTest, onToggle, onLogs, onDelete }: {
  integration: Integration
  onEdit: () => void; onTest: () => void; onToggle: () => void
  onLogs: () => void; onDelete: () => void
}) {
  const successRate = integration.stats.totalCalled > 0
    ? Math.round((integration.stats.totalSuccess / integration.stats.totalCalled) * 100) : 0
  const enabledTriggers = integration.triggers.filter(t => t.enabled).length

  return (
    <Card sx={{ height: '100%', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 200ms' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: TYPE_COLORS[integration.type] ?? '#94A3B8' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{integration.name}</Typography>
          </Box>
          <Chip
            size="small"
            label={integration.status}
            color={integration.status === 'active' ? 'success' : integration.status === 'error' ? 'error' : 'default'}
          />
        </Box>

        <Chip label={integration.type} size="small" variant="outlined" sx={{ mb: 1.5, fontSize: 11 }} />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {integration.config.webhookUrl ? integration.config.webhookUrl.slice(0, 45) + '…' : 'No URL'}
        </Typography>

        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Success rate</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{successRate}%</Typography>
          </Box>
          <LinearProgress variant="determinate" value={successRate} color={successRate >= 80 ? 'success' : successRate >= 50 ? 'warning' : 'error'} sx={{ height: 6, borderRadius: 1 }} />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="caption" color="text.secondary">{enabledTriggers} triggers</Typography>
          {integration.stats.lastCalledAt && (
            <Typography variant="caption" color="text.secondary">
              {new Date(integration.stats.lastCalledAt).toLocaleDateString()}
            </Typography>
          )}
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Tooltip title="Edit"><IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Test connection"><IconButton size="small" onClick={onTest}><TestIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Toggle active/inactive"><IconButton size="small" onClick={onToggle}><ToggleIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="View logs"><IconButton size="small" onClick={onLogs}><LogsIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function IntegrationsPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [testResult, setTestResult] = useState<{ success: boolean; statusCode?: number; durationMs?: number; error?: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'WEBHOOK',
    webhookUrl: '', authType: 'none', token: '',
    triggers: [] as string[],
  })

  useEffect(() => { setTenantId(getCurrentTenantId()) }, [])

  const { data: integrations, isLoading, mutate } = useSWR<Integration[]>(
    tenantId ? `integrations-${tenantId}` : null,
    () => integrationApi.get<Integration[]>(`/integrations?tenantId=${tenantId}`).then(r => r.data),
  )

  const handleTest = useCallback(async (id: string) => {
    try {
      const res = await integrationApi.post<{ success: boolean; statusCode?: number; durationMs: number; error?: string }>(`/integrations/${id}/test`)
      alert(`Test ${res.data.success ? 'passed' : 'failed'}: ${res.data.statusCode ?? 'N/A'} in ${res.data.durationMs}ms${res.data.error ? ` — ${res.data.error}` : ''}`)
    } catch { /* silent */ }
  }, [])

  const handleToggle = useCallback(async (id: string) => {
    try {
      await integrationApi.patch(`/integrations/${id}/toggle`)
      mutate()
    } catch { /* silent */ }
  }, [mutate])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this integration?')) return
    try {
      await integrationApi.delete(`/integrations/${id}`)
      mutate()
    } catch { /* silent */ }
  }, [mutate])

  const handleTestNew = useCallback(async () => {
    if (!form.webhookUrl) return
    setTesting(true); setTestResult(null)
    try {
      // Create a temp integration for testing
      const created = await integrationApi.post<Integration>('/integrations', {
        tenantId, name: '__test__', type: form.type,
        config: { webhookUrl: form.webhookUrl, authType: form.authType, authConfig: form.token ? { token: form.token } : {} },
        triggers: [],
      })
      const res = await integrationApi.post<{ success: boolean; statusCode?: number; durationMs: number; error?: string }>(`/integrations/${created.data._id}/test`)
      setTestResult(res.data)
      await integrationApi.delete(`/integrations/${created.data._id}`)
    } catch { setTestResult({ success: false, durationMs: 0, error: 'Request failed' }) }
    finally { setTesting(false) }
  }, [form, tenantId])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await integrationApi.post('/integrations', {
        tenantId, name: form.name, type: form.type,
        status: 'inactive',
        config: {
          webhookUrl: form.webhookUrl,
          authType: form.authType,
          authConfig: form.token ? { token: form.token } : {},
          retryAttempts: 3,
          timeoutMs: 5000,
        },
        triggers: form.triggers.map(event => ({ event, enabled: true })),
      })
      setAddOpen(false)
      setForm({ name: '', type: 'WEBHOOK', webhookUrl: '', authType: 'none', token: '', triggers: [] })
      setStep(0); setTestResult(null)
      mutate()
    } catch { /* silent */ } finally { setSaving(false) }
  }, [form, tenantId, mutate])

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Integrations</Typography>
          <Typography variant="body2" color="text.secondary">Connect external systems via webhooks and APIs</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Integration
        </Button>
      </Box>

      {isLoading && (
        <Grid container spacing={2.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
              <Skeleton variant="rectangular" height={260} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      )}

      {!isLoading && (integrations ?? []).length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <ExtensionIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">No integrations yet</Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
            Connect to EHR systems, lab platforms, insurance providers, and more.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Add First Integration
          </Button>
        </Box>
      )}

      <Grid container spacing={2.5}>
        {(integrations ?? []).map(integration => (
          <Grid key={integration._id} size={{ xs: 12, sm: 6, md: 4, xl: 3 }}>
            <IntegrationCard
              integration={integration}
              onEdit={() => router.push(`/admin/integrations/${integration._id}`)}
              onTest={() => handleTest(integration._id)}
              onToggle={() => handleToggle(integration._id)}
              onLogs={() => router.push(`/admin/integrations/${integration._id}/logs`)}
              onDelete={() => handleDelete(integration._id)}
            />
          </Grid>
        ))}
      </Grid>

      {/* Add Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Integration</DialogTitle>
        <DialogContent>
          <Stepper activeStep={step} sx={{ my: 2 }}>
            {['Connection', 'Triggers'].map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {step === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} size="small" fullWidth />
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={form.type} label="Type" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {['WEBHOOK', 'REST_API', 'FHIR_ENDPOINT', 'LAB_SYSTEM', 'PHARMACY', 'INSURANCE', 'ERP', 'CUSTOM'].map(t => (
                    <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField label="Webhook URL *" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} size="small" fullWidth placeholder="https://..." />
              <FormControl size="small" fullWidth>
                <InputLabel>Auth Type</InputLabel>
                <Select value={form.authType} label="Auth Type" onChange={e => setForm(f => ({ ...f, authType: e.target.value }))}>
                  {['none', 'bearer', 'api_key', 'basic'].map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                </Select>
              </FormControl>
              {form.authType === 'bearer' && (
                <TextField label="Bearer Token" value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))} size="small" fullWidth type="password" />
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={handleTestNew} disabled={testing || !form.webhookUrl}>
                  {testing ? 'Testing…' : 'Test Connection'}
                </Button>
                {testResult && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {testResult.success ? <OkIcon color="success" fontSize="small" /> : <ErrIcon color="error" fontSize="small" />}
                    <Typography variant="caption">
                      {testResult.success ? `${testResult.statusCode} OK (${testResult.durationMs}ms)` : testResult.error}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {step === 1 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Select which Kafka events should trigger this integration:
              </Typography>
              <FormGroup>
                {KAFKA_TOPICS.map(topic => (
                  <FormControlLabel
                    key={topic.event}
                    control={
                      <Checkbox
                        size="small"
                        checked={form.triggers.includes(topic.event)}
                        onChange={e => setForm(f => ({
                          ...f,
                          triggers: e.target.checked
                            ? [...f.triggers, topic.event]
                            : f.triggers.filter(t => t !== topic.event),
                        }))}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{topic.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{topic.description}</Typography>
                      </Box>
                    }
                    sx={{ mb: 1, alignItems: 'flex-start' }}
                  />
                ))}
              </FormGroup>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          {step === 0 && (
            <Button variant="contained" onClick={() => setStep(1)} disabled={!form.name || !form.webhookUrl}>
              Next: Triggers
            </Button>
          )}
          {step === 1 && (
            <>
              <Button onClick={() => setStep(0)}>Back</Button>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Integration'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
