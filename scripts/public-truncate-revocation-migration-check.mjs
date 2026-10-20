import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  'supabase/migrations/20261020110000_revoke_authenticated_truncate_public.sql',
  'utf8'
);

assert.match(migration, /revoke\s+truncate\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*,\s*authenticated\s*;/i,
  'Existing public tables must revoke TRUNCATE from both app-facing roles');

for (const owner of ['postgres', 'supabase_admin']) {
  const defaultAcl = new RegExp(
    'alter\\s+default\\s+privileges\\s+for\\s+role\\s+' + owner +
    '\\s+in\\s+schema\\s+public\\s+revoke\\s+truncate\\s+on\\s+tables\\s+from\\s+anon\\s*,\\s*authenticated\\s*;',
    'i'
  );
  assert.match(migration, defaultAcl,
    'Future tables created by ' + owner + ' must not grant TRUNCATE to anon/authenticated');
}

assert.doesNotMatch(migration, /grant\s+all\s+on\s+all\s+tables/i,
  'Security migration must not add broad table grants');
assert.doesNotMatch(migration, /drop\s+policy|create\s+policy/i,
  'Security migration must not alter RLS policies');
assert.doesNotMatch(migration, /revoke\s+(select|insert|update|delete)\b/i,
  'Security migration must not change ordinary CRUD privileges');

console.log('Public TRUNCATE revocation migration contract checks passed.');
