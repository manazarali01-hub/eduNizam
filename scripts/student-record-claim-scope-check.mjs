import fs from 'node:fs';
import assert from 'node:assert/strict';

const path = 'supabase/migrations/20261015094949_fail_closed_student_record_claim.sql';
const sql = fs.readFileSync(path, 'utf8');
const match = sql.match(/create or replace function private\.claim_student_record_impl\(p_student_code text\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i);
assert.ok(match, 'Expected private.claim_student_record_impl replacement migration');
const body = match[1];

assert.match(body, /auth\.uid\(\)/i, 'RPC must identify the signed-in user');
assert.match(body, /profile\.account_role is distinct from 'student'/i, 'RPC must require the student role');
assert.match(body, /if profile\.institution_id is null then[\s\S]*?raise exception 'Student account is not linked to a school'/i,
  'RPC must fail closed when the profile has no school scope');
assert.match(body, /where cs\.institution_id=profile\.institution_id/i,
  'Student lookup must be scoped to the authorized school');
assert.doesNotMatch(body, /profile\.institution_id is null\s+or\s+cs\.institution_id/i,
  'A missing school scope must never widen the lookup across institutions');
assert.match(body, /existing\.auth_user_id=uid[\s\S]*?existing\.id<>s\.id/i,
  'An account already linked to another student row must not claim a second record');
assert.match(body, /s\.auth_user_id is not null and s\.auth_user_id <> uid/i,
  'A student row linked to another account must be rejected');
assert.match(sql, /revoke all on function private\.claim_student_record_impl\(text\) from public, anon/i);
assert.match(sql, /grant execute on function private\.claim_student_record_impl\(text\) to authenticated/i);

console.log('Student record claim scope regression checks passed.');
