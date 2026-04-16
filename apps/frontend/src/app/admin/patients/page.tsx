'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box, Typography, Grid, Card, CardContent, Chip, Avatar,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Paper,
  TextField, InputAdornment, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Select, FormControl, InputLabel, Skeleton,
  IconButton, Tooltip, Fade,
} from '@mui/material'
import {
  Search as SearchIcon, Add as AddIcon, People as PeopleIcon,
  VerifiedUser as VerifiedUserIcon, TodayOutlined as TodayIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import { patientApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

interface Patient {
  id: string
  mrn: string
  name: string
  dob: string
  gender: string
  bloodGroup?: string
  contactPhone?: string
  assignedDoctorId?: string
  abhaVerified: boolean
  abhaNumber?: string
  createdAt: string
}

interface Analytics {
  totalPatients: number
  abhaLinked: number
  abhaLinkageRate: number
  newThisMonth: number
  avgAge: number
}

function calcAge(dob: string) {
  const now = new Date()
  const birth = new Date(dob)
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card sx={{ height: '100%', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }, transition: 'all 200ms' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            {icon}
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  )
}

export default function PatientsPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [registerOpen, setRegisterOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dob: null as Dayjs | null, gender: '', bloodGroup: '', contactPhone: '', abhaNumber: '', abhaAddress: '' })
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => { setTenantId(getCurrentTenantId()) }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0) }, 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: patients, isLoading, mutate } = useSWR<Patient[]>(
    tenantId ? `patients-${tenantId}-${debouncedSearch}` : null,
    () => patientApi.get<Patient[]>(`/patients?tenantId=${tenantId}${debouncedSearch ? `&search=${debouncedSearch}` : ''}`).then(r => r.data),
  )

  const { data: analytics } = useSWR<Analytics>(
    tenantId ? `patient-analytics-${tenantId}` : null,
    () => patientApi.get<Analytics>(`/patients/analytics?tenantId=${tenantId}`).then(r => r.data),
  )

  const handleRegister = useCallback(async () => {
    if (!form.name || !form.dob || !form.gender) return
    setSaving(true)
    try {
      await patientApi.post('/patients', {
        tenantId,
        name: form.name,
        dob: form.dob.toISOString(),
        gender: form.gender,
        bloodGroup: form.bloodGroup || undefined,
        contactPhone: form.contactPhone || undefined,
      })
      setRegisterOpen(false)
      setForm({ name: '', dob: null, gender: '', bloodGroup: '', contactPhone: '', abhaNumber: '', abhaAddress: '' })
      mutate()
    } catch { /* silent */ } finally { setSaving(false) }
  }, [form, tenantId, mutate])

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Patients</Typography>
            <Typography variant="body2" color="text.secondary">Manage patient records and ABHA linkage</Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setRegisterOpen(true)}>
            Register Patient
          </Button>
        </Box>

        {/* KPI row */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <KpiCard label="Total Patients" value={analytics?.totalPatients ?? 0} icon={<PeopleIcon />} color="#0E7C7B" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <KpiCard label="ABHA Linked %" value={`${analytics?.abhaLinkageRate ?? 0}%`} icon={<VerifiedUserIcon />} color="#2E7D32" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <KpiCard label="New This Month" value={analytics?.newThisMonth ?? 0} icon={<TodayIcon />} color="#1565C0" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
            <KpiCard label="Avg Age" value={`${analytics?.avgAge ?? 0}y`} icon={<PersonAddIcon />} color="#6B3FA0" />
          </Grid>
        </Grid>

        {/* Search */}
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search patients by name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              },
            }}
            sx={{ maxWidth: 480 }}
          />
        </Box>

        {/* Table */}
        <Fade in>
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  {['MRN', 'Name', 'Age', 'Gender', 'Blood Group', 'ABHA', 'Actions'].map(h => (
                    <TableCell key={h} sx={{ fontWeight: 600, fontSize: 13 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton height={24} /></TableCell>
                    ))}
                  </TableRow>
                ))}
                {!isLoading && (patients ?? []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map(p => (
                  <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/patients/${p.id}`)}>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                        {p.mrn}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#0E7C7B', fontSize: 13 }}>
                          {p.name.slice(0, 1).toUpperCase()}
                        </Avatar>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{p.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{p.dob ? calcAge(p.dob) : '—'}</TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>{p.gender}</TableCell>
                    <TableCell>{p.bloodGroup || '—'}</TableCell>
                    <TableCell>
                      {p.abhaVerified
                        ? <Chip label="ABHA Linked" size="small" color="success" sx={{ fontWeight: 600 }} />
                        : <Chip label="Not Linked" size="small" color="warning" variant="outlined" />}
                    </TableCell>
                    <TableCell>
                      <Tooltip title="View patient">
                        <IconButton size="small" onClick={e => { e.stopPropagation(); router.push(`/admin/patients/${p.id}`) }}>
                          <PeopleIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && (patients ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography color="text.secondary">No patients found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={(patients ?? []).length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        </Fade>

        {/* Register Dialog */}
        <Dialog open={registerOpen} onClose={() => setRegisterOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Register New Patient</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField label="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth size="small" />
            <DatePicker
              label="Date of Birth *"
              value={form.dob}
              onChange={v => setForm(f => ({ ...f, dob: v }))}
              slotProps={{ textField: { size: 'small', fullWidth: true } }}
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Gender *</InputLabel>
              <Select value={form.gender} label="Gender *" onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                {['male', 'female', 'other'].map(g => <MenuItem key={g} value={g} sx={{ textTransform: 'capitalize' }}>{g}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Blood Group</InputLabel>
              <Select value={form.bloodGroup} label="Blood Group" onChange={e => setForm(f => ({ ...f, bloodGroup: e.target.value }))}>
                <MenuItem value="">None</MenuItem>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <MenuItem key={bg} value={bg}>{bg}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Phone" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} fullWidth size="small" />

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontWeight: 600 }}>ABHA (Optional)</Typography>
            <TextField
              label="ABHA Number (14 digits)"
              value={form.abhaNumber}
              onChange={e => setForm(f => ({ ...f, abhaNumber: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
              fullWidth size="small"
              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 14 } }}
              helperText={form.abhaNumber ? `${form.abhaNumber.length}/14 digits` : ''}
            />
            <TextField
              label="ABHA Address (X@abdm)"
              value={form.abhaAddress}
              onChange={e => setForm(f => ({ ...f, abhaAddress: e.target.value }))}
              fullWidth size="small"
              placeholder="example@abdm"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setRegisterOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleRegister}
              disabled={saving || !form.name || !form.dob || !form.gender}
            >
              {saving ? 'Registering…' : 'Register'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  )
}
