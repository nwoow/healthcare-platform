'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Chip,
  Box,
} from '@mui/material'
import {
  LocalHospital as LocalHospitalIcon,
  Assignment as AssignmentIcon,
  History as HistoryIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { getUser, clearUser } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const TAB_ROUTES = [
  '/clinician/dashboard',
  '/clinician/submissions',
  '/clinician/patients',
]

function getActiveTab(pathname: string): number {
  if (pathname.startsWith('/clinician/patients')) return 2
  if (pathname.startsWith('/clinician/submissions')) return 1
  // dashboard and forms both map to 0
  return 0
}

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function ClinicianLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const muiTheme = useTheme()

  const [user, setUser] = useState<{
    id: string
    email: string
    role: string
    name?: string
  } | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  useEffect(() => {
    const u = getUser()
    if (u) setUser(u)
  }, [])

  const handleLogout = async () => {
    try { await authApi.post('/auth/logout') } catch {}
    clearUser()
    window.location.href = '/login'
  }

  const activeTab = getActiveTab(pathname)

  const appBarGradient = `linear-gradient(135deg, ${muiTheme.palette.primary.dark} 0%, ${muiTheme.palette.primary.main} 100%)`

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="fixed"
        elevation={2}
        sx={{
          background: appBarGradient,
          height: 64,
          justifyContent: 'center',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: '64px !important' }}>
          {/* Left: Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <LocalHospitalIcon sx={{ color: '#fff', fontSize: 26 }} />
            <Typography
              variant="h6"
              sx={{
                color: '#fff',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                display: { xs: 'none', sm: 'block' },
              }}
            >
              HealthPlatform
            </Typography>
          </Box>

          {/* Center: Tabs */}
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => router.push(TAB_ROUTES[v])}
              textColor="inherit"
              indicatorColor="secondary"
              sx={{
                '& .MuiTab-root': {
                  color: 'rgba(255,255,255,0.75)',
                  minHeight: 64,
                  fontSize: { xs: 0, sm: '0.8rem' },
                  '&.Mui-selected': { color: '#fff' },
                },
                '& .MuiTabs-indicator': { backgroundColor: '#fff', height: 3 },
              }}
            >
              <Tab
                icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
                label="My Forms"
                iconPosition="start"
                sx={{ gap: 0.5 }}
              />
              <Tab
                icon={<HistoryIcon sx={{ fontSize: 20 }} />}
                label="My Submissions"
                iconPosition="start"
                sx={{ gap: 0.5 }}
              />
              <Tab
                icon={<PeopleIcon sx={{ fontSize: 20 }} />}
                label="My Patients"
                iconPosition="start"
                sx={{ gap: 0.5 }}
              />
            </Tabs>
          </Box>

          {/* Right: Notifications + Avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {user && <NotificationBell userId={user.id} role={user.role} />}

            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{ p: 0.5 }}
            >
              <Avatar
                sx={{
                  width: 34,
                  height: 34,
                  bgcolor: 'rgba(255,255,255,0.25)',
                  fontSize: 13,
                  color: '#fff',
                }}
              >
                {user ? getInitials(user.email) : '?'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 200 } } }}
            >
              {/* User info header */}
              {user && (
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {user.name ?? user.email}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {user.email}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={user.role.replace(/_/g, ' ')}
                      size="small"
                      color="primary"
                      sx={{ fontSize: 10, height: 18 }}
                    />
                  </Box>
                </Box>
              )}
              <Divider />
              <MenuItem
                onClick={() => {
                  setAnchorEl(null)
                  handleLogout()
                }}
                sx={{ color: 'error.main', gap: 1 }}
              >
                <LogoutIcon fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main content — padded below fixed AppBar */}
      <Box sx={{ pt: '64px', minHeight: '100vh', bgcolor: 'background.default' }}>
        {children}
      </Box>
    </Box>
  )
}
