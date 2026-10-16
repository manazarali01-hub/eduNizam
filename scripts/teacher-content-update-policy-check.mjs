/* Static contract checks for the teacher content UPDATE/DELETE RLS migration.
 * This validates migration text only; it does not apply SQL or replace live RLS tests.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../supabase/migrations/20261016110000_scope_teacher_content_updates.sql', import.meta.url), 'utf8');
const compact = migration.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const occurrences = (value, fragment) => value.split(fragment).length - 1;

assert.match(compact, /^\s*begin;/, 'Migration must start a transaction');
assert.match(compact, /commit;\s*$/, 'Migration must commit its transaction');
assert.equal(occurrences(compact, 'create policy '), 4, 'Expected two UPDATE and two DELETE replacement policies');
assert.equal(occurrences(compact, 'drop policy if exists '), 4, 'Expected to replace only the four named creator policies');

for (const [policy, table, command] of [
  ['question creator updates', 'teacher_question_bank', 'update'],
  ['paper creator updates', 'teacher_papers', 'update'],
  ['question creator deletes', 'teacher_question_bank', 'delete'],
  ['paper creator deletes', 'teacher_papers', 'delete']
]) {
  const start = compact.indexOf('create policy "' + policy + '" on public.' + table);
  assert.notEqual(start, -1, 'Missing policy for ' + table + ' ' + command);
  const end = compact.indexOf(';', start);
  assert.notEqual(end, -1, 'Policy statement must terminate for ' + table + ' ' + command);
  const body = compact.slice(start, end);
  assert.ok(body.includes(' for ' + command + ' to authenticated using ('), table + ' policy must be authenticated ' + command.toUpperCase() + ' only');
  assert.equal(occurrences(body, 'creator_user_id = (select auth.uid())'), command === 'update' ? 2 : 1,
    table + ' must bind policy access to the authenticated creator');
  assert.equal(occurrences(body, 'public.is_institution_staff(institution_id)'), command === 'update' ? 2 : 1,
    table + ' must verify institution authorization in each applicable policy clause');
  if (command === 'update') {
    assert.ok(body.includes(' with check ('), table + ' UPDATE policy must define WITH CHECK');
    assert.ok(body.includes('institution_id is not null'), table + ' UPDATE WITH CHECK must reject unscoped content');
  }
}
assert.doesNotMatch(compact, /to public|to anon/, 'Policies must not grant anonymous/public access');
assert.doesNotMatch(compact, /alter table|delete from|truncate|update public\./, 'Migration must not mutate school records or table-level grants');

console.log('Teacher content RLS migration contract PASS: creator + current institution authorization required for UPDATE and DELETE; no production data mutation statements.');
