import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const accessToken = request.cookies.get('access_token')
  const userRole = request.cookies.get('user_role')?.value ?? ''
  const tenantId = request.cookies.get('tenant_id')?.value ?? ''

  // A "platform super admin" is super_admin with tenantId === 'PLATFORM'
  const isPlatformSuperAdmin = userRole === 'super_admin' && tenantId === 'PLATFORM'

  // /super-admin/* — platform super_admin only
  if (pathname.startsWith('/super-admin') && !pathname.startsWith('/super-admin/login')) {
    if (!accessToken || !isPlatformSuperAdmin) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url))
    }
  }

  // /admin/* — tenant_admin, department_admin, or super_admin with non-PLATFORM tenantId
  if (pathname.startsWith('/admin')) {
    if (!accessToken || !userRole) {
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    if (isPlatformSuperAdmin) {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url))
    }
    if (!['tenant_admin', 'department_admin', 'super_admin'].includes(userRole)) {
      return NextResponse.redirect(new URL('/clinician/dashboard', request.url))
    }
  }

  // /clinician/* — doctor, nurse, receptionist
  if (pathname.startsWith('/clinician')) {
    if (!accessToken || !userRole) {
      const url = new URL('/login', request.url)
      url.searchParams.set('from', pathname)
      return NextResponse.redirect(url)
    }
    if (isPlatformSuperAdmin) {
      return NextResponse.redirect(new URL('/super-admin/dashboard', request.url))
    }
    if (!['doctor', 'nurse', 'receptionist'].includes(userRole)) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/clinician/:path*', '/super-admin/:path*'],
}
