'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  LinearProgress,
  Link,
  Paper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  Avatar,
  Divider,
  FormControlLabel,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material'
import { authApi, formApi, submissionApi, tenantApi } from '@/lib/api'

// Audit API on port 3008
const auditApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_AUDIT_URL || 'http://localhost:3008',
  withCredentials: true,
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantConfig {
  maxUsers?: number
  maxForms?: number
  features?: Record<string, boolean>
}

interface Tenant {
  id: string
  name: string
  subdomain: string
  plan: string
  status: string
  region?: string
  createdAt: string
  config?: TenantConfig
  provisioningLogs?: Array<{
    step: string
    status: string
    timestamp: string
    message?: string
  }>
}

interface User {
  id: string
  email: string
  name?: string
  role?: string
  isActive?: boolean
  createdAt?: string
}

interface Form {
  _id: string
  name: string
  specialty?: string
  status: string
  version?: number
  updatedAt?: string
}

interface Submission {
  _id: string
  formId?: string
  patientId?: string
  status: string
  createdAt: string
}

interface AuditEntry {
  id?: string
  topic?: string
  actor?: string
  timestamp?: string
  details?: string
  action?: string
  createdAt?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusChipColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'active' || status === 'approved') return 'success'
  if (status === 'suspended' || status === 'rejected') return 'error'
  if (status === 'provisioning' || status === 'under_review' || status === 'pending') return 'warning'
  return 'default'
}

// Custom Timeline component (no @mui/lab needed)
interface TimelineStepProps {
  step: string
  status: string
  timestamp: string
  message?: string
  isLast: boolean
}

