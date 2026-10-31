import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20261031120000_allow_class_teacher_leave_review_trigger.sql';
const sql = fs.readFileSync(migrationPath, 'utf8');
const helper = sql.match(/create or replace function private\.is_assigned_leave_teacher_v1\([\s\S]*?\$\$;/i)?.[0] ?? '';
const trigger = sql.match(/create or replace function private\.guard_leave_review_v2\([\s\S]*?\$\$;/i)?.[0] ?? '';

assert.ok(helper, 'assigned-teacher helper must exist');
assert.ok(trigger, 'leave-review trigger replacement must exist');
assert.match(helper, /p_teacher_user_id\s*=\s*\(select auth\.uid\(\)\)/i, 'helper must bind teacher identity to auth.uid()');
assert.match(helper, /institution_members[\s\S]*?m\.role\s*=\s*'teacher'/i, 'helper must require active teacher membership role');
assert.match(helper, /teacher_student_links/i, 'helper must retain explicit teacher-student links');
assert.match(helper, /class_sections[\s\S]*?coalesce\(cs\.active,true\)=true[\s\S]*?cs\.class_teacher_user_id\s*=\s*p_teacher_user_id/i, 'helper must allow only the active assigned class teacher');
assert.match(sql, /revoke all on function private\.is_assigned_leave_teacher_v1\(uuid,uuid,uuid\)[\s\S]*?from public, anon/i, 'helper execution must be revoked from PUBLIC and anon');
assert.match(sql, /grant execute on function private\.is_assigned_leave_teacher_v1\(uuid,uuid,uuid\)[\s\S]*?to authenticated/i, 'helper execution must be granted to authenticated');
assert.match(trigger, /private\.is_assigned_leave_teacher_v1\(/i, 'trigger must use the shared assignment helper');
assert.match(trigger, /new\.status<>old\.status[\s\S]*?Only School Admin can finalize leave/i, 'teacher must not finalize a leave request');
assert.match(trigger, /if owner then[\s\S]*?new\.status not in \('Approved','Rejected'\)/i, 'only the institution owner branch may finalize');
assert.match(trigger, /new\.teacher_reviewed_by:=uid[\s\S]*?new\.teacher_reviewed_at:=now\(\)/i, 'teacher review identity and timestamp must be recorded');

console.log('Class-teacher leave trigger migration contract: PASS');
