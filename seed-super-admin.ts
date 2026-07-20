/**
 * scripts/seed-super-admin.ts
 *
 * Creates (or repairs) the first Super Admin account so there's always one
 * account able to bootstrap the rest of the role hierarchy.
 *
 * Run with: `npx tsx scripts/seed-super-admin.ts`
 *
 * Reads credentials from env vars, falling back to dev defaults so local
 * setup "just works" without extra config. DO NOT rely on the fallback
 * defaults outside local dev — see the warning below.
 */

import { createClient } from '@supabase/supabase-js';
import { join } from 'path';
import { existsSync } from 'fs';

// Programmatically load environment variables in Node.js 20.6.0+
const envLocalPath = join(process.cwd(), '.env.local');
const envPath = join(process.cwd(), '.env');

if (typeof process.loadEnvFile === 'function') {
  if (existsSync(envLocalPath)) {
    process.loadEnvFile(envLocalPath);
  } else if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // never NEXT_PUBLIC_*

// Dev-only fallbacks. In any shared/staging/production environment these
// MUST be overridden via real env vars — the script will warn loudly if
// it detects the fallback is being used outside NODE_ENV=development.
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? 'super_admin@collective.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'TestPass123!';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

async function main() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  }

  const usingFallbackPassword = !process.env.SUPER_ADMIN_PASSWORD;
  if (usingFallbackPassword && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed the default TestPass123! password in a production ' +
      'environment. Set SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD explicitly.'
    );
  }
  if (usingFallbackPassword) {
    console.warn(
      '⚠️  Using the default dev super admin password. Fine for local dev — ' +
      'never deploy this to staging/production without overriding it.'
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Does a user with this email already exist?
  const { data: existingList, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
  if (listErr) throw listErr;
  const existing = existingList.users.find(
    (u) => u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`Super admin auth user already exists (${userId}), reusing it.`);
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true, // skip the verification email — we're vouching for this address ourselves
      user_metadata: { full_name: SUPER_ADMIN_NAME },
    });
    if (createErr) throw createErr;
    userId = created.user!.id;
    console.log(`Created super admin auth user (${userId}).`);
  }

  // 2. Ensure the profiles row exists and is set to super_admin.
  //    (The handle_new_user() trigger already created a row on step 1 if the
  //    user was newly created — this upsert just guarantees the role is
  //    correct even if the bootstrap allowlist wasn't seeded first, or if
  //    re-running this script against an existing profile.)
  const { error: upsertErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        role: 'super_admin',
      },
      { onConflict: 'id' }
    );
  if (upsertErr) throw upsertErr;

  console.log(`✅ ${SUPER_ADMIN_EMAIL} is set up as super_admin.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
