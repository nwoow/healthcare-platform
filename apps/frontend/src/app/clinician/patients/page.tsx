'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box, Typography, Grid, Card, CardContent, Chip, TextField,
  InputAdornment, Skeleton, Avatar, Fade, Alert, Button,
} from '@mui/material'
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Badge as BadgeIcon,
  Wc as GenderIcon,
  Bloodtype as BloodIcon,
} from '@mui/icons-material'
import { patientApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

interface Patient {
  id: string
  mrn: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  bloodGroup?: string
  phone?: string
  tenantId: string
  abhaNumber?: string
  abhaVerified?: boolean
}

function calcAge(dob: string): number {
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

function getGenderColor(gender: string): string {
  if (gender?.toLowerCase() === 'male') return '#1565C0'
  if (gender?.toLowerCase() === 'female') return '#C2185B'
  return '#607D8B'
}

function PatientCard({ patient, onClick }: { patient: Patient; onClick: () => void }) {
  const initials = `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase()
  const age = patient.dateOfBirth ? calcAge(patient.dateOfBirth) : null

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        height: '100%',
        transition: 'all 180ms ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Avatar
            sx={{
              width: 44, height: 44,
              bgcolor: getGenderColor(patient.gender),
              fontSize: 15, fontWeight: 700,
            }}
          >
            {initials || <PersonIcon />}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              MRN: {patient.mrn}
            </Typography>
          </Box>
          {patient.abhaVerified && (
            <Chip label="ABHA" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {age !== null && (
            <Chip
              icon={<BadgeIcon sx={{ fontSize: 13 }} />}
              label={`${age} yrs`}
              size="small"
              variant="outlined"
              sx={{ fontSize: 11 }}
            />
          )}
          {patient.gender && (
            <Chip
              icon={<GenderIcon sx={{ fontSize: 13 }} />}
              label={patient.gender}
              size="small"
              variant="outlined"
              sx={{ fontSize: 11, textTransform: 'capitalize' }}
            />
          )}
          {patient.bloodGroup && (
            <Chip
              icon={<BloodIcon sx={{ fontSize: 13 }} />}
              label={patient.bloodGroup}
              size="small"
              variant="outlined"
              sx={{ fontSize: 11 }}
            />
          )}
        </Box>

        {patient.phone && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            {patient.phone}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default function ClinicianPatientsPage() {
  const router = useRouter()
  const [tenantId, setTenantId] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    setTenantId(getCurrentTenantId())
  }, [])

  // Debounce search input by 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: patients, isLoading, error, mutate } = useSWR<Patient[]>(
    tenantId ? `clinician-patients-${tenantId}-${debouncedSearch}` : null,
    () =>
      patientApi
        .get<Patient[]>('/patients', {
          params: {
            tenantId,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
        })
        .then((r) => r.data),
  )

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          My Patients
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View patient profiles and history
        </Typography>
      </Box>

      {/* Search */}
      <TextField
        placeholder="Search by name, MRN, or phone…"
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3, maxWidth: 480 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Error */}
      {error && (
        <Alert
          severity="error"
          action={<Button size="small" onClick={() => mutate()}>Retry</Button>}
          sx={{ mb: 3 }}
        >
          Failed to load patients.
        </Alert>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <Grid container spacing={2.5}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <Skeleton variant="rectangular" height={140} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Empty state */}
      {!isLoading && !error && (patients ?? []).length === 0 && (
        <Fade in>
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <PersonIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              {debouncedSearch ? 'No patients match your search' : 'No patients registered yet'}
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Patients are registered by the admin portal.
            </Typography>
          </Box>
        </Fade>
      )}

      {/* Patients grid */}
      {!isLoading && (patients ?? []).length > 0 && (
        <Fade in>
          <Grid container spacing={2.5}>
            {(patients ?? []).map((patient) => (
              <Grid key={patient.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <PatientCard
                  patient={patient}
                  onClick={() => router.push(`/admin/patients/${patient.id}`)}
                />
              </Grid>
            ))}
          </Grid>
        </Fade>
      )}
    </Box>
  )
}
