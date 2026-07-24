import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const envLocalPath = join(process.cwd(), '.env.local');
if (typeof process.loadEnvFile === 'function' && existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'twjtupwztrndxtvagmca';
const PAT = process.env.SUPABASE_PAT;

if (!PAT) {
  console.error('Missing SUPABASE_PAT in environment.');
  process.exit(1);
}

const migration1 = readFileSync(join(process.cwd(), 'supabase/migrations/20260726000000_practice_track_uploads.sql'), 'utf-8');
const migration2 = readFileSync(join(process.cwd(), 'supabase/migrations/20260726000001_practice_track_history.sql'), 'utf-8');

const combinedSql = `${migration1}\n\n${migration2}`;

async function runSql() {
  console.log(`Running migration SQL against Supabase project ${PROJECT_REF}...`);
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: combinedSql }),
  });

  if (!response.ok) {
    // Try /v1/projects/{ref}/sql
    const response2 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: combinedSql }),
    });

    if (!response2.ok) {
      const errText = await response2.text();
      console.error(`Migration API call failed (${response2.status}):`, errText);
      process.exit(1);
    }
    const result2 = await response2.json();
    console.log('Migration executed successfully via /sql:', result2);
    return;
  }

  const result = await response.json();
  console.log('Migration executed successfully via /database/query:', result);
}

runSql().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
