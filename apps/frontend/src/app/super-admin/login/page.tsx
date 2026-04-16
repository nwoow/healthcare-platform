'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material'
import {
  LockOutlined as LockIcon,
  Visibility,
  VisibilityOff,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material'
import { authApi, iamApi } from '@/lib/api'
import { setUser } from '@/lib/auth'

interface LoginFormData {
  email: string
  password: string
}

export default function SuperAdminLoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>()

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true)
    setServerError(null)

    try {
      // Step 1: Authenticate
      const loginRes = await authApi.post('/auth/login', {
        email: data.email,
        password: data.password,
      })

      const userId = loginRes.data.user?.id ?? loginRes.data.id
      const userEmail = loginRes.data.user?.email ?? loginRes.data.email ?? data.email
      const userTenantId: string = loginRes.data.user?.tenantId ?? ''

      // Step 2: Verify super_admin role.
      // IAM roles are seeded in tenantId='system'. Try both 'PLATFORM' and 'system'.
      // If IAM has no assignment (fresh seed), fall back to trusting tenantId='PLATFORM' from auth.
      let isSuperAdmin = false
      for (const tid of ['PLATFORM', 'system']) {
        try {
          const r = await iamApi.get<Array<{ name: string }>>(
            `/iam/users/${userId}/roles?tenantId=${tid}`,
          )
          if ((r.data ?? []).some((role) => role.name === 'super_admin')) {
            isSuperAdmin = true
            break
          }
        } catch {
          // IAM unavailable — continue to next tenantId
        }
      }
      // Final fallback: trust the tenantId stored in the auth service
      if (!isSuperAdmin) {
        isSuperAdmin = userTenantId === 'PLATFORM'
      }

      if (!isSuperAdmin) {
        setServerError('This portal is for Super Admins only')
        setLoading(false)
        return
      }

      // Step 3: Persist session
      setUser({ id: userId, email: userEmail, role: 'super_admin', tenantId: 'PLATFORM' })

      // Step 4: Navigate
      router.push('/super-admin/dashboard')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Please check your credentials.'
      setServerError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        bgcolor: '#F0F4F8',
      }}
    >
      {/* Left panel — branding */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '42%',
          background: 'linear-gradient(160deg, #0A1628 0%, #0E3A5C 55%, #0E7C7B 100%)',
          px: 6,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <Box sx={{
          position: 'absolute', top: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />
        <Box sx={{
          position: 'absolute', bottom: -60, left: -60,
          width: 260, height: 260, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.06)',
        }} />

        <AdminIcon sx={{ fontSize: 64, color: '#0E7C7B', mb: 3 }} />
        <Typography variant="h4" sx={{ color: '#fff', fontWeight: 800, textAlign: 'center', lineHeight: 1.2, mb: 1.5 }}>
          Platform<br />Administration
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 260 }}>
          Centralised control for tenant management, system health, and global configuration.
        </Typography>

        <Box
          sx={{
            mt: 5, px: 2.5, py: 2, borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            maxWidth: 280,
          }}
        >
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', display: 'block', mb: 0.5 }}>
            Default credentials
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: 12 }}>
            superadmin@platform.com
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace', fontSize: 12 }}>
            SuperAdmin@123
          </Typography>
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          px: { xs: 3, sm: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile logo */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mb: 4 }}>
            <AdminIcon sx={{ color: '#0E7C7B', fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0E3A5C' }}>
              Platform Admin
            </Typography>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, color: '#0E3A5C', mb: 0.5 }}>
            Sign in
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Super Admin access only — restricted portal
          </Typography>

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2.5}>
              <TextField
                fullWidth
                label="Email address"
                type="email"
                autoComplete="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                slotProps={{ htmlInput: { suppressHydrationWarning: true } }}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email address' },
                })}
              />

              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword((p) => !p)}
                          edge="end"
                          size="small"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { suppressHydrationWarning: true },
                }}
                {...register('password', { required: 'Password is required' })}
              />

              {serverError && (
                <Alert severity="error" sx={{ borderRadius: 1.5 }}>
                  {serverError}
                </Alert>
              )}

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mt: 0.5,
                  height: 48,
                  bgcolor: '#0E3A5C',
                  '&:hover': { bgcolor: '#0A2A45' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground' },
                  fontWeight: 600,
                  fontSize: 15,
                  boxShadow: 'none',
                  '&:hover:not(:disabled)': { boxShadow: '0 4px 12px rgba(14,58,92,0.3)' },
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <CircularProgress size={16} color="inherit" />
                    Verifying…
                  </Box>
                ) : (
                  <>
                    <LockIcon sx={{ mr: 1, fontSize: 18 }} />
                    Access Platform
                  </>
                )}
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            Regular staff?{' '}
            <Box
              component="a"
              href="/login"
              sx={{ color: '#0E7C7B', textDecoration: 'none', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
            >
              Sign in here
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
