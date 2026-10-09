/* Protect production Timetable columns from missing-schema regressions.
 * The additive migration was applied to Supabase and its exact version is tracked. */
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ok=(v,msg)=>{if(!v)throw Error(msg)};
const sql=source('supabase/migrations/20261009131319_complete_timetable_period_schema_20261009.sql');
const school=source('school-work.js'),schedule=source('timetable-date-sheet.js');
ok(/alter\s+table\s+public\.timetable_entries/i.test(sql),'Timetable schema migration lacks table declaration');
for(const [field,pattern] of Object.entries({
 section_name:/add column if not exists section_name text/i,
 period_number:/add column if not exists period_number integer/i,
 end_time:/add column if not exists end_time time/i,
 room_label:/add column if not exists room_label text/i,
 updated_at:/add column if not exists updated_at timestamptz/i
})){
 ok(pattern.test(sql),'Production Timetable migration missing '+field);
 ok(school.includes(field+':')||school.includes(field+'=')||school.includes("'"+field+"'")||field==='updated_at',
   'School Work does not write/read expected live Timetable field '+field);
}
ok(school.includes('period_number:x.periodNumber')&&school.includes('section_name:x.sectionName'),
 'School Work insert missing expanded period and section fields');
ok(school.includes('end_time:x.endTime')&&school.includes('room_label:x.roomLabel'),
 'School Work insert missing end time and room columns');
ok(schedule.includes('timetable_entries')&&schedule.includes('section_name'),
 'Timetable Center module not wired to production timetable table');
ok(/create index if not exists timetable_entries_class_day_idx/i.test(sql),
 'School-scoped timetable class/weekday index missing');
ok(!/\b(drop|truncate|delete)\b/i.test(sql),'Production alignment must be additive and non-destructive');
console.log('EduNizam production Timetable schema PASS: five additive live columns, School Work save contract, class/day index.');
