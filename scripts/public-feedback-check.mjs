import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const read = name => fs.readFileSync(name, 'utf8');
const home = read('index.html');
const privacy = read('privacy.html');
const logic = read('public-feedback.js');
const css = read('public-feedback.css');
const sql = read('supabase/migrations/20261010080000_private_product_feedback.sql');
assert.match(home, /id="edu-public-feedback-form"/);
for (const id of ['edu-feedback-category','edu-feedback-rating','edu-feedback-message','edu-feedback-submit','edu-feedback-status']) {
  assert.match(home, new RegExp('id="' + id + '"'));
}
for (const topic of ['bug','missing_data','suggestion','appreciation']) assert.match(home, new RegExp('value="' + topic + '"'));
assert.match(home, /public-feedback\.js\?v=20261010-feedback-v1/);
assert.match(home, /public-feedback\.css\?v=20261010-feedback-v1/);
assert.match(home, /cloud-config\.js\?v=20261010-feedback-v1/);
assert.match(logic, /await fetch\(endpoint/);
assert.match(logic, /if \(!response\.ok\) throw/);
assert.match(logic, /credentials: 'omit'/);
assert.match(logic, /'Prefer': 'return=minimal'/);
assert.match(logic, /if \(sending \|\| !form\.reportValidity\(\)\) return/);
assert.match(css, /@media\(max-width:520px\)/);
assert.match(sql, /enable row level security/i);
assert.match(sql, /grant insert \(category, rating, message\)/i);
assert.doesNotMatch(sql, /grant\s+select\s+on\s+(?:table\s+)?public\.platform_feedback\s+to\s+anon/i);
assert.match(privacy, /Public product feedback/);
execFileSync(process.execPath, ['--check','public-feedback.js'], {stdio:'pipe'});
console.log('Public feedback form, private Supabase contract, mobile CSS and JS syntax validated.');
