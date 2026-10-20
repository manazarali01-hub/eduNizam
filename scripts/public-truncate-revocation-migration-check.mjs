import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  'supabase/migrations/20261020110000_revoke_authenticated_truncate_public.sql',
  'utf8'
);
// Keep comments/documentation out of SQL contract assertions: explanatory
// comments may name a forbidden statement without executing it.
const executableSql = migration.replace(/--.*$/gm, '');

assert.match(executableSql, /revoke\s+truncate\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*,\s*authenticated\s*;/i,
  'Existing public tables must revoke TRUNCATE from both app-facing roles');

assert.match(executableSql, /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+truncate\s+on\s+tables\s+from\s+anon\s*,\s*authenticated\s*;/i,
  'Future tables created by postgres must not grant TRUNCATE to anon/authenticated');

// Do not silently ship an ALTER DEFAULT PRIVILEGES operation for a role the
// migration executor is not authorized to act as. supabase_admin needs a
// separate authorized remediation path if its own objects are introduced.
assert.doesNotMatch(executableSql, /alter\s+default\s+privileges\s+for\s+role\s+supabase_admin\b/i,
  'Migration must not alter supabase_admin defaults without role membership');

assert.doesNotMatch(executableSql, /grant\s+all\s+on\s+all\s+tables/i,
  'Security migration must not add broad table grants');
assert.doesNotMatch(executableSql, /drop\s+policy|create\s+policy/i,
  'Security migration must not alter RLS policies');
assert.doesNotMatch(executableSql, /revoke\s+(select|insert|update|delete)\b/i,
  'Security migration must not change ordinary CRUD privileges');

console.log('Public TRUNCATE revocation migration contract checks passed.');


// The production audit also found supabase_admin-owned defaults. Keep that
// remediation separate and fail-closed: it must run as the owning role.
const ownerRemediation = fs.readFileSync(
  'supabase/manual/20261020_supabase_admin_default_truncate_remediation.sql',
  'utf8'
);
assert.match(ownerRemediation, /current_user\s*<>\s*'supabase_admin'/i,
  'Owner-default remediation must refuse to run under an unauthorized role');
for (const schema of ['public', 'graphql', 'graphql_public']) {
  assert.match(ownerRemediation, new RegExp(
    'alter\\s+default\\s+privileges\\s+in\\s+schema\\s+' + schema +
    '\\s+revoke\\s+truncate\\s+on\\s+tables\\s+from\\s+anon\\s*,\\s*authenticated\\s*;', 'i'
  ), 'Owner-default remediation must cover ' + schema);
}
assert.match(ownerRemediation, /a\.privilege_type\s*=\s*'TRUNCATE'/i,
  'Owner-default remediation must verify the resulting ACL');
assert.match(ownerRemediation, /commit\s*;/i,
  'Owner-default remediation must commit only after the verification block');
assert.doesNotMatch(ownerRemediation, /set\s+role\s+supabase_admin/i,
  'Remediation must not attempt unauthorized role impersonation');

console.log('Supabase owner-default remediation contract checks passed.');
