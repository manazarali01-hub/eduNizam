/* Institution form options, using actual school class records, not invented enrollment.
 * Reference subjects are suggestions, NOT textbook/subject allocation certification. */
(function(){
 'use strict';
 const norm=value=>String(value??'').trim().replace(/\s+/g,' ');
 const grade=value=>{const m=norm(value).match(/^(?:(?:class|grade)\s*)?(1[0-2]|[1-9])$/i);return m?Number(m[1]):0};
 function classes(rows){
  const seen=new Set(),values=[];
  for(const row of Array.isArray(rows)?rows:[]){
   if(row?.active===false)continue;
   const name=norm(row?.class_name??row?.className??row?.name);
   if(!name||seen.has(name.toLowerCase()))continue;
   seen.add(name.toLowerCase());values.push(name);
  }
  return values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
 }
 function subjects(classNames,referenceSubjects,staffSubjects=[]){
  const seen=new Set(),values=[];
  const add=x=>{const value=norm(x);if(value&&!seen.has(value.toLowerCase())){seen.add(value.toLowerCase());values.push(value)}};
  for(const c of Array.isArray(classNames)?classNames:[]){
   const g=grade(c);
   if(g>0)(referenceSubjects?.[g]||referenceSubjects?.[String(g)]||[]).forEach(add);
  }
  (Array.isArray(staffSubjects)?staffSubjects:[]).forEach(add);
  return values.sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));
 }
 function append(current,item){
  const parts=String(current||'').split(',').map(norm).filter(Boolean),
        value=norm(item);
  if(value&&!parts.some(x=>x.toLowerCase()===value.toLowerCase()))parts.push(value);
  return parts.join(', ');
 }
 window.EDUNIZAM_SCHOOL_FORM_OPTIONS={classes,subjects,append,grade};
})();