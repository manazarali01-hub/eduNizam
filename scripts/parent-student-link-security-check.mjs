import fs from 'node:fs';
import assert from 'node:assert/strict';

const sql = fs.readFileSync('supabase/migrations/20261015140000_scope_parent_link_to_institution.sql', 'utf8');
const match = sql.match(/create or replace function private\.request_parent_link_by_student_code_impl\(p_student_code text\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i);
assert.ok(match, 'Expected school-scoped private parent-link implementation');
const body = match[1];

assert.match(sql, /security definer\s+set search_path\s*=\s*''/i,
  'SECURITY DEFINER function must use an empty search_path');
assert.match(body, /auth\.uid\(\)/i, 'RPC must require an authenticated user');
assert.match(body, /profile_role is distinct from 'parent'/i,
  'RPC must reject both missing/null profiles and non-parent roles');
assert.match(body, /clean_code = ''[\s\S]*?raise exception 'Student Code is required'/i,
  'RPC must reject blank student codes');
assert.match(body, /profile_institution is null[\s\S]*?raise exception 'Parent account is not linked to a school'/i,
  'RPC must reject parent accounts without an institution scope');
assert.match(body, /select count\(\*\) into matching_students/i,
  'RPC must count school-scoped matches before choosing a student');
assert.match(body, /cs\.institution_id = profile_institution/i,
  'Student lookup must be scoped to the authenticated parent institution');
assert.match(body, /matching_students = 0[\s\S]*?raise exception/i,
  'RPC must reject unknown or unlinked student codes');
assert.match(body, /matching_students > 1[\s\S]*?raise exception 'Student code is ambiguous in your school/i,
  'RPC must fail closed when duplicate codes exist within the parent school');
assert.match(body, /cs\.auth_user_id is not null/i,
  'RPC must only create requests for student accounts already linked to a student row');
assert.match(body, /status = case[\s\S]*?then 'approved' else 'pending' end/i,
  'Re-requesting a child link must not silently revoke an already approved link');
assert.match(sql, /create or replace function public\.request_parent_link_by_student_code[\s\S]*?select private\.request_parent_link_by_student_code_impl/i,
  'Public RPC must remain a wrapper around the private implementation');
assert.match(sql, /revoke all on function private\.request_parent_link_by_student_code_impl\(text\) from public, anon/i);
assert.match(sql, /grant execute on function private\.request_parent_link_by_student_code_impl\(text\) to authenticated/i);
assert.match(sql, /revoke all on function public\.request_parent_link_by_student_code\(text\) from public, anon/i);
assert.match(sql, /grant execute on function public\.request_parent_link_by_student_code\(text\) to authenticated/i);

console.log('Parent student-link institution-scope regression checks passed.');
