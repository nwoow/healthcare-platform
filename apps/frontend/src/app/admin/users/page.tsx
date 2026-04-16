'use client'

import { useState, useEffect } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Alert,
  Tooltip,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, ContentCopy as CopyIcon, Group as GroupIcon } from '@mui/icons-material'
import { authApi, iamApi, tenantApi } from '@/lib/api'
import { getCurrentTenantId } from '@/lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = 'doctor' | 'nurse' | 'receptionist' | 'department_admin' | 'tenant_admin'

type IamRole = { id: string; name: string }

type User = {
  id: string
  email: string
  name?: string
  role?: Role
  isActive: boolean
  createdAt: string
  department?: string
}

// ── API fetchers ──────────────────────────────────────────────────────────────

async function fetchUsersWithRoles(): Promise<User[]> {
  const tenantId = getCurrentTenantId()
  const [usersRes, rolesListRes] = await Promise.all([
    authApi.get<Omit<User, 'role'>[]>(`/auth/users?tenantId=${tenantId}`),
    iamApi.get<IamRole[]>(`/iam/roles?tenantId=system`),
  ])

  const users = usersRes.data ?? []

  // Fetch each user's assigned role from IAM in parallel
  // Try tenant-scoped first, fall back to system (roles may be assigned under either)
  const userRoles = await Promise.all(
    users.map(async (u) => {
      try {
        for (const tid of [tenantId, 'system']) {
          const r = await iamApi.get<IamRole[]>(`/iam/users/${u.id}/roles?tenantId=${tid}`)
          if ((r.data ?? []).length > 0) return (r.data[0] as IamRole).name as Role
        }
        return undefined
      } catch {
        return undefined
      }
    }),
  )

  return users.map((u, i) => ({ ...u, role: userRoles[i] }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(nameOrEmail: string): string {
  const base = nameOrEmail.includes('@') ? nameOrEmail.split('@')[0] : nameOrEmail
  return base
    .split(/[\s._-]/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function generatePassword(email: string): string {
  const base = email.split('@')[0].replace(/[^a-zA-Z]/g, '').slice(0, 6) || 'User'
  const digits = String(Math.floor(1000 + Math.random() * 9000))
  return base.charAt(0).toUpperCase() + base.slice(1) + digits + '!'
}

// ── Role Chip ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<
  Role,
  { label: string; color: 'secondary' | 'primary' | 'info' | 'default' | 'warning' }
> = {
  tenant_admin: { label: 'Tenant Admin', color: 'secondary' },
  doctor: { label: 'Doctor', color: 'primary' },
  nurse: { label: 'Nurse', color: 'info' },
  receptionist: { label: 'Receptionist', color: 'default' },
  department_admin: { label: 'Dept. Admin', color: 'warning' },
}

function RoleChip({ role }: { role?: Role }) {
  if (!role) return <Chip label="No role" size="small" variant="outlined" />
  const { label, color } = ROLE_COLORS[role] ?? { label: role, color: 'default' as const }
  return <Chip label={label} color={color} size="small" />
}

// ── Status Chip ───────────────────────────────────────────────────────────────

function StatusChip({ active }: { active: boolean }) {
  return (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      color={active ? 'success' : 'error'}
      size="small"
    />
  )
}

// ── Edit Role Dialog ──────────────────────────────────────────────────────────

function EditRoleDialog({
  open,
  user,
  onClose,
}: {
  open: boolean
  user: User | null
  onClose: () => void
}) {
  const tenantId = getCurrentTenantId()
  const [role, setRole] = useState<Role | ''>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill current role when dialog opens
  useEffect(() => {
    if (open && user?.role) setRole(user.role)
    else if (open) setRole('')
  }, [open, user])

  const handleSubmit = async () => {
    if (!user || !role) return
    setLoading(true)
    setError(null)
    try {
      // Fetch IAM roles list to resolve roleId by name
      const rolesRes = await iamApi.get<IamRole[]>(`/iam/roles?tenantId=system`)
      const iamRole = (rolesRes.data ?? []).find((r) => r.name === role)
      if (!iamRole) throw new Error(`Role "${role}" not found in IAM`)

      await iamApi.post(`/iam/users/${user.id}/roles`, {
        roleId: iamRole.id,
        tenantId,
        assignedBy: 'admin',
      })
      await globalMutate('admin/users')
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        (err as { message?: string })?.message ??
        'Failed to update role'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent>
        {user && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Changing role for <strong>{user.name ?? user.email}</strong>
          </Typography>
        )}
        <FormControl fullWidth size="small">
          <InputLabel>Role</InputLabel>
          <Select
            value={role}
            label="Role"
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <MenuItem value="doctor">Doctor</MenuItem>
            <MenuItem value="nurse">Nurse</MenuItem>
            <MenuItem value="receptionist">Receptionist</MenuItem>
            <MenuItem value="department_admin">Department Admin</MenuItem>
            <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
          </Select>
        </FormControl>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!role || loading}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Credentials Dialog ────────────────────────────────────────────────────────

function CredentialsDialog({
  open,
  email,
  password,
  onClose,
}: {
  open: boolean
  email: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>User Created</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Save these credentials — shown once only
        </Alert>
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Email</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{email}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Password</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{password}</Typography>
            </Box>
          </Box>
        </Paper>
        <Button
          startIcon={<CopyIcon />}
          onClick={handleCopy}
          variant="outlined"
          size="small"
          sx={{ mt: 1.5 }}
        >
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Done</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  // Read tenantId client-side only (localStorage unavailable on server → hydration mismatch)
  const [tenantId, setTenantId] = useState('')
  const [tenantLabel, setTenantLabel] = useState('My Team')

  useEffect(() => {
    const tid = getCurrentTenantId()
    setTenantId(tid)
    if (tid === 'system') {
      setTenantLabel('Hospital Team')
    } else {
      tenantApi
        .get<{ name: string }>(`/tenants/${tid}`)
        .then((r) => setTenantLabel(`${r.data.name} — Team`))
        .catch(() => setTenantLabel('My Team'))
    }
  }, [])

  const { data: users = [], isLoading } = useSWR('admin/users', fetchUsersWithRoles)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  // Invite form state
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role | ''>('')
  const [inviteDept, setInviteDept] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  const resetInvite = () => {
    setInviteName('')
    setInviteEmail('')
    setInviteRole('')
    setInviteDept('')
    setInviteError(null)
  }

  const handleInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      setInviteError('Email and role are required.')
      return
    }
    setInviteLoading(true)
    setInviteError(null)
    const password = generatePassword(inviteEmail)
    try {
      // 1. Create user in auth service
      const userRes = await authApi.post<{ id: string }>('/auth/users', {
        email: inviteEmail,
        password,
        name: inviteName || undefined,
        tenantId,
        department: inviteDept || undefined,
      })
      const newUserId = userRes.data.id

      // 2. Resolve role ID from IAM, then assign
      const rolesListRes = await iamApi.get<IamRole[]>(`/iam/roles?tenantId=system`)
      const iamRole = (rolesListRes.data ?? []).find((r) => r.name === inviteRole)
      if (iamRole) {
        await iamApi.post(`/iam/users/${newUserId}/roles`, {
          roleId: iamRole.id,
          tenantId,
          assignedBy: 'admin',
        })
      }

      await globalMutate('admin/users')
      setInviteOpen(false)
      resetInvite()
      setCredentials({ email: inviteEmail, password })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      const text = Array.isArray(msg) ? msg[0] : msg
      setInviteError(typeof text === 'string' ? text : 'Failed to invite user')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {tenantLabel}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => { resetInvite(); setInviteOpen(true) }}
          sx={{ color: '#0E7C7B', borderColor: '#0E7C7B', '&:hover': { borderColor: '#0A6160' } }}
        >
          Invite User
        </Button>
      </Box>

      {/* Table */}
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Skeleton variant="circular" width={36} height={36} />
                        <Box>
                          <Skeleton width={120} height={16} />
                          <Skeleton width={160} height={12} sx={{ mt: 0.5 }} />
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell><Skeleton width={90} /></TableCell>
                    <TableCell><Skeleton width={60} sx={{ mx: 'auto' }} /></TableCell>
                  </TableRow>
                ))
              : users.length === 0
              ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <GroupIcon sx={{ fontSize: 48, color: 'grey.300', mb: 1 }} />
                      <Typography color="text.secondary">No users found</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )
              : users.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 13 }}>
                        {getInitials(user.name ?? user.email)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {user.name ?? user.email.split('@')[0]}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {user.email}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell><RoleChip role={user.role} /></TableCell>
                  <TableCell><StatusChip active={user.isActive} /></TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(user.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Change Role">
                      <IconButton size="small" onClick={() => setEditTarget(user)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Invite User Dialog */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Invite User</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Full Name"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            fullWidth
            size="small"
            placeholder="Dr. Jane Smith"
          />
          <TextField
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            fullWidth
            size="small"
            required
            placeholder="user@hospital.com"
          />
          <FormControl fullWidth size="small" required>
            <InputLabel>Role</InputLabel>
            <Select
              value={inviteRole}
              label="Role"
              onChange={(e) => setInviteRole(e.target.value as Role)}
            >
              <MenuItem value="doctor">Doctor</MenuItem>
              <MenuItem value="nurse">Nurse</MenuItem>
              <MenuItem value="receptionist">Receptionist</MenuItem>
              <MenuItem value="department_admin">Department Admin</MenuItem>
              <MenuItem value="tenant_admin">Tenant Admin</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Department (optional)"
            value={inviteDept}
            onChange={(e) => setInviteDept(e.target.value)}
            fullWidth
            size="small"
            placeholder="Cardiology"
          />
          {inviteError && <Alert severity="error">{inviteError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleInvite}
            disabled={inviteLoading}
            sx={{ bgcolor: '#0E7C7B', '&:hover': { bgcolor: '#0A6160' } }}
          >
            {inviteLoading ? 'Creating…' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Credentials Dialog */}
      {credentials && (
        <CredentialsDialog
          open={Boolean(credentials)}
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      {/* Edit Role Dialog */}
      <EditRoleDialog
        open={Boolean(editTarget)}
        user={editTarget}
        onClose={() => setEditTarget(null)}
      />
    </Box>
  )
}
