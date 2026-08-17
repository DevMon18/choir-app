import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Force permanent 1-year persistence for all Supabase session cookies
              const cookieOptions = { ...options };
              cookieOptions.maxAge = 60 * 60 * 24 * 365; // 1 year (31,536,000s)
              cookieOptions.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
              cookieOptions.sameSite = 'lax';
              cookieOptions.path = '/';
              cookieOptions.secure = process.env.NODE_ENV === 'production';
              cookieStore.set(name, value, cookieOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
};
