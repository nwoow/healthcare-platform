'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
  Menu,
  MenuItem,
  Tooltip,
  TextField,
  InputAdornment,
  Paper,
  Divider,
  Chip,
  Collapse,
  useMediaQuery,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  AddCircleOutlined as AddCircleOutlineIcon,
  ListAlt as ListAltIcon,
  Assignment as AssignmentIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  BarChart as BarChartIcon,
  Security as SecurityIcon,
  Search as SearchIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  LocalHospital as LocalHospitalIcon,
  ExpandLess,
  ExpandMore,
  Extension as ExtensionIcon,
} from '@mui/icons-material'
import { alpha, useTheme } from '@mui/material/styles'
import { useHealthcareTheme } from '@/context/ThemeContext'
import { themes, type ThemeKey } from '@/theme/themes'
import { getUser, clearUser, getCurrentTenantId } from '@/lib/auth'
import { formApi, authApi } from '@/lib/api'
import { NotificationBell } from '@/components/notifications/NotificationBell'

const DRAWER_WIDTH = 260

interface SearchResult {
  id: string
  name: string
  type: 'form' | 'patient'
  href: string
}

function getInitials(email: string): string {
  const parts = email.split('@')[0].split(/[._-]/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function getPageTitle(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'Dashboard'
  if (pathname.includes('/forms/builder')) return 'Form Builder'
  if (pathname.includes('/forms/submissions')) return 'Submissions'
  if (pathname.includes('/forms')) return 'All Forms'
  if (pathname.includes('/patients')) return 'Patients'
  if (pathname.includes('/users')) return 'Users'
  if (pathname.includes('/analytics')) return 'Analytics'
  if (pathname.includes('/audit')) return 'Audit Log'
  if (pathname.includes('/integrations')) return 'Integrations'
  return 'Admin'
}

function getRoleColor(role: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' {
  switch (role) {
    case 'super_admin':
    case 'tenant_admin': return 'secondary'
    case 'doctor': return 'primary'
    case 'nurse': return 'info'
    default: return 'default'
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const muiTheme = useTheme()
  const { currentTheme: themeKey, setTheme } = useHealthcareTheme()
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'))

  const [user, setUser] = useState<{ id: string; email: string; role: string; tenantId?: string; name?: string } | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [formsExpanded, setFormsExpanded] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const u = getUser()
    if (u) setUser(u)
  }, [])

  // Expand forms section if currently on a forms route
  useEffect(() => {
    if (pathname.includes('/forms')) setFormsExpanded(true)
  }, [pathname])

  const handleLogout = async () => {
    try { await authApi.post('/auth/logout') } catch {}
    clearUser()
    window.location.href = '/login'
  }

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (!value.trim()) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    searchTimerRef.current = setTimeout(async () => {
      try {
        const tenantId = getCurrentTenantId()
        const [formsRes] = await Promise.allSettled([
          formApi.get<Array<{ _id: string; title: string }>>(`/forms?search=${encodeURIComponent(value)}&tenantId=${tenantId}`),
        ])
        const results: SearchResult[] = []
        if (formsRes.status === 'fulfilled') {
          formsRes.value.data.slice(0, 5).forEach((f) => {
            results.push({ id: f._id, name: f.title, type: 'form', href: `/admin/forms` })
          })
        }
        setSearchResults(results)
        setSearchOpen(results.length > 0)
      } catch {
        setSearchResults([])
        setSearchOpen(false)
      }
    }, 300)
  }, [])

  const secondaryColor = muiTheme.palette.secondary.main

  const isActive = (href: string) =>
    pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href))

  const navItemSx = (href: string) => ({
    borderRadius: 1,
    mx: 1,
    mb: 0.5,
    ...(isActive(href)
      ? {
          borderLeft: '3px solid',
          borderColor: muiTheme.palette.primary.main,
          bgcolor: 'rgba(255,255,255,0.15)',
          pl: '13px',
          '& .MuiListItemIcon-root': { color: '#fff' },
          '& .MuiListItemText-primary': { color: '#fff', fontWeight: 600 },
        }
      : {
          pl: 2,
          '& .MuiListItemIcon-root': { color: 'rgba(255,255,255,0.7)' },
          '& .MuiListItemText-primary': { color: 'rgba(255,255,255,0.7)' },
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
        background: `linear-gradient(180deg, ${secondaryColor} 0%, ${alpha(secondaryColor, 0.85)} 100%)`,
        overflowX: 'hidden',
      }}
    >
      {/* Logo / Header */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <LocalHospitalIcon sx={{ color: '#fff', fontSize: 28 }} />
          <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1 }}>
            HealthPlatform
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.6), pl: '44px' }}>
          Admin Console
        </Typography>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mx: 2 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', pt: 1 }}>
        <List disablePadding>
          {/* Dashboard */}
          <ListItemButton sx={navItemSx('/admin/dashboard')} onClick={() => router.push('/admin/dashboard')}>
            <ListItemIcon sx={{ minWidth: 36 }}><DashboardIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Dashboard" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>

          {/* Forms (expandable) */}
          <ListItemButton
            sx={{
              ...navItemSx('/admin/forms'),
              ...(isActive('/admin/forms') ? {} : {}),
            }}
            onClick={() => setFormsExpanded((p) => !p)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ListAltIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Forms" slotProps={{ primary: { style: { fontSize: 14 } } }} />
            {formsExpanded ? <ExpandLess sx={{ color: 'rgba(255,255,255,0.7)' }} /> : <ExpandMore sx={{ color: 'rgba(255,255,255,0.7)' }} />}
          </ListItemButton>
          <Collapse in={formsExpanded} timeout="auto" unmountOnExit>
            <List disablePadding>
              <ListItemButton
                sx={{ ...navItemSx('/admin/forms/builder'), pl: 5 }}
                onClick={() => router.push('/admin/forms/builder')}
              >
                <ListItemIcon sx={{ minWidth: 32 }}><AddCircleOutlineIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Form Builder" slotProps={{ primary: { style: { fontSize: 13 } } }} />
              </ListItemButton>
              <ListItemButton
                sx={{ ...navItemSx('/admin/forms'), pl: 5 }}
                onClick={() => router.push('/admin/forms')}
              >
                <ListItemIcon sx={{ minWidth: 32 }}><ListAltIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="All Forms" slotProps={{ primary: { style: { fontSize: 13 } } }} />
              </ListItemButton>
              <ListItemButton
                sx={{ ...navItemSx('/admin/forms/submissions'), pl: 5 }}
                onClick={() => router.push('/admin/forms/submissions')}
              >
                <ListItemIcon sx={{ minWidth: 32 }}><AssignmentIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="Submissions" slotProps={{ primary: { style: { fontSize: 13 } } }} />
              </ListItemButton>
            </List>
          </Collapse>

          {/* Patients */}
          <ListItemButton sx={navItemSx('/admin/patients')} onClick={() => router.push('/admin/patients')}>
            <ListItemIcon sx={{ minWidth: 36 }}><PersonIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Patients" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>

          {/* Users */}
          <ListItemButton sx={navItemSx('/admin/users')} onClick={() => router.push('/admin/users')}>
            <ListItemIcon sx={{ minWidth: 36 }}><GroupIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Users" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>

          {/* Analytics */}
          <ListItemButton sx={navItemSx('/admin/analytics')} onClick={() => router.push('/admin/analytics')}>
            <ListItemIcon sx={{ minWidth: 36 }}><BarChartIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Analytics" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>

          {/* Integrations */}
          <ListItemButton sx={navItemSx('/admin/integrations')} onClick={() => router.push('/admin/integrations')}>
            <ListItemIcon sx={{ minWidth: 36 }}><ExtensionIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Integrations" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>

          {/* Audit Log */}
          <ListItemButton sx={navItemSx('/admin/audit')} onClick={() => router.push('/admin/audit')}>
            <ListItemIcon sx={{ minWidth: 36 }}><SecurityIcon fontSize="small" /></ListItemIcon>
            <ListItemText primary="Audit Log" slotProps={{ primary: { style: { fontSize: 14 } } }} />
          </ListItemButton>
        </List>
      </Box>

      {/* Bottom section */}
      <Box sx={{ px: 2, pb: 2 }}>
        {/* Theme color switcher */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
          {(Object.keys(themes) as ThemeKey[]).map((key) => (
            <Tooltip key={key} title={themes[key].name} placement="top">
              <IconButton
                size="small"
                onClick={() => setTheme(key)}
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: themes[key].primary,
                  ...(themeKey === key
                    ? { outline: '2px solid white', outlineOffset: '2px' }
                    : {}),
                  '&:hover': { bgcolor: themes[key].primary, opacity: 0.85 },
                }}
              />
            </Tooltip>
          ))}
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)', mb: 1.5 }} />

        {/* User info */}
        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: muiTheme.palette.primary.main, fontSize: 13 }}>
              {getInitials(user.email)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{ color: '#fff', display: 'block', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {user.email}
              </Typography>
              <Chip
                label={user.role.replace(/_/g, ' ')}
                size="small"
                sx={{
                  height: 16,
                  fontSize: 10,
                  mt: 0.25,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  color: '#fff',
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
          </Box>
        )}

        {/* Logout */}
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
          <ListItemIcon sx={{ minWidth: 32 }}><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{ primary: { style: { fontSize: 13, color: 'rgba(255,255,255,0.7)' } } }}
          />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar drawer */}
      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      ) : (
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
      )}

      {/* Main area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* AppBar */}
        <AppBar
          position="static"
          elevation={0}
          sx={{ height: 64, justifyContent: 'center' }}
        >
          <Toolbar sx={{ gap: 2 }}>
            {/* Mobile hamburger */}
            {isMobile && (
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setMobileOpen(true)}
              >
                <MenuIcon />
              </IconButton>
            )}

            {/* Page title */}
            <Typography variant="h6" sx={{ fontWeight: 600, whiteSpace: 'nowrap', mr: 2 }}>
              {getPageTitle(pathname)}
            </Typography>

            {/* Search bar */}
            <Box sx={{ flex: 1, maxWidth: 480, position: 'relative' }} ref={searchRef}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search patients, forms..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    sx: {
                      bgcolor: 'rgba(255,255,255,0.15)',
                      borderRadius: 2,
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: '1px solid rgba(255,255,255,0.5)' },
                      '& input::placeholder': { color: 'rgba(255,255,255,0.6)' },
                      '& input': { color: '#fff' },
                    },
                  },
                  // suppress browser-extension fdprocessedid hydration mismatch
                  htmlInput: { suppressHydrationWarning: true },
                }}
              />
              {searchOpen && searchResults.length > 0 && (
                <Paper
                  elevation={8}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    mt: 0.5,
                    zIndex: 1300,
                    maxHeight: 300,
                    overflowY: 'auto',
                    borderRadius: 2,
                  }}
                >
                  {searchResults.map((result) => (
                    <Box
                      key={result.id}
                      sx={{
                        px: 2,
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onMouseDown={() => {
                        setSearchOpen(false)
                        router.push(result.href)
                      }}
                    >
                      {result.type === 'form' ? <ListAltIcon fontSize="small" color="primary" /> : <PersonIcon fontSize="small" color="secondary" />}
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{result.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          {result.type}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Paper>
              )}
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Notification Bell */}
            {user && <NotificationBell userId={user.id} role={user.role} />}

            {/* User avatar menu */}
            <Tooltip title="Account menu">
              <IconButton
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ p: 0 }}
              >
                <Avatar sx={{ width: 36, height: 36, bgcolor: 'rgba(255,255,255,0.25)', fontSize: 14, color: '#fff' }}>
                  {user ? getInitials(user.email) : '?'}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={() => setAnchorEl(null)}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { mt: 1, minWidth: 160 } } }}
            >
              <MenuItem onClick={() => { setAnchorEl(null); router.push('/admin/profile') }}>
                Profile
              </MenuItem>
              <MenuItem onClick={() => { setAnchorEl(null); router.push('/admin/settings') }}>
                Settings
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorEl(null); handleLogout() }} sx={{ color: 'error.main' }}>
                <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            bgcolor: 'background.default',
            overflowY: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  )
}
