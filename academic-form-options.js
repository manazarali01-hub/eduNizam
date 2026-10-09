/* Pure school academic dropdown helpers.
 * Only saved syllabus units can be labeled school records. Catalog topics
 * remain explicitly unverified conceptual suggestions, not book chapters. */
(function(){
 'use strict';
 const clean=x=>String(x??'').trim().replace(/\s+/g,' ');
 const key=x=>clean(x).normalize('NFKC').toLowerCase();
 function grade(v){const m=clean(v).match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/i);return m?Number(m[1]):0}
 // A saved school unit may use "Grade 5", "Class 5" or "5" while
 // the registered class picker uses another form. Treat only whole-grade
 // aliases as equivalent; never merge arbitrary class/section names.
 function sameClass(a,b){
  const x=clean(a),y=clean(b);
  if(!x||!y)return false;
  const gx=grade(x),gy=grade(y);
  return gx>0&&gy>0?gx===gy:key(x)===key(y);
 }
 function distinct(items){
  const seen=new Set(),out=[];
  for(const x of items||[]){const v=clean(x),k=key(v);if(v&&!seen.has(k)){seen.add(k);out.push(v)}}
  return out;
 }
 function registeredSections(rows){
  const found=new Map();
  for(const r of Array.isArray(rows)?rows:[]){
   if(r?.active===false)continue;
   const cls=clean(r?.className??r?.class_name),sec=clean(r?.sectionName??r?.section_name);
   if(!cls)continue;
   const k=key(cls)+'|'+key(sec);
   if(!found.has(k))found.set(k,{className:cls,sectionName:sec});
  }
  return [...found.values()].sort((a,b)=>a.className.localeCompare(b.className,undefined,{numeric:true})||a.sectionName.localeCompare(b.sectionName));
 }
 function subjects(cls,catalog={},units=[]){
  const g=grade(cls);
  return distinct([...(catalog?.subjects?.[g]||[]),...(units||[]).filter(x=>sameClass(x.className??x.class_name,cls)).map(x=>x.subject)]);
 }
 function chapters(cls,subject,catalog={},units=[]){
  const g=grade(cls);
  const matching=(units||[]).filter(x=>sameClass(x.className??x.class_name,cls)&&key(x.subject)===key(subject));
  const saved=distinct(matching.map(x=>x.unitTitle??x.unit_title));
  const concepts=distinct((catalog?.chapters?.[g+'|'+subject]||[]).filter(x=>!saved.some(v=>key(v)===key(x))));
  return {saved,concepts};
 }
 function sections(cls,rows){return distinct(registeredSections(rows).filter(x=>sameClass(x.className,cls)).map(x=>x.sectionName))}
 function classIsKnown(cls,rows){return registeredSections(rows).some(x=>key(x.className)===key(cls))}
 function sectionMatches(cls,sec,rows){
  const v=clean(sec);
  return !v||registeredSections(rows).some(x=>sameClass(x.className,cls)&&key(x.sectionName)===key(v));
 }
 window.EDUNIZAM_ACADEMIC_FORM_OPTIONS={grade,sameClass,distinct,registeredSections,subjects,chapters,sections,classIsKnown,sectionMatches};
})();