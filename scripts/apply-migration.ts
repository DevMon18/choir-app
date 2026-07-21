#!/usr/bin/env tsx
/**
 * apply-migration.ts
 * 
 * Applies a Supabase migration file to the remote database using
 * the Supabase Management API and a Personal Access Token.
 * 
 * Usage:
 *   npx tsx scripts/apply-migration.ts supabase/migrations/YOUR_FILE.sql
 * 
 * Env required: SUPABASE_PAT and SUPABASE_PROJECT_REF in .env.local
 * or passed as env variables.
 */

import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, 'utf8');
  envText.split('\n').forEach(line => {
    const cleanLine = line.replace(/\r/g, '').trim();
    if (!cleanLine || cleanLine.startsWith('#')) return;
    const match = cleanLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, '');
      process.env[key] = val;
    }
  });
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'twjtupwztrndxtvagmca';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) {
  console.error('❌  Missing SUPABASE_PAT environment variable.');
  console.error('    Add it to .env.local: SUPABASE_PAT=sbp_...');
  process.exit(1);
}

const sqlArg = process.argv[2];
if (!sqlArg) {
  console.error('❌  Usage: npx tsx scripts/apply-migration.ts <path-to-sql-file>');
  process.exit(1);
}

const sqlPath = path.resolve(sqlArg);
if (!fs.existsSync(sqlPath)) {
  console.error(`❌  File not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

const main = async () => {
  console.log(`\n📦  Applying migration: ${path.basename(sqlPath)}`);
  console.log(`    Project: ${PROJECT_REF}`);
  console.log(`    Chars: ${sql.length}\n`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const bodyText = await response.text();

  if (!response.ok) {
    // 42P07 = relation already exists — treat as idempotent success
    if (bodyText.includes('already exists')) {
      console.log('⚠️   Migration already applied (tables/policies exist). Skipping.\n');
      process.exit(0);
    }
    console.error(`❌  API error ${response.status}:\n${bodyText}`);
    process.exit(1);
  }

  console.log('✅  Migration applied successfully!\n');
};

main().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
