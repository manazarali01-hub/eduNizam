/* Static contract test for teacher diary INSERT/UPDATE/DELETE policy scope.
 * Checks migration text only; it does not execute SQL or replace live RLS tests.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../supabase/migrations/20261016130000_scope_diary_write_policies.sql', import.meta.url), 'utf8');
const compact = migration.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const count = (value, fragment) => value.split(fragment).length - 1;

assert.match(compact, /^\s*begin;/, 'Migration must start a transaction');
assert.match(compact, /commit;\s*$/, 'Migration must commit its transaction');
assert.equal(count(compact, 'create policy '), 3, 'Expected INSERT, UPDATE and DELETE policy replacements');
assert.equal(count(compact, 'drop policy if exists '), 3, 'Expected only the three diary teacher policies to be replaced');

for (const [name, command] of [
  ['diary teacher updates own', 'update'],
  ['diary teacher deletes own', 'delete']
]) {
  const start = compact.indexOf('create policy "' + name + '" on public.daily_class_diaries');
  assert.notEqual(start, -1, 'Missing ' + command.toUpperCase() + ' policy');
  const end = compact.indexOf(';', start);
  assert.notEqual(end, -1, 'Policy statement must terminate');
  const body = compact.slice(start, end);
  assert.ok(body.includes(' for ' + command + ' to authenticated using ('), command + ' must be authenticated only');
  assert.ok(body.includes('teacher_user_id = (select auth.uid())'), 'Policy must bind to the diary teacher');
  assert.ok(body.includes("public.current_account_role() = 'teacher'"), 'Policy must require teacher role');
  assert.ok(body.includes('public.is_institution_staff(institution_id)'), 'Policy must require current institution authorization');
  assert.ok(body.includes('from public.class_sections cs'), 'Policy must validate current class assignment');
  assert.ok(body.includes('cs.class_teacher_user_id = (select auth.uid())'), 'Policy must require the current class teacher');
  assert.ok(body.includes("cs.active is true"), 'Policy must require an active class section');
  if (command === 'update') assert.ok(body.includes(' with check ('), 'UPDATE policy must validate the new row');
}

const insertStart = compact.indexOf('create policy "assigned teachers write diaries" on public.daily_class_diaries');
assert.notEqual(insertStart, -1, 'Missing INSERT policy');
const insertEnd = compact.indexOf(';', insertStart);
const insertBody = compact.slice(insertStart, insertEnd);
assert.ok(insertBody.includes(' for insert to authenticated with check ('), 'INSERT must be authenticated and use WITH CHECK');
assert.ok(insertBody.includes('teacher_user_id = (select auth.uid())'), 'INSERT must bind the diary teacher');
assert.ok(insertBody.includes("public.current_account_role() = 'teacher'"), 'INSERT must require teacher role');
assert.ok(insertBody.includes('cs.class_teacher_user_id = (select auth.uid())'), 'INSERT must require current class teacher assignment');
assert.ok(insertBody.includes('cs.active is true'), 'INSERT must reject inactive class sections');
assert.doesNotMatch(compact, /to public|to anon/, 'Policies must not grant public or anonymous access');
assert.doesNotMatch(compact, /insert into|delete from|truncate|update public\./, 'Migration must not mutate diary records');
console.log('Teacher diary RLS contract PASS: INSERT/UPDATE/DELETE require teacher role and active class assignment.');
