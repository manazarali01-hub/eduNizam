/* One scoped list -> one reliable class/section student dropdown.
 * Uses institution and role-filtered rows supplied by each module.
 * Does not authorize users; server RLS remains the boundary. */
(function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
 const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
 function eligible(rows){
   if(!Array.isArray(rows))return[];
   const seen=new Set();
   return rows.filter(s=>{
     if(!s||s.id===undefined||s.id===null||!norm(s.name))return false;
     const id=String(s.id);
     if(seen.has(id))return false;
     seen.add(id);return true;
   });
 }
 const has=(rows,id)=>!!String(id??'').trim()&&eligible(rows).some(s=>String(s.id)===String(id));
 function options(rows,placeholder='Select student'){
   const group=new Map();
   for(const s of eligible(rows)){
     const cls=norm(s.className)||'Unassigned class',sec=norm(s.sectionName)||'No section';
     const label=cls+' · '+sec;
     if(!group.has(label))group.set(label,[]);
     group.get(label).push(s);
   }
   const sorted=[...group.entries()].sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
   return '<option value="">'+esc(placeholder)+'</option>'+sorted.map(([label,students])=>
     '<optgroup label="'+esc(label)+'">'+students.sort((a,b)=>norm(a.name).localeCompare(norm(b.name),undefined,{numeric:true})).map(s=>
     '<option value="'+esc(s.id)+'">'+esc(s.name)+(s.studentId?' · '+esc(s.studentId):'')+'</option>').join('')+'</optgroup>').join('');
 }
 window.EDUNIZAM_STUDENT_PICKER={eligible,has,options};
})();