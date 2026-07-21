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
              // Force long persistence for Supabase authentication cookies
              const cookieOptions = { ...options };
              if (name.includes('sb-') || name.includes('supabase')) {
                cookieOptions.maxAge = 60 * 60 * 24 * 365; // 1 year
                cookieOptions.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
              }
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
