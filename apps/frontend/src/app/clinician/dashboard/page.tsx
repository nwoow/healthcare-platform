'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Skeleton,
  Alert,
  Badge,
  Link,
  Fade,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Article as ArticleIcon,
  Search as SearchIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material'
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab'
import { formApi, submissionApi } from '@/lib/api'
import { getUser } from '@/lib/auth'

// ── Types ────────────────────────────────────────────────────────────────────

type FormCard = {
  _id: string
  name: string
  specialty?: string
  description?: string
  version: number
  status: string
}

type Submission = {
  _id: string
  form_id?: string
  formId?: string
  status: 'approved' | 'submitted' | 'rejected' | 'draft' | 'under_review'
  createdAt: string
  submittedAt?: string
}

// ── Specialty color bands ────────────────────────────────────────────────────

const SPECIALTY_BAND_COLORS: Record<string, string> = {
  gastroenterology: '#0E7C7B',
  cardiology: '#1565C0',
  neurology: '#6B3FA0',
  dermatology: '#C2185B',
  orthopedics: '#E65100',
}

function getBandColor(specialty?: string): string {
  if (!specialty) return '#607D8B'
  return SPECIALTY_BAND_COLORS[specialty.toLowerCase()] ?? '#607D8B'
}

// ── timeAgo helper ───────────────────────────────────────────────────────────

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Status → TimelineDot color ───────────────────────────────────────────────

type DotColor = 'success' | 'primary' | 'error' | 'grey' | 'warning'

function submissionDotColor(status: string): DotColor {
  switch (status) {
    case 'approved': return 'success'
    case 'submitted': return 'primary'
    case 'rejected': return 'error'
    case 'draft': return 'grey'
    default: return 'warning'
  }
}

function submissionChipColor(
  status: string,
): 'success' | 'primary' | 'error' | 'default' | 'warning' {
  switch (status) {
    case 'approved': return 'success'
    case 'submitted': return 'primary'
    case 'rejected': return 'error'
    case 'draft': return 'default'
    default: return 'warning'
  }
}

