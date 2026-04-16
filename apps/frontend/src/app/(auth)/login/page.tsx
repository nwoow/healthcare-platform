'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { authApi, iamApi } from '@/lib/api'
import { setUser, clearUser, getDashboardPath } from '@/lib/auth'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFields = z.infer<typeof loginSchema>

function inferRoleFromEmail(email: string): string {
  if (email.includes('superadmin') || email.includes('platform')) return 'super_admin'
  if (email.includes('admin')) return 'tenant_admin'
  if (email.includes('doctor') || email.includes('dr.')) return 'doctor'
  if (email.includes('nurse')) return 'nurse'
  return 'doctor'
}

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({ resolver: standardSchemaResolver(loginSchema) })

  const onSubmit = async (data: LoginFields) => {
    setServerError(null)
    // Clear any stale session from a previous login (e.g. super_admin cookies)
    clearUser()
    try {
      // 1. Authenticate — auth service sets httpOnly access_token + refresh_token cookies
      const { data: authData } = await authApi.post<{ user: { id: string; email: string } }>(
        '/auth/login',
        { email: data.email, password: data.password },
      )

      const { id, email } = authData.user
      const tenantId: string = (authData as any).user?.tenantId ?? 'system'

      // 2. Fetch IAM roles — try user's own tenantId first, then system
      let role = inferRoleFromEmail(email) // fallback if IAM has nothing
      try {
        for (const tid of [tenantId, 'system']) {
          const { data: roles } = await iamApi.get<Array<{ name: string }>>(
            `/iam/users/${id}/roles`,
            { params: { tenantId: tid } },
          )
          if (roles.length > 0) { role = roles[0].name; break }
        }
      } catch {
        // IAM unavailable — keep email-inferred role
      }

      // 3. Super-admins must use the dedicated super-admin login portal
      if (role === 'super_admin') {
        setServerError('Super-admin accounts must sign in at /super-admin/login')
        return
      }

      // 4. Persist session in localStorage + set user_role cookie for middleware
      setUser({ id, email, role, tenantId })

      // 5. Redirect to the correct dashboard
      router.push(getDashboardPath(role, tenantId))
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid email or password'
      setServerError(typeof message === 'string' ? message : 'Login failed')
    }
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
          H
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-card-foreground">
          Healthcare Platform
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@hospital.com"
            {...register('email')}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            aria-invalid={!!errors.email}
            suppressHydrationWarning
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            {...register('password')}
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            aria-invalid={!!errors.password}
            suppressHydrationWarning
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Server error */}
        {serverError && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
