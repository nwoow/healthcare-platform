'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Divider,
  Chip,
} from '@mui/material'
import {
  Shield as ShieldIcon,
  Dashboard as DashboardIcon,
  Apartment as ApartmentIcon,
  MonitorHeart as MonitorHeartIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { clearUser, getUser } from '@/lib/auth'
import { authApi } from '@/lib/api'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const DRAWER_WIDTH = 260

const navItems = [
  { label: 'Dashboard', icon: <DashboardIcon fontSize="small" />, href: '/super-admin/dashboard' },
  { label: 'Tenants', icon: <ApartmentIcon fontSize="small" />, href: '/super-admin/tenants' },
  { label: 'System Health', icon: <MonitorHeartIcon fontSize="small" />, href: '/super-admin/health' },
  { label: 'Audit Logs', icon: <SecurityIcon fontSize="small" />, href: '/super-admin/audit' },
  { label: 'Settings', icon: <SettingsIcon fontSize="small" />, href: '/super-admin/settings' },
]

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email: string; role: string } | null>(null)

  useEffect(() => {
    const u = getUser()
    if (u) setUser(u)
  }, [])

  const handleLogout = async () => {
    try { await authApi.post('/auth/logout') } catch {}
    clearUser()
    window.location.href = '/super-admin/login'
  }

  const isActive = (href: string) =>
    pathname === href || (href !== '/super-admin/dashboard' && pathname.startsWith(href))

  const navItemSx = (href: string) => ({
    borderRadius: 1,
    mx: 1,
    mb: 0.5,
    ...(isActive(href)
      ? {
          borderLeft: '3px solid #0E7C7B',
          bgcolor: 'rgba(14,124,123,0.15)',
          pl: '13px',
          '& .MuiListItemIcon-root': { color: '#fff' },
          '& .MuiListItemText-primary': { color: '#fff', fontWeight: 600 },
        }
      : {
          pl: 2,
          '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.6)' },
          '& .MuiListItemText-primary': { color: 'rgba(255,255,255,0.6)' },
          '&:hover': {
            bgcolor: 'rgba(255,255,255,0.1)',
            '& .MuiListItemIcon-root': { color: '#fff' },
            '& .MuiListItemText-primary': { color: '#fff' },
          },
        }),
  })

  const drawerContent = (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #0A0F1E 0%, #1B3A5C 100%)',
        overflowX: 'hidden',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <ShieldIcon sx={{ color: '#fff', fontSize: 28 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1 }}>
            HealthPlatform
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: '#0E7C7B', pl: '44px', display: 'block' }}>
          Super Admin Console
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mx: 2 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', pt: 1 }}>
        <List disablePadding>
          {navItems.map((item) => (
            <ListItemButton
              key={item.href}
              sx={navItemSx(item.href)}
              onClick={() => router.push(item.href)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} slotProps={{ primary: { style: { fontSize: 14 } } }} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Bottom section */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 1.5 }} />
        <Typography
          variant="caption"
          sx={{
            color: 'rgba(255,255,255,0.5)',
            display: 'block',
            mb: 0.75,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {user?.email ?? 'superadmin@platform.com'}
        </Typography>
        <Chip
          label="SUPER ADMIN"
          color="error"
          size="small"
          sx={{ mb: 1.5, fontSize: 10, height: 20 }}
        />
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            px: 1.5,
            py: 0.75,
            '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.7)' },
            '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
          }}
        >
          <ListItemIcon sx={{ minWidth: 32 }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{ primary: { style: { fontSize: 13, color: 'rgba(255,255,255,0.7)' } } }}
          />
        </ListItemButton>
      </Box>
    </Box>
  )

  // Don't render the sidebar/appbar on the login page
  if (pathname === '/super-admin/login') {
    return <>{children}</>
  }

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Permanent Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ bgcolor: '#0A0F1E', height: 64, justifyContent: 'center' }}
        >
          <Toolbar sx={{ gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600, flex: 1 }}>
              Super Admin Console
            </Typography>

            {user && <NotificationBell userId={user.id} role={user.role} />}

            <Avatar sx={{ width: 36, height: 36, bgcolor: '#c62828', fontSize: 14, fontWeight: 700 }}>
              {user?.email?.[0]?.toUpperCase() ?? 'S'}
            </Avatar>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            bgcolor: '#0F1923',
            overflowY: 'auto',
            color: '#fff',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
