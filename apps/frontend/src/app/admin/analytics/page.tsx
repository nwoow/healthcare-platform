'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import {
  Box, Typography, Grid, Card, CardContent, Skeleton, Alert, Button,
  ToggleButton, ToggleButtonGroup, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Avatar, Fade, Tabs, Tab,
  TextField, LinearProgress,
} from '@mui/material'
import {
  Assignment as AssignmentIcon, CheckCircle as CheckCircleIcon,
  AccessTime as AccessTimeIcon, Article as ArticleIcon,
  People as PeopleIcon, VerifiedUser as VerifiedIcon,
  Security as SecurityIcon, Visibility as ViewIcon,
} from '@mui/icons-material'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PTooltip, Legend,
  BarChart, Bar, XAxis as BXAxis, YAxis as BYAxis, CartesianGrid as BCartesianGrid,
  Tooltip as BTooltip, ResponsiveContainer as BResponsiveContainer,
} from 'recharts'
import { submissionApi, patientApi, auditApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

interface SubmissionAnalytics {
  totalSubmissions: number; approvalRate: number; avgApprovalTimeHours?: number
  byStatus: Record<string, number>
  byForm: Array<{ formId: string; formName?: string; count: number }>
  byDoctor: Array<{ userId: string; count: number }>
  byDay: Array<{ date: string; count: number }>
}

interface PatientAnalytics {
  totalPatients: number; abhaLinked: number; abhaLinkageRate: number
  newThisMonth: number; avgAge: number
  byGender: Array<{ gender: string; count: number }>
  byBloodGroup: Array<{ bloodGroup: string; count: number }>
}

interface ComplianceReport {
  phiAccessCount: number; fhirExportCount: number; consentCheckCount: number
  approvalCount: number; rejectionCount: number
  topActors: Array<{ actorId: string; count: number }>
  eventsByDay: Array<{ date: string; count: number }>
}

const STATUS_COLORS: Record<string, string> = {
  approved: '#0E7C7B', submitted: '#1565C0', under_review: '#F59E0B', draft: '#94A3B8', rejected: '#C0392B',
}
const GENDER_COLORS = ['#0E7C7B', '#6B3FA0', '#1565C0']
const BG_COLORS = ['#0E7C7B', '#2E7D32', '#1565C0', '#6B3FA0', '#E65100', '#AD1457', '#37474F', '#795548']

interface KpiCardProps { label: string; value: string | number; icon: React.ReactNode; iconBg: string; loading: boolean }

function KpiCard({ label, value, icon, iconBg, loading }: KpiCardProps) {
  return (
    <Card sx={{ height: '100%', transition: 'all 200ms', '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 } }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            {icon}
          </Box>
          {loading ? <Skeleton width={60} height={36} /> : <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>{value}</Typography>}
        </Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  )
}

export default function AdminAnalyticsPage() {
  const [tab, setTab] = useState(0)
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30)
  const [tenantId, setTenantId] = useState('')
  const [complianceFrom, setComplianceFrom] = useState('')
  const [complianceTo, setComplianceTo] = useState('')

  useEffect(() => { setTenantId(getCurrentTenantId()) }, [])

  const { data: analytics, isLoading: loadingSub, error: errorSub, mutate: mutateSub } = useSWR<SubmissionAnalytics>(
    tenantId ? `admin-analytics-${tenantId}-${periodDays}` : null,
    () => submissionApi.get<SubmissionAnalytics>(`/submissions/analytics?tenantId=${tenantId}&days=${periodDays}`).then(r => r.data),
  )

  const { data: patAnalytics, isLoading: loadingPat } = useSWR<PatientAnalytics>(
    tenantId && tab === 1 ? `patient-analytics-${tenantId}` : null,
    () => patientApi.get<PatientAnalytics>(`/patients/analytics?tenantId=${tenantId}`).then(r => r.data),
  )

  const complianceKey = tenantId && tab === 2 ? `compliance-${tenantId}-${complianceFrom}-${complianceTo}` : null
  const { data: compliance, isLoading: loadingComp, mutate: mutateComp } = useSWR<ComplianceReport>(
    complianceKey,
    () => auditApi.get<ComplianceReport>(
      `/audit/compliance-report?tenantId=${tenantId}${complianceFrom ? `&from=${complianceFrom}` : ''}${complianceTo ? `&to=${complianceTo}` : ''}`
    ).then(r => r.data),
  )

  const pieData = analytics
    ? Object.entries(analytics.byStatus).map(([name, value]) => ({ name, value }))
    : []

  const genderPieData = patAnalytics?.byGender ?? []
  const bgBarData = patAnalytics?.byBloodGroup ?? []

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Analytics</Typography>
          <Typography variant="body2" color="text.secondary">Platform metrics and compliance reporting</Typography>
        </Box>
        {tab === 0 && (
          <ToggleButtonGroup value={String(periodDays)} exclusive onChange={(_, val) => { if (val) setPeriodDays(Number(val) as 7 | 30 | 90) }} size="small">
            {['7', '30', '90'].map(d => <ToggleButton key={d} value={d}>{d}d</ToggleButton>)}
          </ToggleButtonGroup>
        )}
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Tab label="Submissions" />
        <Tab label="Patients" />
        <Tab label="Compliance" />
      </Tabs>

      {/* ── TAB 1: Submissions ─────────────────────────────────────────────────── */}
      {tab === 0 && (
        <Fade in>
          <Box>
            {errorSub && (
              <Alert severity="error" action={<Button size="small" onClick={() => mutateSub()}>Retry</Button>} sx={{ mb: 3 }}>
                Failed to load analytics data.
              </Alert>
            )}

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {[
                { label: 'Total Submissions', value: analytics?.totalSubmissions ?? 0, icon: <AssignmentIcon />, bg: '#0E7C7B' },
                { label: 'Approval Rate', value: `${analytics?.approvalRate ?? 0}%`, icon: <CheckCircleIcon />, bg: '#2E7D32' },
                { label: 'Avg Approval Time', value: `${analytics?.avgApprovalTimeHours ?? 0}h`, icon: <AccessTimeIcon />, bg: '#1565C0' },
                { label: 'Active Forms', value: analytics?.byForm.length ?? 0, icon: <ArticleIcon />, bg: '#6B3FA0' },
              ].map(kpi => (
                <Grid key={kpi.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                  {loadingSub ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} /> : (
                    <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} iconBg={kpi.bg} loading={false} />
                  )}
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Submissions per Day</Typography>
                    {loadingSub ? <Skeleton variant="rectangular" height={250} /> : (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={analytics?.byDay ?? []}>
                          <defs>
                            <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0E7C7B" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#0E7C7B" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RTooltip />
                          <Area type="monotone" dataKey="count" stroke="#0E7C7B" fill="url(#tealGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Status Breakdown</Typography>
                    {loadingSub ? <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} /> : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                            {pieData.map(entry => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94A3B8'} />
                            ))}
                          </Pie>
                          <PTooltip />
                          <Legend formatter={(v: string) => v.replace(/_/g, ' ')} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Top Forms</Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}><TableCell sx={{ fontWeight: 600 }}>Form</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell></TableRow></TableHead>
                        <TableBody>
                          {(analytics?.byForm ?? []).slice(0, 8).map(row => (
                            <TableRow key={row.formId} hover>
                              <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{row.formName ?? row.formId.slice(-12)}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.count}</Typography></TableCell>
                            </TableRow>
                          ))}
                          {(analytics?.byForm ?? []).length === 0 && (
                            <TableRow><TableCell colSpan={2} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">No data</Typography></TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Top Doctors</Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}><TableCell sx={{ fontWeight: 600 }}>Doctor</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>Count</TableCell></TableRow></TableHead>
                        <TableBody>
                          {(analytics?.byDoctor ?? []).map(row => (
                            <TableRow key={row.userId} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 28, height: 28, bgcolor: '#0E7C7B', fontSize: 11 }}>{row.userId.slice(0, 2).toUpperCase()}</Avatar>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{row.userId.slice(-10)}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.count}</Typography></TableCell>
                            </TableRow>
                          ))}
                          {(analytics?.byDoctor ?? []).length === 0 && (
                            <TableRow><TableCell colSpan={2} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">No data</Typography></TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ── TAB 2: Patients ────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <Fade in>
          <Box>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {[
                { label: 'Total Patients', value: patAnalytics?.totalPatients ?? 0, icon: <PeopleIcon />, bg: '#0E7C7B' },
                { label: 'ABHA Linked', value: patAnalytics?.abhaLinked ?? 0, icon: <VerifiedIcon />, bg: '#2E7D32' },
                { label: 'ABHA Linkage Rate', value: `${patAnalytics?.abhaLinkageRate ?? 0}%`, icon: <VerifiedIcon />, bg: '#1565C0' },
                { label: 'New This Month', value: patAnalytics?.newThisMonth ?? 0, icon: <PeopleIcon />, bg: '#6B3FA0' },
              ].map(kpi => (
                <Grid key={kpi.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                  {loadingPat ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} /> : (
                    <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} iconBg={kpi.bg} loading={false} />
                  )}
                </Grid>
              ))}
            </Grid>

            {patAnalytics && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>ABHA Linkage Progress</Typography>
                <LinearProgress variant="determinate" value={patAnalytics.abhaLinkageRate} sx={{ height: 10, borderRadius: 1 }} color="success" />
                <Typography variant="caption" color="text.secondary">{patAnalytics.abhaLinkageRate}% of patients have ABHA linked</Typography>
              </Box>
            )}

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Gender Distribution</Typography>
                    {loadingPat ? <Skeleton variant="circular" width={200} height={200} sx={{ mx: 'auto' }} /> : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie data={genderPieData.map(g => ({ name: g.gender, value: g.count }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                            {genderPieData.map((_, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                          </Pie>
                          <PTooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Blood Group Distribution</Typography>
                    {loadingPat ? <Skeleton variant="rectangular" height={250} /> : (
                      <BResponsiveContainer width="100%" height={250}>
                        <BarChart data={bgBarData.map(b => ({ name: b.bloodGroup, count: b.count }))}>
                          <BCartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <BXAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <BYAxis tick={{ fontSize: 11 }} />
                          <BTooltip />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {bgBarData.map((_, i) => <Cell key={i} fill={BG_COLORS[i % BG_COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </BResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}

      {/* ── TAB 3: Compliance ─────────────────────────────────────────────────── */}
      {tab === 2 && (
        <Fade in>
          <Box>
            {/* Date range */}
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField label="From" type="date" size="small" value={complianceFrom} onChange={e => setComplianceFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField label="To" type="date" size="small" value={complianceTo} onChange={e => setComplianceTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              <Button variant="outlined" size="small" onClick={() => mutateComp()}>Apply</Button>
            </Box>

            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {[
                { label: 'PHI Access Events', value: compliance?.phiAccessCount ?? 0, icon: <ViewIcon />, bg: '#E65100' },
                { label: 'FHIR Exports', value: compliance?.fhirExportCount ?? 0, icon: <SecurityIcon />, bg: '#6B3FA0' },
                { label: 'Consent Checks', value: compliance?.consentCheckCount ?? 0, icon: <CheckCircleIcon />, bg: '#2E7D32' },
                { label: 'Approvals', value: compliance?.approvalCount ?? 0, icon: <AssignmentIcon />, bg: '#0E7C7B' },
              ].map(kpi => (
                <Grid key={kpi.label} size={{ xs: 12, sm: 6, xl: 3 }}>
                  {loadingComp ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} /> : (
                    <KpiCard label={kpi.label} value={kpi.value} icon={kpi.icon} iconBg={kpi.bg} loading={false} />
                  )}
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Events per Day</Typography>
                    {loadingComp ? <Skeleton variant="rectangular" height={200} /> : (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={compliance?.eventsByDay ?? []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RTooltip />
                          <Area type="monotone" dataKey="count" stroke="#6B3FA0" fill="#6B3FA020" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Top Actors</Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                      <Table size="small">
                        <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}><TableCell sx={{ fontWeight: 600 }}>Actor</TableCell><TableCell align="right" sx={{ fontWeight: 600 }}>Events</TableCell></TableRow></TableHead>
                        <TableBody>
                          {(compliance?.topActors ?? []).map(row => (
                            <TableRow key={row.actorId} hover>
                              <TableCell><Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{row.actorId.slice(-16)}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" sx={{ fontWeight: 600 }}>{row.count}</Typography></TableCell>
                            </TableRow>
                          ))}
                          {!loadingComp && (compliance?.topActors ?? []).length === 0 && (
                            <TableRow><TableCell colSpan={2} align="center" sx={{ py: 4 }}><Typography variant="body2" color="text.secondary">No data — select date range</Typography></TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      )}
    </Box>
  )
}
