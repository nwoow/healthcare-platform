'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box,
  Button,
  Paper,
  Typography,
  Avatar,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  Assignment as AssignmentIcon,
  PersonSearch as PersonSearchIcon,
  PersonAdd as PersonAddIcon,
  LocalHospital as LocalHospitalIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { formApi, patientApi } from '@/lib/api'
import { getUser } from '@/lib/auth'
import { FormRenderer } from '@/components/form-renderer/FormRenderer'

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormSchema {
  _id: string
  name: string
  description?: string
  specialty?: string
  version: number
  tenant_id: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sections: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  conditional_logic: any[]
  layoutType?: 'wizard' | 'accordion' | 'tabs'
}

type Patient = {
  id: string
  mrn: string
  name: string
  dob?: string
  gender?: string
  bloodGroup?: string
  contactPhone?: string
  allergies?: string[]
  conditions?: string[]
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ClinicianFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = use(params)
  const router = useRouter()
  const user = getUser()

  const { data: form, isLoading, error } = useSWR(
    formId ? `form-${formId}` : null,
    () => formApi.get<FormSchema>(`/forms/${formId}`).then((r) => r.data),
  )

  // ── Patient state ──────────────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientDialogOpen, setPatientDialogOpen] = useState(true)
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [patientResults, setPatientResults] = useState<Patient[]>([])
  const [searching, setSearching] = useState(false)

  // Pre-load all patients for the initial list
  const { data: allPatients, isLoading: loadingAll } = useSWR<Patient[]>(
    user?.tenantId ? `all-patients-${user.tenantId}` : null,
    () => patientApi.get<Patient[]>(`/patients?tenantId=${user!.tenantId}`).then(r => r.data),
  )

  // Client-side filtered list: use API results when searching, else filter all patients
  const displayedPatients = useMemo(() => {
    if (patientSearch.length >= 2) return patientResults
    if (!patientSearch) return allPatients ?? []
    const q = patientSearch.toLowerCase()
    return (allPatients ?? []).filter(p =>
      p.name.toLowerCase().includes(q) || p.mrn?.toLowerCase().includes(q),
    )
  }, [patientSearch, patientResults, allPatients])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [patientHistory, setPatientHistory] = useState<any>(null)

  // Register form state
  const [regName, setRegName] = useState('')
  const [regDob, setRegDob] = useState('')
  const [regGender, setRegGender] = useState('')
  const [regBloodGroup, setRegBloodGroup] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regSaving, setRegSaving] = useState(false)
  const [regError, setRegError] = useState('')

  // ── Debounced patient search ───────────────────────────────────────────────
  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) {
      setPatientResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await patientApi.get('/patients', {
          params: { search: patientSearch, tenantId: user?.tenantId || 'system' },
        })
        setPatientResults(res.data as Patient[])
      } catch {
        setPatientResults([])
      }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [patientSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectPatient = async (patient: Patient) => {
    setSelectedPatient(patient)
    setPatientDialogOpen(false)
    setPatientSearch('')
    setPatientResults([])
    try {
      const res = await patientApi.get(`/patients/${patient.id}/history`)
      setPatientHistory(res.data)
    } catch {
      setPatientHistory(null)
    }
  }

  const handleRegisterPatient = async () => {
    if (!regName.trim()) {
      setRegError('Full name is required')
      return
    }
    setRegSaving(true)
    setRegError('')
    try {
      const { data } = await patientApi.post('/patients', {
        name: regName.trim(),
        dob: regDob || undefined,
        gender: regGender || undefined,
        bloodGroup: regBloodGroup || undefined,
        contactPhone: regPhone || undefined,
        tenantId: user?.tenantId || 'system',
      })
      await handleSelectPatient(data as Patient)
      setRegisterDialogOpen(false)
      // reset register form
      setRegName(''); setRegDob(''); setRegGender('')
      setRegBloodGroup(''); setRegPhone(''); setRegError('')
    } catch {
      setRegError('Failed to register patient. Please try again.')
    }
    setRegSaving(false)
  }

  // ── Loading / error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Skeleton variant="rectangular" height={56} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    )
  }

  if (error || !form) {
    return (
      <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Box sx={{ textAlign: 'center' }}>
          <WarningIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" gutterBottom>Form not found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This form may have been removed or you don&apos;t have access.
          </Typography>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => router.back()}>
            Go Back
          </Button>
        </Box>
      </Box>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 900, mx: 'auto' }}>

      {/* ── Back + breadcrumb ──────────────────────────────────────────── */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push('/clinician/dashboard')}
        sx={{ mb: 2, color: 'text.secondary' }}
        size="small"
      >
        Back to Dashboard
      </Button>

      {/* ── Form header card ───────────────────────────────────────────── */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 3 },
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Avatar
          sx={{
            bgcolor: 'primary.main',
            width: 48,
            height: 48,
            flexShrink: 0,
          }}
        >
          <AssignmentIcon />
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={700} noWrap>
            {form.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            {form.specialty && (
              <Chip label={form.specialty} size="small" color="primary" sx={{ textTransform: 'capitalize' }} />
            )}
            <Chip label={`v${form.version}`} size="small" variant="outlined" />
            <Chip
              label={form.layoutType ?? 'wizard'}
              size="small"
              variant="outlined"
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>
          {form.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {form.description}
            </Typography>
          )}
        </Box>
      </Paper>

      {/* ── Patient info bar ───────────────────────────────────────────── */}
      {selectedPatient ? (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 2,
            border: '1px solid',
            borderColor: 'primary.light',
            borderRadius: 2,
            bgcolor: 'primary.50',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <LocalHospitalIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>
              {selectedPatient.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              MRN: {selectedPatient.mrn}
              {selectedPatient.dob ? ` · DOB: ${selectedPatient.dob}` : ''}
              {selectedPatient.bloodGroup ? ` · ${selectedPatient.bloodGroup}` : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {selectedPatient.allergies?.map((a) => (
              <Chip key={a} label={`⚠ ${a}`} color="error" size="small" />
            ))}
            {selectedPatient.conditions?.map((c) => (
              <Chip key={c} label={c} size="small" variant="outlined" />
            ))}
          </Box>
          <Button size="small" variant="outlined" onClick={() => setPatientDialogOpen(true)}>
            Change
          </Button>
        </Paper>
      ) : (
        <Alert
          severity="info"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button size="small" onClick={() => setPatientDialogOpen(true)}>
              Select
            </Button>
          }
        >
          No patient selected. Select a patient to associate this submission.
        </Alert>
      )}

      {/* ── Form Renderer ──────────────────────────────────────────────── */}
      <FormRenderer
        form={form}
        patientId={selectedPatient?.id}
        patientHistory={patientHistory}
        onSubmitted={() => {
          setTimeout(() => router.push('/clinician/dashboard'), 1800)
        }}
      />

      {/* ── Patient Selector Dialog ────────────────────────────────────── */}
      <Dialog
        open={patientDialogOpen}
        maxWidth="sm"
        fullWidth
        onClose={(_e, reason) => {
          if (reason === 'escapeKeyDown' || reason === 'backdropClick') return
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PersonSearchIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={600}>Select Patient</Typography>
              <Typography variant="body2" color="text.secondary">
                Search for an existing patient or register a new one
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            autoFocus
            placeholder="Search by name or MRN…"
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
              htmlInput: { suppressHydrationWarning: true },
            }}
            sx={{ mb: 1 }}
          />
          {(searching || (loadingAll && !patientSearch)) && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
          {!searching && !(loadingAll && !patientSearch) && displayedPatients.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              {patientSearch ? `No patients found for "${patientSearch}"` : 'No patients registered yet'}
            </Typography>
          )}
          {!searching && !(loadingAll && !patientSearch) && displayedPatients.length > 0 && (
            <>
              {!patientSearch && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {displayedPatients.length} patient{displayedPatients.length !== 1 ? 's' : ''} — type to filter
                </Typography>
              )}
              <List disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {displayedPatients.map((p) => (
                  <ListItem key={p.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      onClick={() => handleSelectPatient(p)}
                      sx={{ borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 14 }}>
                          {p.name?.[0]?.toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Typography variant="body2" fontWeight={600}>{p.name}</Typography>}
                        secondary={`MRN: ${p.mrn}${p.dob ? ` · ${p.dob}` : ''}${p.bloodGroup ? ` · ${p.bloodGroup}` : ''}`}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </DialogContent>
        <Divider />
        <DialogActions sx={{ justifyContent: 'space-between', px: 2.5, py: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<PersonAddIcon />}
            onClick={() => { setPatientDialogOpen(false); setRegisterDialogOpen(true) }}
          >
            Register New Patient
          </Button>
          <Button onClick={() => setPatientDialogOpen(false)} color="inherit">
            Skip
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Register Patient Dialog ────────────────────────────────────── */}
      <Dialog
        open={registerDialogOpen}
        maxWidth="sm"
        fullWidth
        onClose={() => setRegisterDialogOpen(false)}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PersonAddIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>Register New Patient</Typography>
          </Box>
        </DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Full Name *"
              fullWidth
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              error={!!regError && !regName.trim()}
              helperText={!regName.trim() && regError ? regError : ''}
            />
            <TextField
              label="Date of Birth"
              type="date"
              fullWidth
              value={regDob}
              onChange={(e) => setRegDob(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <FormControl fullWidth>
              <InputLabel>Gender</InputLabel>
              <Select value={regGender} label="Gender" onChange={(e) => setRegGender(e.target.value)}>
                <MenuItem value="">None</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Blood Group</InputLabel>
              <Select value={regBloodGroup} label="Blood Group" onChange={(e) => setRegBloodGroup(e.target.value)}>
                <MenuItem value="">None</MenuItem>
                {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                  <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Phone"
              fullWidth
              value={regPhone}
              onChange={(e) => setRegPhone(e.target.value)}
            />
            {regError && regName.trim() && (
              <Alert severity="error">{regError}</Alert>
            )}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={() => setRegisterDialogOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleRegisterPatient} disabled={regSaving}>
            {regSaving ? 'Registering…' : 'Register Patient'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
