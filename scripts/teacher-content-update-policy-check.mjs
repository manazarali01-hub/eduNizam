/* Static contract checks for the teacher content UPDATE RLS migration.
 * This validates the migration text only; it does not apply SQL or replace live RLS tests.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

const migration = readFileSync(new URL('../supabase/migrations/20261016110000_scope_teacher_content_updates.sql', import.meta.url), 'utf8');
const compact = migration.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').toLowerCase();

assert.match(compact, /^\s*begin;/, 'Migration must start a transaction');
assert.match(compact, /commit;\s*$/, 'Migration must commit its transaction');
assert.equal((compact.match(/create policy /g) || []).length, 2, 'Expected exactly two replacement UPDATE policies');
assert.equal((compact.match(/drop policy if exists /g) || []).length, 2, 'Expected to replace only the two named creator UPDATE policies');

for (const [policy, table] of [
  ['question creator updates', 'teacher_question_bank'],
  ['paper creator updates', 'teacher_papers']
]) {
  const escaped = policy;
  const re = new RegExp('create policy "' + escaped + '" on public\\\\.' + table + ' for update to authenticated([\\\\s\\\\S]*?);');
  const match = compact.match(re);
  assert.ok(match, 'Missing authenticated UPDATE policy for ' + table);
  const body = match[1];
  assert.match(body, /using \\(/, table + ' policy must define USING');
  assert.match(body, /with check \\(/, table + ' policy must define WITH CHECK');
  assert.equal((body.match(/creator_user_id = \\(select auth\\.uid\\(\\)\\)/g) || []).length, 2,
    table + ' must bind both USING and WITH CHECK to the authenticated creator');
  assert.equal((body.match(/public\\.is_institution_staff\\(institution_id\\)/g) || []).length, 2,
    table + ' must verify institution authorization in both USING and WITH CHECK');
  assert.match(body, /institution_id is not null/, table + ' WITH CHECK must reject unscoped content');
}
assert.doesNotMatch(compact, /to public|to anon/, 'UPDATE policies must not grant anonymous/public access');
assert.doesNotMatch(compact, /alter table|delete from|truncate|update public\./, 'Migration must not mutate school records or table-level grants');

console.log('Teacher content UPDATE policy migration contract PASS: creator + current institution authorization required for both USING and WITH CHECK; no production data mutation statements.');
