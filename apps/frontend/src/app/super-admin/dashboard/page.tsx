'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Paper,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Skeleton,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
} from '@mui/material'
import {
  Apartment as ApartmentIcon,
  CheckCircle as CheckCircleIcon,
  Group as GroupIcon,
  Assignment as AssignmentIcon,
  Visibility as VisibilityIcon,
  PauseCircle as PauseCircleIcon,
  PlayCircle as PlayCircleIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { tenantApi } from '@/lib/api'
import RegisterTenantDialog from '@/components/super-admin/RegisterTenantDialog'

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

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
}

function StatCard({ label, value, icon, iconBg }: StatCardProps) {
  return (
    <Card sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, color: '#fff' }}>
              {value}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5 }}>
              {label}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

function getPlanChipColor(plan: string): 'default' | 'primary' | 'warning' {
  if (plan === 'professional') return 'primary'
  if (plan === 'enterprise') return 'warning'
  return 'default'
}

function getStatusChipColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'error'
  if (status === 'provisioning') return 'warning'
  return 'default'
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [registerOpen, setRegisterOpen] = useState(false)

  const fetchTenants = async () => {
    try {
      const res = await tenantApi.get('/tenants')
      setTenants(res.data ?? [])
    } catch {
      setTenants([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTenants()
  }, [])

  const totalTenants = tenants.length
  const activeTenants = tenants.filter((t) => t.status === 'active').length

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) // Added ID to search
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active'
    try {
      await tenantApi.patch(`/tenants/${tenant.id}/status`, { status: newStatus })
      setTenants((prev) =>
        prev.map((t) => (t.id === tenant.id ? { ...t, status: newStatus } : t))
      )
    } catch {
      // silently fail - could add error handling here
    }
  }

  const tableCellSx = { color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.08)' }
  const tableHeadCellSx = { color: 'rgba(255,255,255,0.5)', fontWeight: 600, borderColor: 'rgba(255,255,255,0.08)', fontSize: 12 }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: '#fff' }}>
          Platform Dashboard
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Overview of all registered hospitals and tenants
        </Typography>
      </Box>

      {/* ROW 1 — Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Tenants"
            value={loading ? '—' : totalTenants}
            icon={<ApartmentIcon />}
            iconBg="#0E7C7B"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Active Tenants"
            value={loading ? '—' : activeTenants}
            icon={<CheckCircleIcon />}
            iconBg="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Users"
            value="—"
            icon={<GroupIcon />}
            iconBg="#1565C0"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Total Submissions"
            value="—"
            icon={<AssignmentIcon />}
            iconBg="#6B3FA0"
          />
        </Grid>
      </Grid>

      {/* ROW 2 — Hospitals table */}
      <Paper
        sx={{
          bgcolor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            p: 2.5,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 600, color: '#fff' }}>
            Registered Hospitals
          </Typography>
          <Button
            variant="contained"
            startIcon={<ApartmentIcon />}
            onClick={() => setRegisterOpen(true)}
            sx={{
              bgcolor: '#0E7C7B',
              '&:hover': { bgcolor: '#0A6160' },
              fontWeight: 600,
            }}
          >
            + Register New Hospital
          </Button>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2, px: 2.5, py: 2 }}>
          <TextField
            size="small"
            placeholder="Search hospitals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              flex: 1,
              minWidth: 220,
              '& .MuiOutlinedInput-root': {
                color: '#fff',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
                '&.Mui-focused fieldset': { borderColor: '#0E7C7B' },
              },
              '& input::placeholder': { color: 'rgba(255,255,255,0.4)' },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  </InputAdornment>
                ),
              },
              htmlInput: { suppressHydrationWarning: true },
            }}
          />
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, val) => { if (val !== null) setStatusFilter(val) }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.6)',
                borderColor: 'rgba(255,255,255,0.2)',
                fontSize: 12,
                px: 1.5,
                '&.Mui-selected': {
                  bgcolor: '#0E7C7B',
                  color: '#fff',
                  '&:hover': { bgcolor: '#0A6160' },
                },
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
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: 'rgba(0,0,0,0.2)' }}>
                <TableCell sx={tableHeadCellSx}>HOSPITAL NAME</TableCell>
                {/* Added TENANT ID Header */}
                <TableCell sx={tableHeadCellSx}>TENANT ID</TableCell> 
                <TableCell sx={tableHeadCellSx}>SUBDOMAIN</TableCell>
                <TableCell sx={tableHeadCellSx}>PLAN</TableCell>
                <TableCell sx={tableHeadCellSx}>STATUS</TableCell>
                <TableCell sx={tableHeadCellSx}>ADMIN</TableCell>
                <TableCell sx={tableHeadCellSx}>CREATED</TableCell>
                <TableCell sx={tableHeadCellSx} align="center">ACTIONS</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {/* Updated length from 7 to 8 for skeletons */}
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j} sx={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                        <Skeleton variant="rectangular" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  {/* Updated colSpan from 7 to 8 */}
                  <TableCell colSpan={8} align="center" sx={{ py: 6, borderColor: 'rgba(255,255,255,0.08)' }}>
                    <ApartmentIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.2)', mb: 1, display: 'block', mx: 'auto' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
                      No hospitals registered
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => setRegisterOpen(true)}
                      sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' } }}
                    >
                      Register First Hospital
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id} hover sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell sx={tableCellSx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ApartmentIcon sx={{ fontSize: 18, color: '#0E7C7B' }} />
                        <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                          {tenant.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    
                    {/* Added TENANT ID Cell */}
                    <TableCell sx={tableCellSx}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255,255,255,0.6)', 
                          fontFamily: 'monospace', 
                          fontSize: 12,
                          letterSpacing: 0.5
                        }}
                      >
                        {tenant.id}
                      </Typography>
                    </TableCell>

                    <TableCell sx={tableCellSx}>
                      <Chip
                        label={tenant.subdomain}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.85)',
                          fontFamily: 'monospace',
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      <Chip
                        label={tenant.plan}
                        color={getPlanChipColor(tenant.plan)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      <Chip
                        label={tenant.status}
                        color={getStatusChipColor(tenant.status)}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                        {tenant.adminEmail ?? '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                        {new Date(tenant.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell sx={tableCellSx} align="center">
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/super-admin/tenants/${tenant.id}`)}
                          sx={{ color: '#0E7C7B' }}
                          title="View details"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleToggleStatus(tenant)}
                          sx={{ color: tenant.status === 'active' ? '#f57c00' : '#4caf50' }}
                          title={tenant.status === 'active' ? 'Suspend' : 'Activate'}
                        >
                          {tenant.status === 'active' ? (
                            <PauseCircleIcon fontSize="small" />
                          ) : (
                            <PlayCircleIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Register Dialog */}
      <RegisterTenantDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={() => {
          setRegisterOpen(false)
          fetchTenants()
        }}
      />
    </Box>
  )
}