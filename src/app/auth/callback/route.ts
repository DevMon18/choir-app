import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = type === 'recovery' ? '/auth/reset-password' : (searchParams.get('next') ?? '/dashboard');

  const isNative = searchParams.get('native') === 'true' || searchParams.get('isNative') === 'true';

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

      if (isNative) {
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authenticating...</title>
  <style>
    body { background: #090d16; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 32px; border-radius: 16px; backdrop-filter: blur(12px); max-width: 320px; width: 90%; }
    .spinner { border: 3px solid rgba(255,255,255,0.1); border-top-color: #3b82f6; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h3 style="margin: 0 0 8px;">Authenticated!</h3>
    <p style="margin: 0; color: #9ca3af; font-size: 14px;">Returning to Choir Collective...</p>
  </div>
  <script>
    setTimeout(function() {
      window.location.href = "com.choircollective.app://auth/callback";
    }, 200);
  </script>
</body>
</html>`;
        return new NextResponse(html, {
          headers: { 'Content-Type': 'text/html' },
        });
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