// ── Greeting helper ──────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClinicianDashboard() {
  const router = useRouter()
  const formsRef = useRef<HTMLDivElement>(null)

  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('')
  const [userName, setUserName] = useState('')
  const [tenantId, setTenantId] = useState('')

  // Table state
  const [formSearch, setFormSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
    const user = getUser()
    if (user) {
      setUserId(user.id)
      setRole(user.role)
      setUserName(user.name ?? user.email)
      setTenantId(user.tenantId ?? '')
    }
  }, [])

  // Forms
  const {
    data: forms = [],
    isLoading: formsLoading,
    error: formsError,
    mutate: mutateForms,
  } = useSWR(
    userId && role ? `accessible-forms-${userId}-${role}-${tenantId}` : null,
    () =>
      formApi
        .get<FormCard[]>('/forms/accessible', { params: { userId, role, tenantId: tenantId || undefined } })
        .then((r) => r.data),
  )

  // Submissions
  const {
    data: allSubmissions = [],
    isLoading: subsLoading,
    error: subsError,
    mutate: mutateSubs,
  } = useSWR(
    userId ? `clinician-submissions-${userId}` : null,
    () =>
      submissionApi
        .get<Submission[]>('/submissions', { params: { submittedBy: userId } })
        .then((r) => r.data),
  )

  const recentSubmissions = allSubmissions.slice(0, 5)
  const pendingCount = allSubmissions.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review',
  ).length
  const submittedToday = allSubmissions.filter((s) =>
    isToday(s.submittedAt ?? s.createdAt),
  ).length

  // Look up form name from loaded forms
  function getFormName(formId?: string): string {
    if (!formId) return 'Unknown Form'
    const f = forms.find((f) => f._id === formId)
    return f?.name ?? formId.slice(-8)
  }

  // Filtered + paginated forms
  const filteredForms = forms.filter((f) => {
    const q = formSearch.toLowerCase()
    return (
      f.name.toLowerCase().includes(q) ||
      (f.specialty ?? '').toLowerCase().includes(q) ||
      (f.description ?? '').toLowerCase().includes(q)
    )
  })
  const paginatedForms = filteredForms.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  const pageLoading = formsLoading || subsLoading

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      {formsLoading ? (
        <Skeleton
          variant="rectangular"
          height={180}
          sx={{ borderRadius: 3, mb: 4 }}
        />
      ) : (
        <Fade in>
          <Paper
            elevation={0}
            sx={{
              background:
                'linear-gradient(135deg, #0E7C7B 0%, #1B3A5C 100%)',
              borderRadius: 3,
              p: 4,
              mb: 4,
              color: 'white',
            }}
          >
            <Grid container spacing={2} sx={{ alignItems: 'center' }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography
                  variant="h4"
                  sx={{ fontWeight: 700, color: '#fff', mb: 0.5 }}
                >
                  {greeting()},{' '}
                  {userName.includes('@')
                    ? userName
                    : `Dr. ${userName}`}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}
                >
                  {todayLabel()}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (forms.length > 0) {
                      router.push(`/clinician/forms/${forms[0]._id}`)
                    } else {
                      formsRef.current?.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 600,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                  }}
                >
                  Start Consultation
                </Button>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Grid container spacing={1.5}>
                  <Grid size={6}>
                    <Box
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.15)',
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: 700, color: '#fff' }}
                      >
                        {subsLoading ? '—' : pendingCount}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.75)' }}
                      >
                        Pending
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid size={6}>
                    <Box
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.15)',
                        borderRadius: 2,
                        p: 2,
                        textAlign: 'center',
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{ fontWeight: 700, color: '#fff' }}
                      >
                        {subsLoading ? '—' : submittedToday}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(255,255,255,0.75)' }}
                      >
                        Today
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Paper>
        </Fade>
      )}

      {/* ── FORMS SECTION ─────────────────────────────────────────────── */}
      <Box ref={formsRef} sx={{ mb: 4 }}>
        {/* Header row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 700, flex: 1 }}>
            Available Forms
          </Typography>
          {!formsLoading && (
            <Badge
              badgeContent={filteredForms.length}
              color="primary"
              sx={{ '& .MuiBadge-badge': { position: 'static', transform: 'none' } }}
            />
          )}
          <TextField
            size="small"
            placeholder="Search forms…"
            value={formSearch}
            onChange={(e) => { setFormSearch(e.target.value); setPage(0) }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: 240 }}
          />
        </Box>

        {formsError && (
          <Alert
            severity="error"
            action={<Button size="small" onClick={() => mutateForms()}>Retry</Button>}
            sx={{ mb: 2 }}
          >
            Failed to load forms.
          </Alert>
        )}

        {/* Loading skeleton rows */}
        {formsLoading && (
          <Card variant="outlined">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={52} sx={{ m: 1, borderRadius: 1 }} />
            ))}
          </Card>
        )}

        {/* Empty state */}
        {!formsLoading && !formsError && forms.length === 0 && (
          <Fade in>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 10,
                color: 'text.secondary',
                gap: 1.5,
              }}
            >
              <ArticleIcon sx={{ fontSize: 56, opacity: 0.4 }} />
              <Typography variant="h6">No forms assigned to your role</Typography>
              <Typography variant="body2">
                Forms will appear here once assigned by an administrator.
              </Typography>
            </Box>
          </Fade>
        )}

        {/* No search results */}
        {!formsLoading && forms.length > 0 && filteredForms.length === 0 && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
              <Typography variant="body2">No forms match &quot;{formSearch}&quot;.</Typography>
            </Box>
          </Fade>
        )}

        {/* Forms table */}
        {!formsLoading && filteredForms.length > 0 && (
          <Fade in>
            <Card variant="outlined">
              <TableContainer>
                <Table size="small" aria-label="available forms">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 700, width: 8, p: 0 }} />
                      <TableCell sx={{ fontWeight: 700 }}>Form Name</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Specialty</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Version</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedForms.map((form) => (
                      <TableRow
                        key={form._id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/clinician/forms/${form._id}`)}
                      >
                        {/* Colored left accent */}
                        <TableCell
                          sx={{
                            p: 0,
                            width: 6,
                            bgcolor: getBandColor(form.specialty),
                          }}
                        />
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {form.name}
                          </Typography>
                          {form.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                              }}
                            >
                              {form.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {form.specialty ? (
                            <Chip
                              label={form.specialty}
                              size="small"
                              sx={{
                                bgcolor: getBandColor(form.specialty),
                                color: '#fff',
                                fontSize: 11,
                                textTransform: 'capitalize',
                              }}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">—</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip label={`v${form.version}`} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={form.status}
                            size="small"
                            color={form.status === 'published' ? 'success' : 'default'}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="contained"
                            size="small"
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            onClick={() => router.push(`/clinician/forms/${form._id}`)}
                            sx={{
                              bgcolor: '#0E7C7B',
                              '&:hover': { bgcolor: '#0A6160' },
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Open Form
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <TablePagination
                component="div"
                count={filteredForms.length}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10))
                  setPage(0)
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Rows:"
              />
            </Card>
          </Fade>
        )}
      </Box>

      {/* ── RECENT SUBMISSIONS ────────────────────────────────────────── */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Recent Submissions
          </Typography>
          <Link
            href="/clinician/submissions"
            underline="hover"
            variant="body2"
            sx={{ cursor: 'pointer' }}
          >
            View all
          </Link>
        </Box>

        {subsError && (
          <Alert
            severity="error"
            action={
              <Button size="small" onClick={() => mutateSubs()}>
                Retry
              </Button>
            }
            sx={{ mb: 2 }}
          >
            Failed to load submissions.
          </Alert>
        )}

        {subsLoading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
            ))}
          </Box>
        )}

        {!subsLoading && !subsError && recentSubmissions.length === 0 && (
          <Fade in>
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                color: 'text.secondary',
              }}
            >
              <Typography variant="body2">No submissions yet.</Typography>
            </Box>
          </Fade>
        )}

        {!subsLoading && recentSubmissions.length > 0 && (
          <Fade in>
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 1, sm: 2 } }}>
                <Timeline
                  sx={{
                    p: 0,
                    m: 0,
                    '& .MuiTimelineItem-root:before': { flex: 0, padding: 0 },
                  }}
                >
                  {recentSubmissions.map((sub, idx) => (
                    <TimelineItem key={sub._id}>
                      <TimelineOppositeContent
                        sx={{
                          flex: 0.3,
                          pr: 1,
                          display: { xs: 'none', sm: 'block' },
                        }}
                        variant="body2"
                        color="text.secondary"
                      >
                        {getFormName(sub.form_id ?? sub.formId)}
                      </TimelineOppositeContent>
                      <TimelineSeparator>
                        <TimelineDot color={submissionDotColor(sub.status)} />
                        {idx < recentSubmissions.length - 1 && (
                          <TimelineConnector />
                        )}
                      </TimelineSeparator>
                      <TimelineContent sx={{ py: 0.5, px: 2 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Chip
                            label={sub.status.replace(/_/g, ' ')}
                            color={submissionChipColor(sub.status)}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {timeAgo(sub.submittedAt ?? sub.createdAt)}
                          </Typography>
                        </Box>
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </CardContent>
            </Card>
          </Fade>
        )}
      </Box>
    </Box>
  )
}
