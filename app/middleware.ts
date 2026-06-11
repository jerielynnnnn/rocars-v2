// middleware.ts (in the root of your project)
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { canAccessAdminPath, isAdminLikeRole } from '@/lib/admin-role'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options)
            })
          } catch {
            // Ignore if called from Server Component
          }
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin')
  const isAuthRoute = req.nextUrl.pathname === '/login' || 
                      req.nextUrl.pathname === '/register'

  // Protect Admin Routes
  if (isAdminRoute) {
    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (!isAdminLikeRole(profile?.role)) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    if (!canAccessAdminPath(profile?.role, req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url))
    }
  }

  // Redirect Admin users from customer pages to dashboard
  if (session && !isAdminRoute && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (isAdminLikeRole(profile?.role)) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}
