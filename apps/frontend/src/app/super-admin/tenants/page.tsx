'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Skeleton,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Avatar,
  Tooltip,
  Alert,
} from '@mui/material'
import {
  Apartment as ApartmentIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  PauseCircle as PauseCircleIcon,
  PlayCircle as PlayCircleIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { tenantApi } from '@/lib/api'
import RegisterTenantDialog from '@/components/super-admin/RegisterTenantDialog'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string
  name: string
  subdomain: string
  plan: string
  status: string
  adminEmail?: string
  createdAt: string
  config?: {
    maxUsers?: number
    maxForms?: number
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fetchTenants = () =>
  tenantApi.get<Tenant[]>('/tenants').then((r) => r.data ?? [])

function getPlanColor(plan: string): 'default' | 'primary' | 'warning' | 'secondary' {
  if (plan === 'enterprise') return 'warning'
  if (plan === 'professional') return 'primary'
  return 'default'
}

function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'error'
  if (status === 'provisioning') return 'warning'
  return 'default'
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const AVATAR_COLORS = ['#0E7C7B', '#1565C0', '#6B3FA0', '#C2185B', '#E65100', '#2e7d32']
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Cell styles ────────────────────────────────────────────────────────────────

const cellSx = { color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.08)' }
const headSx = {
  color: 'rgba(255,255,255,0.5)',
  fontWeight: 600,
  borderColor: 'rgba(255,255,255,0.08)',
  fontSize: 11,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const router = useRouter()
  const { data: tenants = [], isLoading, error, mutate } = useSWR('super-admin/tenants', fetchTenants)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const filtered = tenants.filter((t) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.subdomain.toLowerCase().includes(q) ||
      (t.adminEmail ?? '').toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    setTogglingId(tenant.id)
    try {
      await tenantApi.patch(`/tenants/${tenant.id}/status`, { status: newStatus })
      await mutate()
    } catch {
      // no-op
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
            Registered Hospitals
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>
            {isLoading ? '…' : `${tenants.length} hospital${tenants.length !== 1 ? 's' : ''} total · ${tenants.filter(t => t.status === 'active').length} active`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => mutate()}
              sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setRegisterOpen(true)}
            sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' }, fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Register Hospital
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load hospitals. Make sure the tenant service is running on port 3010.
        </Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by name, subdomain, or admin email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            flex: 1,
            minWidth: 240,
            '& .MuiOutlinedInput-root': {
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.05)',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.35)' },
              '&.Mui-focused fieldset': { borderColor: '#0E7C7B' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.35)' },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 18 }} />
                </InputAdornment>
              ),
            },
            htmlInput: { suppressHydrationWarning: true },
          }}
        />
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, v) => { if (v !== null) setStatusFilter(v) }}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              color: 'rgba(255,255,255,0.55)',
              borderColor: 'rgba(255,255,255,0.15)',
              fontSize: 12,
              px: 1.5,
              '&.Mui-selected': { bgcolor: '#0E7C7B', color: '#fff', '&:hover': { bgcolor: '#0A6160' } },
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="active">Active</ToggleButton>
          <ToggleButton value="suspended">Suspended</ToggleButton>
          <ToggleButton value="provisioning">Provisioning</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Table */}
      <Paper
        sx={{
          bgcolor: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.25)' }}>
                <TableCell sx={headSx}>Hospital</TableCell>
                <TableCell sx={headSx}>Subdomain</TableCell>
                <TableCell sx={headSx}>Plan</TableCell>
                <TableCell sx={headSx}>Status</TableCell>
                <TableCell sx={headSx}>Admin</TableCell>
                <TableCell sx={headSx}>Registered</TableCell>
                <TableCell sx={headSx} align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <Skeleton variant="rectangular" height={18} sx={{ bgcolor: 'rgba(255,255,255,0.07)' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8, borderColor: 'transparent' }}>
                    <ApartmentIcon sx={{ fontSize: 52, color: 'rgba(255,255,255,0.15)', display: 'block', mx: 'auto', mb: 1.5 }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mb: 2 }}>
                      {search || statusFilter !== 'all' ? 'No hospitals match your filters' : 'No hospitals registered yet'}
                    </Typography>
                    {!search && statusFilter === 'all' && (
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setRegisterOpen(true)}
                        sx={{ borderColor: '#0E7C7B', color: '#0E7C7B', '&:hover': { borderColor: '#0A6160', bgcolor: 'rgba(14,124,123,0.08)' } }}
                      >
                        Register First Hospital
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    hover
                    sx={{
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                      '& td': { borderColor: 'rgba(255,255,255,0.06)' },
                    }}
                  >
                    {/* Hospital name + avatar */}
                    <TableCell sx={cellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: avatarColor(tenant.name),
                            fontSize: 13,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(tenant.name)}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#fff' }}>
                            {tenant.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                            ID: {tenant.id.slice(0, 8)}…
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Subdomain */}
                    <TableCell sx={cellSx}>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'monospace', color: '#0E7C7B', fontSize: 13 }}
                      >
                        {tenant.subdomain}
                      </Typography>
                    </TableCell>

                    {/* Plan */}
                    <TableCell sx={cellSx}>
                      <Chip
                        label={tenant.plan}
                        color={getPlanColor(tenant.plan)}
                        size="small"
                        sx={{ textTransform: 'capitalize', fontSize: 11 }}
                      />
                    </TableCell>

                    {/* Status */}
                    <TableCell sx={cellSx}>
                      <Chip
                        label={tenant.status}
                        color={getStatusColor(tenant.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize', fontSize: 11 }}
                      />
                    </TableCell>

                    {/* Admin email */}
                    <TableCell sx={cellSx}>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                        {tenant.adminEmail ?? '—'}
                      </Typography>
                    </TableCell>

                    {/* Created date */}
                    <TableCell sx={cellSx}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                        {new Date(tenant.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Typography>
                    </TableCell>

                    {/* Actions */}
                    <TableCell align="center" sx={cellSx}>
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title="View details">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                            sx={{ color: 'rgba(255,255,255,0.6)', '&:hover': { color: '#fff' } }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={tenant.status === 'active' ? 'Suspend' : 'Activate'}>
                          <IconButton
                            size="small"
                            disabled={togglingId === tenant.id || tenant.status === 'provisioning'}
                            onClick={() => handleToggleStatus(tenant)}
                            sx={{
                              color: tenant.status === 'active'
                                ? 'rgba(255,100,100,0.7)'
                                : 'rgba(100,200,100,0.7)',
                              '&:hover': {
                                color: tenant.status === 'active' ? '#f44336' : '#4caf50',
                              },
                            }}
                          >
                            {tenant.status === 'active'
                              ? <PauseCircleIcon fontSize="small" />
                              : <PlayCircleIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.35)' }}>
              Showing {filtered.length} of {tenants.length} hospitals
            </Typography>
          </Box>
        )}
      </Paper>

      {/* Register Dialog */}
      <RegisterTenantDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={() => mutate()}
      />
    </Box>
  )
}
