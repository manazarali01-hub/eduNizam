import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  'supabase/migrations/20261020100000_preserve_default_school_on_access_approval.sql',
  'utf8'
);

assert.match(migration, /private\.decide_school_access_request_v1\(uuid,boolean,text\)/,
  'Student/Parent approval RPC must be covered');
assert.match(migration, /private\.decide_teacher_school_request_v1\(uuid,boolean,text\)/,
  'Teacher approval RPC must be covered');
assert.match(migration, /pg_get_functiondef\(target\)/,
  'Patch must derive the current deployed function body instead of copying stale business logic');
assert.match(migration, /institution_id=case when public\.user_profiles\.institution_id is null then excluded\.institution_id else public\.user_profiles\.institution_id end/i,
  'Existing default school must be preserved while a missing default may be filled');
assert.match(migration, /if patched = definition then[\s\S]*?refusing partial migration/i,
  'Migration must fail closed if the expected function source differs');
assert.match(migration, /begin;[\s\S]*?commit;/i,
  'Migration must be transactional');

console.log('Default-school preservation migration contract checks passed.');