function TimelineStep({ step, status, timestamp, message, isLast }: TimelineStepProps) {
  const dotColor =
    status === 'success' || status === 'completed'
      ? '#4caf50'
      : status === 'error' || status === 'failed'
      ? '#f44336'
      : 'rgba(255,255,255,0.3)'

  const Icon =
    status === 'success' || status === 'completed'
      ? CheckCircleIcon
      : status === 'error' || status === 'failed'
      ? ErrorIcon
      : RadioButtonUncheckedIcon

  return (
    <Box sx={{ display: 'flex', gap: 2, mb: isLast ? 0 : 2 }}>
      {/* Left: dot + connector */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Icon sx={{ fontSize: 20, color: dotColor, flexShrink: 0 }} />
        {!isLast && (
          <Box sx={{ width: 2, flex: 1, bgcolor: 'rgba(255,255,255,0.1)', mt: 0.5, minHeight: 24 }} />
        )}
      </Box>
      {/* Right: content */}
      <Box sx={{ flex: 1, pb: isLast ? 0 : 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
          {step}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
          {new Date(timestamp).toLocaleString()}
        </Typography>
        {message && (
          <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.4)', mt: 0.25 }}>
            {message}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

const tableCellSx = { color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.08)' }
const tableHeadCellSx = {
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 600,
  borderColor: 'rgba(255,255,255,0.08)',
  fontSize: 12,
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params)
  const router = useRouter()

  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loadingTenant, setLoadingTenant] = useState(true)
  const [tenantError, setTenantError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState(0)

  // Tab data
  const [users, setUsers] = useState<User[]>([])
  const [forms, setForms] = useState<Form[]>([])
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])

  const [tabLoading, setTabLoading] = useState(false)

  // Settings state
  const [settingsMaxUsers, setSettingsMaxUsers] = useState<number | ''>('')
  const [settingsMaxForms, setSettingsMaxForms] = useState<number | ''>('')
  const [settingsFeatures, setSettingsFeatures] = useState<Record<string, boolean>>({})
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Fetch tenant on mount
  useEffect(() => {
    const fetchTenant = async () => {
      try {
        const res = await tenantApi.get(`/tenants/${tenantId}`)
        const t: Tenant = res.data
        setTenant(t)
        setSettingsMaxUsers(t.config?.maxUsers ?? '')
        setSettingsMaxForms(t.config?.maxForms ?? '')
        setSettingsFeatures(t.config?.features ?? {})
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Failed to load tenant details.'
        setTenantError(message)
      } finally {
        setLoadingTenant(false)
      }
    }
    fetchTenant()
  }, [tenantId])

  // Fetch tab data when tab changes
  useEffect(() => {
    if (!tenant) return

    const fetchTab = async () => {
      setTabLoading(true)
      try {
        if (activeTab === 1) {
          const res = await authApi.get(`/auth/users?tenantId=${tenantId}`)
          setUsers(res.data ?? [])
        } else if (activeTab === 2) {
          const res = await formApi.get(`/forms?tenantId=${tenantId}`)
          setForms(res.data ?? [])
        } else if (activeTab === 3) {
          const res = await submissionApi.get(`/submissions?tenantId=${tenantId}`)
          setSubmissions(res.data ?? [])
        } else if (activeTab === 4) {
          const res = await auditApi.get(`/audit?tenantId=${tenantId}`)
          setAuditLogs(res.data ?? [])
        }
      } catch {
        // silently handle — tables will show empty
      } finally {
        setTabLoading(false)
      }
    }

    fetchTab()
  }, [activeTab, tenant, tenantId])

  const handleToggleStatus = async () => {
    if (!tenant) return
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    try {
      await tenantApi.patch(`/tenants/${tenantId}/status`, { status: newStatus })
      setTenant((prev) => (prev ? { ...prev, status: newStatus } : prev))
    } catch {
      // handle silently
    }
  }

  const handleSaveSettings = async () => {
    if (!tenant) return
    setSavingSettings(true)
    try {
      await tenantApi.patch(`/tenants/${tenantId}/config`, {
        maxUsers: settingsMaxUsers || undefined,
        maxForms: settingsMaxForms || undefined,
        features: settingsFeatures,
      })
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 3000)
    } catch {
      // handle silently
    } finally {
      setSavingSettings(false)
    }
  }

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loadingTenant) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <CircularProgress sx={{ color: '#0E7C7B' }} />
      </Box>
    )
  }

  if (tenantError || !tenant) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {tenantError ?? 'Tenant not found.'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.back()}>
          Go Back
        </Button>
      </Box>
    )
  }

  // ── Tab panels ─────────────────────────────────────────────────────────────

  const renderOverview = () => (
    <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
      {/* Left: Hospital details */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
              Hospital Details
            </Typography>
            {[
              ['Name', tenant.name],
              ['Subdomain', tenant.subdomain],
              ['Plan', tenant.plan],
              ['Region', tenant.region ?? '—'],
              ['Created', new Date(tenant.createdAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  {label}
                </Typography>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500, textTransform: 'capitalize' }}>
                  {value}
                </Typography>
              </Box>
            ))}

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 2 }} />

            {/* Usage bars */}
            {tenant.config?.maxUsers != null && (
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Users used
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    — / {tenant.config.maxUsers}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={0}
                  sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#0E7C7B' } }}
                />
              </Box>
            )}
            {tenant.config?.maxForms != null && (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    Forms used
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    — / {tenant.config.maxForms}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={0}
                  sx={{ borderRadius: 1, bgcolor: 'rgba(255,255,255,0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#1565C0' } }}
                />
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Right: Provisioning logs */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2 }}>
              Provisioning Logs
            </Typography>
            {tenant.provisioningLogs && tenant.provisioningLogs.length > 0 ? (
              tenant.provisioningLogs.map((log, idx) => (
                <TimelineStep
                  key={idx}
                  step={log.step}
                  status={log.status}
                  timestamp={log.timestamp}
                  message={log.message}
                  isLast={idx === (tenant.provisioningLogs?.length ?? 0) - 1}
                />
              ))
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                No provisioning logs available.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )

  const renderUsers = () => (
    <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', mt: 1 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
            <TableCell sx={tableHeadCellSx}>NAME / EMAIL</TableCell>
            <TableCell sx={tableHeadCellSx}>ROLE</TableCell>
            <TableCell sx={tableHeadCellSx}>STATUS</TableCell>
            <TableCell sx={tableHeadCellSx}>JOINED</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, ...tableCellSx }}>
                No users found
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell sx={tableCellSx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: '#0E7C7B' }}>
                      {(user.name ?? user.email)[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                        {user.name ?? '—'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={tableCellSx}>
                  <Chip
                    label={user.role ?? 'user'}
                    size="small"
                    sx={{ textTransform: 'capitalize', bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                  />
                </TableCell>
                <TableCell sx={tableCellSx}>
                  <Chip
                    label={user.isActive ? 'active' : 'inactive'}
                    color={user.isActive ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderForms = () => (
    <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', mt: 1 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
            <TableCell sx={tableHeadCellSx}>FORM NAME</TableCell>
            <TableCell sx={tableHeadCellSx}>SPECIALTY</TableCell>
            <TableCell sx={tableHeadCellSx}>STATUS</TableCell>
            <TableCell sx={tableHeadCellSx}>VERSION</TableCell>
            <TableCell sx={tableHeadCellSx}>UPDATED</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {forms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 4, ...tableCellSx }}>
                No forms found
              </TableCell>
            </TableRow>
          ) : (
            forms.map((form) => (
              <TableRow key={form._id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell sx={tableCellSx}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{form.name}</Typography>
                </TableCell>
                <TableCell sx={tableCellSx}>{form.specialty ?? '—'}</TableCell>
                <TableCell sx={tableCellSx}>
                  <Chip label={form.status} color={getStatusChipColor(form.status)} size="small" />
                </TableCell>
                <TableCell sx={tableCellSx}>v{form.version ?? 1}</TableCell>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {form.updatedAt ? new Date(form.updatedAt).toLocaleDateString() : '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderSubmissions = () => (
    <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', mt: 1 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
            <TableCell sx={tableHeadCellSx}>FORM ID</TableCell>
            <TableCell sx={tableHeadCellSx}>PATIENT</TableCell>
            <TableCell sx={tableHeadCellSx}>STATUS</TableCell>
            <TableCell sx={tableHeadCellSx}>DATE</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {submissions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, ...tableCellSx }}>
                No submissions found
              </TableCell>
            </TableRow>
          ) : (
            submissions.map((sub) => (
              <TableRow key={sub._id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>
                    {sub.formId ?? sub._id.slice(-8)}
                  </Typography>
                </TableCell>
                <TableCell sx={tableCellSx}>{sub.patientId ?? '—'}</TableCell>
                <TableCell sx={tableCellSx}>
                  <Chip label={sub.status} color={getStatusChipColor(sub.status)} size="small" />
                </TableCell>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderAudit = () => (
    <TableContainer component={Paper} sx={{ bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', mt: 1 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
            <TableCell sx={tableHeadCellSx}>TOPIC</TableCell>
            <TableCell sx={tableHeadCellSx}>ACTOR</TableCell>
            <TableCell sx={tableHeadCellSx}>TIMESTAMP</TableCell>
            <TableCell sx={tableHeadCellSx}>DETAILS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {auditLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: 4, ...tableCellSx }}>
                No audit logs found
              </TableCell>
            </TableRow>
          ) : (
            auditLogs.map((log, idx) => (
              <TableRow key={log.id ?? idx} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <TableCell sx={tableCellSx}>
                  <Chip
                    label={log.topic ?? log.action ?? '—'}
                    size="small"
                    sx={{ bgcolor: 'rgba(14,124,123,0.2)', color: '#0E7C7B', fontFamily: 'monospace', fontSize: 11 }}
                  />
                </TableCell>
                <TableCell sx={tableCellSx}>{log.actor ?? '—'}</TableCell>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleString()
                      : log.createdAt
                      ? new Date(log.createdAt).toLocaleString()
                      : '—'}
                  </Typography>
                </TableCell>
                <TableCell sx={tableCellSx}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    {log.details ?? '—'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderSettings = () => (
    <Card sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', mt: 1 }}>
      <CardContent>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, mb: 2.5 }}>
          Tenant Configuration
        </Typography>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Max Users"
              type="number"
              value={settingsMaxUsers}
              onChange={(e) => setSettingsMaxUsers(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#0E7C7B' },
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Max Forms"
              type="number"
              value={settingsMaxForms}
              onChange={(e) => setSettingsMaxForms(e.target.value === '' ? '' : Number(e.target.value))}
              sx={{
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '& .MuiOutlinedInput-root': {
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#0E7C7B' },
                },
              }}
            />
          </Grid>
        </Grid>

        {/* Feature toggles */}
        {Object.keys(settingsFeatures).length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
              Features
            </Typography>
            <Grid container spacing={1} sx={{ mb: 2 }}>
              {Object.entries(settingsFeatures).map(([key, val]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={key}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={val}
                        onChange={(e) =>
                          setSettingsFeatures((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#0E7C7B' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#0E7C7B' },
                        }}
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                    }
                  />
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {settingsSaved && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Settings saved successfully.
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={handleSaveSettings}
          disabled={savingSettings}
          startIcon={savingSettings ? <CircularProgress size={16} color="inherit" /> : undefined}
          sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' } }}
        >
          {savingSettings ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  )

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 1.5, '& .MuiBreadcrumbs-separator': { color: 'rgba(255,255,255,0.4)' } }}>
        <Link
          component="button"
          underline="hover"
          sx={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          onClick={() => router.push('/super-admin/dashboard')}
        >
          Platform
        </Link>
        <Link
          component="button"
          underline="hover"
          sx={{ color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          onClick={() => router.push('/super-admin/dashboard')}
        >
          Hospitals
        </Link>
        <Typography sx={{ color: '#fff' }}>{tenant.name}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 700 }}>
              {tenant.name}
            </Typography>
            <Chip
              label={tenant.status}
              color={getStatusChipColor(tenant.status)}
              size="small"
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {tenant.subdomain}.healthplatform.com · {tenant.plan} plan
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={handleToggleStatus}
          color={tenant.status === 'active' ? 'error' : 'success'}
          sx={{
            borderColor: tenant.status === 'active' ? '#f44336' : '#4caf50',
            color: tenant.status === 'active' ? '#f44336' : '#4caf50',
            '&:hover': {
              bgcolor: tenant.status === 'active' ? 'rgba(244,67,54,0.1)' : 'rgba(76,175,80,0.1)',
            },
          }}
        >
          {tenant.status === 'active' ? 'Suspend Hospital' : 'Activate Hospital'}
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'rgba(255,255,255,0.1)', mb: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', textTransform: 'none', fontWeight: 500 },
            '& .MuiTab-root.Mui-selected': { color: '#0E7C7B' },
            '& .MuiTabs-indicator': { bgcolor: '#0E7C7B' },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Users" />
          <Tab label="Forms" />
          <Tab label="Submissions" />
          <Tab label="Audit" />
          <Tab label="Settings" />
        </Tabs>
      </Box>

      {/* Tab loading indicator */}
      {tabLoading && <LinearProgress sx={{ bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#0E7C7B' } }} />}

      {/* Tab panels */}
      {activeTab === 0 && renderOverview()}
      {activeTab === 1 && renderUsers()}
      {activeTab === 2 && renderForms()}
      {activeTab === 3 && renderSubmissions()}
      {activeTab === 4 && renderAudit()}
      {activeTab === 5 && renderSettings()}
    </Box>
  )
}
