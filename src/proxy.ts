import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export const proxy = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Let public assets/APIs bypass proxy logic
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api') ||
    path.endsWith('.ico') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.svg')
  ) {
    return supabaseResponse;
  }

  const isPublicPage =
    path === '/login' ||
    path === '/signup' ||
    path === '/join' ||
    path === '/auth/reset-password' ||
    path.startsWith('/auth/');

  if (!user) {
    // If not authenticated and not on a public page, redirect to login
    if (!isPublicPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Read role from JWT app_metadata (synced automatically by DB trigger)
  const role = (user.app_metadata?.role as string) ?? 'pending';

  // Inject custom request headers to propagate user identity and role to layouts/pages
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', user.id);
  requestHeaders.set('x-user-email', user.email || '');
  requestHeaders.set('x-user-role', role);
  requestHeaders.set('x-user-name', user.user_metadata?.full_name || '');

  const originalResponse = supabaseResponse;
  supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  
  // Preserve any cookies set during the Supabase client instantiation/refresh
  originalResponse.cookies.getAll().forEach((c) => {
    supabaseResponse.cookies.set(c.name, c.value);
  });

  // If logged in and attempting to access login/signup/join, redirect to home
  if (isPublicPage) {
    const url = request.nextUrl.clone();
    if (role === 'pending') {
      url.pathname = '/pending-approval';
    } else if (role === 'rejected') {
      url.pathname = '/rejected';
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  // Handle pending state
  if (role === 'pending') {
    if (path !== '/pending-approval') {
      const url = request.nextUrl.clone();
      url.pathname = '/pending-approval';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Handle rejected state
  if (role === 'rejected') {
    if (path !== '/rejected') {
      const url = request.nextUrl.clone();
      url.pathname = '/rejected';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Clean roles cannot access /pending-approval or /rejected
  if (path === '/pending-approval' || path === '/rejected') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Admin routes access control
  if (path.startsWith('/admin')) {
    if (role === 'super_admin' || role === 'director') {
      return supabaseResponse;
    }

    if (role === 'secretary') {
      // Secretary is allowed only `/admin/users`, `/admin/roster`, `/admin/attendance`, `/admin/songs`, `/admin/analytics`, `/admin/sequences`
      const allowedSecRoutes = ['/admin/users', '/admin/roster', '/admin/attendance', '/admin/songs', '/admin/analytics', '/admin/sequences'];
      const isAllowed = allowedSecRoutes.some(
        (r) => path === r || path.startsWith(r + '/')
      );
      if (!isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    if (role === 'treasurer') {
      // Treasurer is allowed only `/admin/finances`, `/admin/analytics`
      const isAllowed =
        path === '/admin/finances' ||
        path.startsWith('/admin/finances/') ||
        path === '/admin/analytics' ||
        path.startsWith('/admin/analytics/');

      if (isAllowed) {
        return supabaseResponse;
      }
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    // Members or others redirected to /dashboard
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Member-accessible routes (all approved members, not pending/rejected)
  // /live, /directory, /dues, /repertoire are allowed for all active members
  // (pending/rejected already redirected above, so we just return here)
  return supabaseResponse;
};

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
