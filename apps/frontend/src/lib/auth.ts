export interface UserSession {
  id: string
  email: string
  role: string
  tenantId?: string
  name?: string
}

const SUPER_ADMIN_ROLE = 'super_admin'
const TENANT_ADMIN_ROLES = ['tenant_admin', 'department_admin']
const ADMIN_ROLES = [SUPER_ADMIN_ROLE, ...TENANT_ADMIN_ROLES]
const CLINICIAN_ROLES = ['doctor', 'nurse', 'receptionist']

export function getUser(): UserSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('user_session')
    return raw ? (JSON.parse(raw) as UserSession) : null
  } catch {
    return null
  }
}

export function setUser(user: UserSession): void {
  localStorage.setItem('user_session', JSON.stringify(user))
  const maxAge = 7 * 24 * 60 * 60
  document.cookie = `user_role=${user.role}; path=/; max-age=${maxAge}; SameSite=Lax`
  if (user.tenantId) {
    document.cookie = `tenant_id=${user.tenantId}; path=/; max-age=${maxAge}; SameSite=Lax`
  }
}

export function clearUser(): void {
  localStorage.removeItem('user_session')
  document.cookie = 'user_role=; path=/; max-age=0'
  document.cookie = 'tenant_id=; path=/; max-age=0'
}

export function getCurrentTenantId(): string {
  const user = getUser()
  return user?.tenantId ?? 'system'
}

export function isSuperAdmin(user?: UserSession | null): boolean {
  const u = user ?? getUser()
  return u?.role === SUPER_ADMIN_ROLE
}

export function isTenantAdmin(user?: UserSession | null): boolean {
  const u = user ?? getUser()
  return TENANT_ADMIN_ROLES.includes(u?.role ?? '')
}

export function isDoctor(user?: UserSession | null): boolean {
  const u = user ?? getUser()
  return u?.role === 'doctor'
}

export function isNurse(user?: UserSession | null): boolean {
  const u = user ?? getUser()
  return u?.role === 'nurse'
}

export function isAdmin(): boolean {
  const user = getUser()
  return ADMIN_ROLES.includes(user?.role ?? '')
}

export function getDashboardPath(role: string, tenantId?: string): string {
  // Only the platform super admin (tenantId === 'PLATFORM') goes to /super-admin
  if (role === SUPER_ADMIN_ROLE && tenantId === 'PLATFORM') return '/super-admin/dashboard'
  // super_admin with any other tenantId is treated as a tenant-level admin
  if (role === SUPER_ADMIN_ROLE || TENANT_ADMIN_ROLES.includes(role)) return '/admin/dashboard'
  if (CLINICIAN_ROLES.includes(role)) return '/clinician/dashboard'
  return '/clinician/dashboard'
}
