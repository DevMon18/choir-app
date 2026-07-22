import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = type === 'recovery' ? '/auth/reset-password' : (searchParams.get('next') ?? '/dashboard');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Ensure profile exists in database
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile) {
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'New Member';
          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email!,
            full_name: fullName,
            role: 'pending',
          });
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      let targetOrigin = origin;
      if (forwardedHost) {
        targetOrigin = `https://${forwardedHost}`;
      } else if (origin.includes('localhost') && process.env.NODE_ENV === 'production') {
        targetOrigin = 'https://choir-app-ecru.vercel.app';
      }

      return NextResponse.redirect(`${targetOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not exchange auth code for session`);
}

