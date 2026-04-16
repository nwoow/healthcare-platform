'use client'

import { use, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box, Typography, Grid, Card, CardContent, Chip, Avatar, Tab, Tabs,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress, Alert,
  IconButton, Paper, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon, VerifiedUser as VerifiedUserIcon,
  LinkOff as LinkOffIcon, ContentCopy as CopyIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'
import { patientApi, submissionApi } from '@/lib/api'

interface Patient {
  id: string; mrn: string; name: string; dob: string; gender: string
  bloodGroup?: string; contactPhone?: string; contactEmail?: string
  abhaVerified: boolean; abhaNumber?: string; abhaAddress?: string; abhaLinkedAt?: string
  createdAt: string
}
interface TimelineEntry { date: string; type: string; summary: string; doctorId: string }
interface HistoryEntry { _id: string; visitDate: string; visitType: string; chiefComplaint: string; diagnosis: string; doctorId: string; notes?: string }
interface Submission { _id: string; form_id: string; status: string; createdAt: string; submitted_by: string; form_version: number }
interface Consent { _id: string; consentId: string; purpose: string; status: string; requestedBy: string; dataCategories: string[]; grantedAt?: string; expiresAt?: string }

function calcAge(dob: string) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

export default function PatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState(0)
  const [linkAbhaOpen, setLinkAbhaOpen] = useState(false)
  const [abhaForm, setAbhaForm] = useState({ abhaNumber: '', abhaAddress: '' })
  const [linking, setLinking] = useState(false)
  const [fhirDialogOpen, setFhirDialogOpen] = useState(false)
  const [consentDialogOpen, setConsentDialogOpen] = useState(false)
  const [consentForm, setConsentForm] = useState({ purpose: 'CARE_MANAGEMENT', requestedBy: 'doctor_001', dataCategories: ['OPConsultation'], from: '', to: '' })
  const [requesting, setRequesting] = useState(false)

  const { data: patient, mutate: mutatePatient } = useSWR<Patient>(
    patientId ? `patient-${patientId}` : null,
    () => patientApi.get<Patient>(`/patients/${patientId}`).then(r => r.data),
  )

  const { data: history } = useSWR<HistoryEntry[]>(
    patientId && tab === 1 ? `history-${patientId}` : null,
    () => patientApi.get<HistoryEntry[]>(`/patients/${patientId}/history`).then(r => r.data),
  )

  const { data: submissions } = useSWR<Submission[]>(
    patientId && tab === 2 ? `submissions-patient-${patientId}` : null,
    () => submissionApi.get<Submission[]>(`/submissions?patientId=${patientId}`).then(r => r.data),
  )

  const { data: consents, mutate: mutateConsents } = useSWR<Consent[]>(
    patientId && tab === 3 ? `consents-${patientId}` : null,
    () => patientApi.get<Consent[]>(`/patients/${patientId}/consent`).then(r => r.data),
  )

  const { data: fhirData } = useSWR(
    patientId && tab === 4 ? `fhir-${patientId}` : null,
    () => patientApi.get(`/patients/${patientId}/fhir`).then(r => r.data),
  )

  const handleLinkAbha = useCallback(async () => {
    if (!abhaForm.abhaNumber || !abhaForm.abhaAddress) return
    setLinking(true)
    try {
      await patientApi.post(`/patients/${patientId}/link-abha`, abhaForm)
      setLinkAbhaOpen(false)
      setAbhaForm({ abhaNumber: '', abhaAddress: '' })
      mutatePatient()
    } catch { /* silent */ } finally { setLinking(false) }
  }, [abhaForm, patientId, mutatePatient])

  const handleRequestConsent = useCallback(async () => {
    setRequesting(true)
    try {
      await patientApi.post(`/patients/${patientId}/consent/request`, {
        ...consentForm,
        dateRange: { from: consentForm.from, to: consentForm.to },
      })
      setConsentDialogOpen(false)
      setTimeout(() => mutateConsents(), 2500) // auto-granted after 2s
    } catch { /* silent */ } finally { setRequesting(false) }
  }, [consentForm, patientId, mutateConsents])

  if (!patient) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}><CircularProgress /></Box>
  }

  const fhirJson = fhirData ? JSON.stringify(fhirData, null, 2) : ''

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Back button */}
      <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/admin/patients')} sx={{ mb: 2 }}>
        Back to Patients
      </Button>

      {/* Header card */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: '#0E7C7B', fontSize: 22 }}>
              {patient.name.slice(0, 1).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{patient.name}</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{patient.mrn}</Typography>
                <Typography variant="caption" color="text.secondary">•</Typography>
                <Typography variant="caption" color="text.secondary">{calcAge(patient.dob)} years • {patient.gender}</Typography>
                {patient.bloodGroup && <>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Chip label={patient.bloodGroup} size="small" color="error" variant="outlined" />
                </>}
              </Box>
            </Box>
            {/* ABHA status */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {patient.abhaVerified
                ? <Chip icon={<VerifiedUserIcon />} label={`ABHA: ${patient.abhaNumber?.slice(0,6)}…`} color="success" size="small" sx={{ fontWeight: 600 }} />
                : <Chip icon={<LinkOffIcon />} label="ABHA Not Linked" color="warning" size="small" variant="outlined" />}
              {!patient.abhaVerified && (
                <Button size="small" variant="outlined" onClick={() => setLinkAbhaOpen(true)}>Link ABHA</Button>
              )}
              {tab === 4 && (
                <Button size="small" variant="outlined" onClick={() => setFhirDialogOpen(true)}>View FHIR Record</Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        {['Overview', 'History', 'Submissions', 'Consent', 'FHIR'].map((label, i) => (
          <Tab key={label} label={label} value={i} />
        ))}
      </Tabs>

      {/* Tab: Overview */}
      {tab === 0 && (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Demographics</Typography>
                {[
                  ['Full Name', patient.name],
                  ['Date of Birth', new Date(patient.dob).toLocaleDateString()],
                  ['Age', `${calcAge(patient.dob)} years`],
                  ['Gender', patient.gender],
                  ['Blood Group', patient.bloodGroup || '—'],
                  ['Phone', patient.contactPhone || '—'],
                  ['Email', patient.contactEmail || '—'],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>ABHA Status</Typography>
                {patient.abhaVerified ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Alert severity="success">ABHA linked and verified</Alert>
                    {[
                      ['ABHA Number (masked)', patient.abhaNumber ? patient.abhaNumber.slice(0,6) + '••••••••' : '—'],
                      ['ABHA Address', patient.abhaAddress || '—'],
                      ['Linked At', patient.abhaLinkedAt ? new Date(patient.abhaLinkedAt).toLocaleDateString() : '—'],
                    ].map(([l, v]) => (
                      <Box key={l} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="body2" color="text.secondary">{l}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{v}</Typography>
                      </Box>
                    ))}
                    <Button variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => { setTab(4); setFhirDialogOpen(true) }}>
                      View FHIR Record
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Alert severity="warning">ABHA not linked</Alert>
                    <Typography variant="body2" color="text.secondary">
                      Link the patient's Ayushman Bharat Health Account to enable FHIR record sharing and ABDM compliance.
                    </Typography>
                    <Button variant="contained" size="small" onClick={() => setLinkAbhaOpen(true)}>
                      Link ABHA
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab: History */}
      {tab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Visit History</Typography>
            {!history ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : history.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No visit history recorded yet.</Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      {['Date', 'Type', 'Chief Complaint', 'Diagnosis', 'Notes'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map(h => (
                      <TableRow key={h._id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(h.visitDate).toLocaleDateString()}</TableCell>
                        <TableCell><Chip label={h.visitType} size="small" variant="outlined" /></TableCell>
                        <TableCell>{h.chiefComplaint}</TableCell>
                        <TableCell>{h.diagnosis}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{h.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Submissions */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Form Submissions</Typography>
            {!submissions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
            ) : submissions.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No form submissions for this patient yet.</Typography>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      {['Date', 'Form ID', 'Version', 'Status', 'Action'].map(h => (
                        <TableCell key={h} sx={{ fontWeight: 600, fontSize: 12 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {submissions.map(s => {
                      const statusColor: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
                        draft: 'default', submitted: 'primary', under_review: 'warning',
                        approved: 'success', rejected: 'error',
                      }
                      return (
                        <TableRow key={s._id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(s.createdAt).toLocaleString()}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, color: 'text.secondary' }}>{s.form_id}</TableCell>
                          <TableCell>v{s.form_version}</TableCell>
                          <TableCell>
                            <Chip label={s.status.replace(/_/g, ' ')} size="small" color={statusColor[s.status] ?? 'default'} sx={{ textTransform: 'capitalize' }} />
                          </TableCell>
                          <TableCell>
                            <Button size="small" variant="outlined" href={`/admin/forms/submissions/${s._id}`}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Consent */}
      {tab === 3 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" size="small" onClick={() => setConsentDialogOpen(true)}>
              Request Consent
            </Button>
          </Box>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>Consent Artifacts</Typography>
              {(!consents || consents.length === 0) ? (
                <Typography variant="body2" color="text.secondary">No consent artifacts yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {consents.map(c => (
                    <Paper key={c._id} variant="outlined" sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.purpose}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Requested by: {c.requestedBy} • Categories: {c.dataCategories.join(', ')}
                          </Typography>
                        </Box>
                        <Chip
                          label={c.status}
                          size="small"
                          color={c.status === 'GRANTED' ? 'success' : c.status === 'DENIED' || c.status === 'REVOKED' ? 'error' : 'warning'}
                        />
                        {c.expiresAt && (
                          <Typography variant="caption" color="text.secondary">
                            Expires: {new Date(c.expiresAt).toLocaleDateString()}
                          </Typography>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Tab: FHIR */}
      {tab === 4 && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>FHIR R4 Patient Resource</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Copy JSON">
                  <IconButton size="small" onClick={() => navigator.clipboard?.writeText(fhirJson)}>
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download JSON">
                  <IconButton size="small" onClick={() => {
                    const blob = new Blob([fhirJson], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = `fhir-patient-${patientId}.json`; a.click()
                    URL.revokeObjectURL(url)
                  }}>
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
            {fhirData ? (
              <Box
                component="pre"
                sx={{
                  bgcolor: 'grey.900', color: '#a5f3fc', p: 2, borderRadius: 1,
                  fontSize: 12, overflowX: 'auto', maxHeight: 500, overflowY: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                {fhirJson}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Link ABHA Dialog */}
      <Dialog open={linkAbhaOpen} onClose={() => setLinkAbhaOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Link ABHA</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="ABHA Number (14 digits)"
            value={abhaForm.abhaNumber}
            onChange={e => setAbhaForm(f => ({ ...f, abhaNumber: e.target.value.replace(/\D/g, '').slice(0, 14) }))}
            fullWidth size="small"
            helperText={`${abhaForm.abhaNumber.length}/14 digits`}
          />
          <TextField
            label="ABHA Address (X@abdm)"
            value={abhaForm.abhaAddress}
            onChange={e => setAbhaForm(f => ({ ...f, abhaAddress: e.target.value }))}
            fullWidth size="small"
            placeholder="example@abdm"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLinkAbhaOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkAbha} disabled={linking || abhaForm.abhaNumber.length !== 14 || !abhaForm.abhaAddress.includes('@abdm')}>
            {linking ? 'Linking…' : 'Link ABHA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Request Consent Dialog */}
      <Dialog open={consentDialogOpen} onClose={() => setConsentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Request Consent</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Purpose</InputLabel>
            <Select value={consentForm.purpose} label="Purpose" onChange={e => setConsentForm(f => ({ ...f, purpose: e.target.value }))}>
              {['CARE_MANAGEMENT', 'BREAK_THE_GLASS', 'PAYMENT', 'RESEARCH'].map(p => <MenuItem key={p} value={p}>{p.replace(/_/g, ' ')}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Requested By" value={consentForm.requestedBy} onChange={e => setConsentForm(f => ({ ...f, requestedBy: e.target.value }))} size="small" fullWidth />
          <TextField label="From Date" type="date" value={consentForm.from} onChange={e => setConsentForm(f => ({ ...f, from: e.target.value }))} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="To Date" type="date" value={consentForm.to} onChange={e => setConsentForm(f => ({ ...f, to: e.target.value }))} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConsentDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRequestConsent} disabled={requesting}>
            {requesting ? 'Requesting…' : 'Request (auto-granted in 2s)'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* FHIR Dialog */}
      <Dialog open={fhirDialogOpen} onClose={() => setFhirDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          FHIR R4 Patient Resource
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => navigator.clipboard?.writeText(fhirJson)}><CopyIcon fontSize="small" /></IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{ bgcolor: 'grey.900', color: '#a5f3fc', p: 2, borderRadius: 1, fontSize: 12, overflowX: 'auto', maxHeight: 450, overflowY: 'auto', fontFamily: 'monospace' }}>
            {fhirJson || 'Loading…'}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFhirDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
