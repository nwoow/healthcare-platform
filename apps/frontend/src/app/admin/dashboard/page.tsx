'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
} from '@mui/material'
import {
  Article as ArticleIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Group as GroupIcon,
  PendingActions as PendingActionsIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts'
import { formApi, submissionApi, authApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

// ── Types ────────────────────────────────────────────────────────────────────

type Form = { _id: string; title?: string; status: string; createdAt: string }
type Submission = {
  _id: string
  formId?: string
  status: string
  createdAt: string
}
type User = { id: string; email: string; isActive: boolean; createdAt: string }
type AnalyticsData = { byDay: Array<{ date: string; count: number }> }

// ── API fetchers ─────────────────────────────────────────────────────────────

const tenantId = () => getCurrentTenantId()

const fetchForms = () =>
  formApi.get<Form[]>(`/forms?tenantId=${tenantId()}`).then((r) => r.data)

const fetchRecentSubmissions = () =>
  submissionApi
    .get<Submission[]>(`/submissions?tenantId=${tenantId()}&limit=10`)
    .then((r) => r.data)

const fetchUsers = () =>
  authApi.get<User[]>(`/auth/users?tenantId=${tenantId()}`).then((r) => r.data)

const fetchAnalytics = () =>
  submissionApi
    .get<AnalyticsData>(`/submissions/analytics?tenantId=${tenantId()}&days=7`)
    .then((r) => r.data)

function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// ── Animated Count Hook ──────────────────────────────────────────────────────

function useAnimatedCount(target: number, duration = 800): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const steps = 30
    const stepValue = target / steps
    const interval = duration / steps
    let current = 0
    const timer = setInterval(() => {
      current += stepValue
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, interval)
    return () => clearInterval(timer)
  }, [target, duration])

  return count
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  trend: string
  loading: boolean
}

function StatCard({ label, value, icon, iconBg, trend, loading }: StatCardProps) {
  const animatedValue = useAnimatedCount(loading ? 0 : value)

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
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
            {loading ? (
              <Box sx={{ width: 60, height: 36, borderRadius: 1, bgcolor: 'grey.200', animation: 'pulse 1.5s infinite' }} />
            ) : (
              <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
                {animatedValue.toLocaleString()}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {label}
            </Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary">
          {trend}
        </Typography>
      </CardContent>
    </Card>
  )
}

// ── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
    submitted: { label: 'Submitted', color: 'info' },
    under_review: { label: 'Under Review', color: 'warning' },
    approved: { label: 'Approved', color: 'success' },
    rejected: { label: 'Rejected', color: 'error' },
    draft: { label: 'Draft', color: 'default' },
  }
  const entry = map[status] ?? { label: status, color: 'default' as const }
  return <Chip label={entry.label} color={entry.color} size="small" />
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter()
  const theme = useTheme()

  const { data: forms, isLoading: formsLoading } = useSWR('admin/forms', fetchForms)
  const { data: submissions, isLoading: subsLoading } = useSWR('admin/submissions/recent', fetchRecentSubmissions)
  const { data: users, isLoading: usersLoading } = useSWR('admin/users', fetchUsers)
  const { data: analyticsData } = useSWR('admin/analytics', fetchAnalytics)

  const submissionsToday = submissions?.filter((s) => isToday(s.createdAt)).length ?? 0
  const pendingApprovals = submissions?.filter((s) => s.status === 'under_review').length ?? 0

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Overview of your healthcare platform
        </Typography>
      </Box>

      {/* ROW 1 — Stat cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            label="Total Forms"
            value={forms?.length ?? 0}
            icon={<ArticleIcon />}
            iconBg="#0E7C7B"
            trend="+12% this week"
            loading={formsLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            label="Submissions Today"
            value={submissionsToday}
            icon={<AssignmentTurnedInIcon />}
            iconBg="#1565C0"
            trend="Updated just now"
            loading={subsLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            label="Total Users"
            value={users?.length ?? 0}
            icon={<GroupIcon />}
            iconBg="#6B3FA0"
            trend="+3 this month"
            loading={usersLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <StatCard
            label="Pending Approvals"
            value={pendingApprovals}
            icon={<PendingActionsIcon />}
            iconBg="#E65100"
            trend="Awaiting review"
            loading={subsLoading}
          />
        </Grid>
      </Grid>

      {/* ROW 2 — Submissions table + Quick actions */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {/* Recent Submissions */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Recent Submissions
              </Typography>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Form ID</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 600 }}>View</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subsLoading
                      ? Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={4}>
                              <Box sx={{ height: 20, bgcolor: 'grey.100', borderRadius: 1, animation: 'pulse 1.5s infinite' }} />
                            </TableCell>
                          </TableRow>
                        ))
                      : submissions?.slice(0, 10).map((sub) => (
                          <TableRow key={sub._id} hover>
                            <TableCell>
                              <Typography
                                variant="caption"
                                sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                              >
                                {sub.formId ?? sub._id.slice(-8)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <StatusChip status={sub.status} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(sub.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => router.push(`/admin/forms/submissions/${sub._id}`)}
                                color="primary"
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                    {!subsLoading && (!submissions || submissions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            No submissions yet
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => router.push('/admin/forms/builder')}
                  sx={{
                    bgcolor: '#0E7C7B',
                    '&:hover': { bgcolor: '#0A6160' },
                    py: 1.25,
                    justifyContent: 'flex-start',
                    pl: 3,
                    fontWeight: 600,
                  }}
                >
                  + New Form
                </Button>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => router.push('/admin/forms/submissions')}
                  sx={{
                    bgcolor: '#1565C0',
                    '&:hover': { bgcolor: '#0D47A1' },
                    py: 1.25,
                    justifyContent: 'flex-start',
                    pl: 3,
                    fontWeight: 600,
                  }}
                >
                  View All Submissions
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => router.push('/admin/users')}
                  sx={{
                    py: 1.25,
                    justifyContent: 'flex-start',
                    pl: 3,
                    fontWeight: 600,
                  }}
                >
                  Users
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => router.push('/admin/audit')}
                  sx={{
                    py: 1.25,
                    justifyContent: 'flex-start',
                    pl: 3,
                    fontWeight: 600,
                  }}
                >
                  Audit Log
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ROW 3 — Analytics chart */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Submissions — Last 7 Days
          </Typography>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analyticsData?.byDay ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <RTooltip />
              <Bar dataKey="count" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
