import fs from 'node:fs';
import path from 'node:path';

// Prevent reintroducing unverified or watermarked imagery into public EduNizam.
// Inspect app source (not archived docs, node_modules, CI scripts or Git history).
const root=process.cwd();
const allowed=new Set(['36159720','5833','5088012','28503364','30744638','36728536','5607884','35821614','33252555']);
const banned=/assets\/edunizam-(?:login-children|girl-hero)\.webp|images\.unsplash\.com|(?:istockphoto|shutterstock|gettyimages|stock\.adobe|depositphotos)\.(?:com|net)/ig;
const errors=[];let filesChecked=0,photosChecked=0;
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.git','node_modules','.github','scripts','docs','dist','coverage','test-results'].includes(entry.name))continue;
  const rel=path.relative(root,path.join(dir,entry.name)).replaceAll('\\','/');
  if(entry.isDirectory()){if(!rel.startsWith('assets/icons'))walk(path.join(dir,entry.name));continue;}
  if(!/\.(?:html|css|js|mjs)$/i.test(entry.name))continue;
  ++filesChecked;
  const s=fs.readFileSync(path.join(dir,entry.name),'utf8');
  for(const m of s.matchAll(banned))errors.push(rel+': rejected unverified/stock image reference '+m[0]);
  for(const m of s.matchAll(/https?:\/\/images\.pexels\.com\/photos\/(\d+)\/pexels-photo-(\d+)\.jpe?g/g)){
    ++photosChecked;
    if(m[1]!==m[2]||!allowed.has(m[1]))errors.push(rel+': Pexels image has not been licensed/documented: '+m[0]);
  }
  const candidates=[...s.matchAll(/https?:\/\/images\.pexels\.com\/photos\/\d+/g)];
  if(candidates.length && candidates.length!==[...s.matchAll(/https?:\/\/images\.pexels\.com\/photos\/\d+\/pexels-photo-\d+\.jpe?g/g)].length)
    errors.push(rel+': malformed/unreviewed Pexels image URL');
 }
}
walk(root);
const register=fs.readFileSync(path.join(root,'docs/ASSET_PROVENANCE.md'),'utf8');
for(const id of allowed)if(!register.includes('https://www.pexels.com/photo/')||!new RegExp('\\b'+id+'\\b').test(register))errors.push('Missing licensed source in asset register: '+id);
for(const p of ['assets/edunizam-login-children.webp','assets/edunizam-girl-hero.webp']){
 if(fs.existsSync(path.join(root,p)))errors.push('Unverified hero image must not be included in repository: '+p);
}
if(!fs.existsSync(path.join(root,'scripts/build-clay-icons.py')))errors.push('No licensed clay icon build source');
console.log('Media rights guard:',filesChecked,'source files and',photosChecked,'Pexels image references checked,',errors.length,'issues');
for(const e of errors)console.error('MEDIA RIGHTS FAIL:',e);
if(errors.length)process.exit(1);
