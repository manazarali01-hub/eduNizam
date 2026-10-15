import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('supabase/migrations/20261015133000_fail_closed_parent_student_link.sql', 'utf8');
const match = sql.match(/create or replace function public\.request_parent_link_by_student_code\(p_student_code text\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i);
assert.ok(match, 'Expected parent-student link hardening migration');
const body = match[1];

assert.match(sql, /security definer\s+set search_path\s*=\s*''/i,
  'SECURITY DEFINER function must use an empty search_path');
assert.match(body, /auth\.uid\(\)/i, 'RPC must require an authenticated user');
assert.match(body, /profile_role is distinct from 'parent'/i,
  'RPC must reject both missing/null profiles and non-parent roles');
assert.match(body, /clean_code = ''[\s\S]*?raise exception 'Student Code is required'/i,
  'RPC must reject blank student codes');
assert.match(body, /select count\(\*\) into matching_students/i,
  'RPC must count matches before choosing a student');
assert.match(body, /matching_students = 0[\s\S]*?raise exception/i,
  'RPC must reject unknown or unlinked student codes');
assert.match(body, /matching_students > 1[\s\S]*?raise exception 'Student code is ambiguous/i,
  'RPC must fail closed when school-local codes collide across institutions');
assert.match(body, /cs\.auth_user_id is not null/i,
  'RPC must only create requests for student accounts already linked to a student row');
assert.match(body, /status = case when public\.parent_student_links\.status = 'approved'[\s\S]*?then 'approved' else 'pending' end/i,
  'Re-requesting a child link must not silently revoke an already approved link');
assert.match(sql, /revoke all on function public\.request_parent_link_by_student_code\(text\) from public, anon/i);
assert.match(sql, /grant execute on function public\.request_parent_link_by_student_code\(text\) to authenticated/i);

console.log('Parent student-link authorization regression checks passed.');
