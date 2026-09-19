(function(){
  const BOOK_KEY='edunizam_library_books_v1';
  const LOAN_KEY='edunizam_library_loans_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  const isStaff=()=>['head','teacher'].includes(role());
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const plusDays=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  function read(k){try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}}
  function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
  function students(){try{return JSON.parse(localStorage.getItem('edunizam_students')||'[]')}catch{return[]}}
  function visibleStudents(){return window.EDUNIZAM_ROLE_SCOPE?.getVisibleStudents?.(students())||students()}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function isOverdue(x){return !x.returnedAt&&x.dueDate&&x.dueDate<today()}
  function activeLoans(){return read(LOAN_KEY).filter(x=>!x.returnedAt)}
  function availableCopies(book){
    const used=activeLoans().filter(x=>String(x.bookId)===String(book.id)).length;
    return Math.max(0,Number(book.totalCopies||0)-used);
  }
  function visibleLoans(rows){
    if(isStaff())return rows;
    const ids=new Set(visibleStudents().map(s=>String(s.id)));
    return rows.filter(x=>ids.has(String(x.studentId)));
  }
  async function cloudStudent(localId){
    if(!cloudReady())return null;
    const s=students().find(x=>String(x.id)===String(localId));if(!s)return null;
    let q=cloud().state.client.from('core_students').select('id,local_id,name,class_name,section_name,student_code,auth_user_id')
      .eq('institution_id',cfg().institutionId);
    if(s.studentId)q=q.eq('student_code',s.studentId);else q=q.eq('local_id',Number(s.id));
    const {data,error}=await q.maybeSingle();if(error)throw error;return data||null;
  }
  function mapBook(x){
    return {id:x.id,accessionNo:x.accession_no,title:x.title,author:x.author||'',isbn:x.isbn||'',category:x.category||'General',publisher:x.publisher||'',shelf:x.shelf_location||'',totalCopies:Number(x.total_copies||0),active:x.active!==false,createdAt:x.created_at};
  }
  function mapLoan(x){
    const s=x.core_students||{},b=x.library_books||{};
    return {id:x.id,bookId:x.book_id,studentId:String(s.local_id??x.student_id),studentCloudId:x.student_id,studentName:s.name||'Student',className:s.class_name||'',sectionName:s.section_name||'',bookTitle:b.title||'Book',accessionNo:b.accession_no||'',issuedAt:x.issued_at,dueDate:x.due_date,returnedAt:x.returned_at||'',status:x.returned_at?'Returned':'Issued',notes:x.notes||''};
  }
  async function pullCloud(){
    if(!cloudReady())return;
    const c=cloud().state.client,id=cfg().institutionId;
    const [br,lr]=await Promise.all([
      c.from('library_books').select('*').eq('institution_id',id).order('title'),
      c.from('library_loans').select('*,core_students(local_id,name,class_name,section_name,auth_user_id),library_books(title,accession_no)').eq('institution_id',id).order('issued_at',{ascending:false})
    ]);
    if(br.error)throw br.error;if(lr.error)throw lr.error;
    write(BOOK_KEY,(br.data||[]).map(mapBook));write(LOAN_KEY,(lr.data||[]).map(mapLoan));
  }
  async function saveBookCloud(item){
    if(!cloudReady())return null;
    const payload={institution_id:cfg().institutionId,accession_no:item.accessionNo,title:item.title,author:item.author||null,isbn:item.isbn||null,category:item.category||'General',publisher:item.publisher||null,shelf_location:item.shelf||null,total_copies:item.totalCopies,active:item.active!==false,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()};
    const {data,error}=await cloud().state.client.from('library_books').upsert(payload,{onConflict:'institution_id,accession_no'}).select().single();
    if(error)throw error;return mapBook(data);
  }
  async function deleteBookCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('library_books').delete().eq('id',id);if(error)throw error;
  }
  async function issueCloud(bookId,studentLocalId,dueDate){
    const cs=await cloudStudent(studentLocalId);if(!cs)throw new Error('Student cloud record not found.');
    const {data,error}=await cloud().state.client.rpc('issue_library_book',{p_book_id:bookId,p_student_id:cs.id,p_due_date:dueDate});
    if(error)throw error;return data;
  }
  async function returnCloud(loanId){
    const {data,error}=await cloud().state.client.rpc('return_library_book',{p_loan_id:loanId});
    if(error)throw error;return data;
  }
  function catalogEditor(edit=null){
    if(!isHead())return '';
    return '<article class="card"><h3>'+(edit?'Edit Book':'Add Book to Catalog')+'</h3><div class="form-grid">'+
      '<input id="libEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="libAccession" placeholder="Accession no. e.g. LIB-001" value="'+esc(edit?.accessionNo||'')+'">'+
      '<input id="libTitle" placeholder="Book title" value="'+esc(edit?.title||'')+'">'+
      '<input id="libAuthor" placeholder="Author" value="'+esc(edit?.author||'')+'">'+
      '<input id="libISBN" placeholder="ISBN (optional)" value="'+esc(edit?.isbn||'')+'">'+
      '<input id="libCategory" placeholder="Category e.g. Science" value="'+esc(edit?.category||'General')+'">'+
      '<input id="libPublisher" placeholder="Publisher (optional)" value="'+esc(edit?.publisher||'')+'">'+
      '<input id="libShelf" placeholder="Shelf / rack" value="'+esc(edit?.shelf||'')+'">'+
      '<input id="libCopies" type="number" min="1" value="'+esc(edit?.totalCopies??1)+'" placeholder="Total copies">'+
      '<select id="libActive"><option value="true" '+(edit?.active===false?'':'selected')+'>Active</option><option value="false" '+(edit?.active===false?'selected':'')+'>Inactive</option></select>'+
      '<button id="libSaveBook">'+(edit?'Update Book':'Save Book')+'</button>'+(edit?'<button id="libCancelBook" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function circulationEditor(books){
    if(!isStaff())return '<div class="coverage-note">Aap catalog aur apne linked student loans dekh sakte hain.</div>';
    const eligible=visibleStudents();
    return '<article class="card" style="margin-top:16px"><h3>Issue Book</h3><div class="form-grid">'+
      '<select id="libIssueBook"><option value="">Select available book</option>'+books.filter(b=>b.active!==false&&availableCopies(b)>0).map(b=>'<option value="'+esc(b.id)+'">'+esc(b.title)+' · '+esc(b.accessionNo)+' · '+availableCopies(b)+' available</option>').join('')+'</select>'+
      '<select id="libIssueStudent"><option value="">Select student</option>'+eligible.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.name)+' · '+esc((s.className||'-')+(s.sectionName?' - '+s.sectionName:''))+'</option>').join('')+'</select>'+
      '<input id="libDueDate" type="date" value="'+plusDays(14)+'">'+
      '<button id="libIssueBtn">Issue Book</button></div></article>';
  }
  function metrics(books,loans){
    const active=books.filter(x=>x.active!==false),copies=active.reduce((a,x)=>a+Number(x.totalCopies||0),0),issued=loans.filter(x=>!x.returnedAt).length,overdue=loans.filter(isOverdue).length;
    return '<div class="cards"><article class="card stat"><span>Titles</span><strong>'+active.length+'</strong></article><article class="card stat"><span>Total Copies</span><strong>'+copies+'</strong></article><article class="card stat"><span>Issued</span><strong>'+issued+'</strong></article><article class="card stat"><span>Available</span><strong>'+Math.max(0,copies-issued)+'</strong></article><article class="card stat"><span>Overdue</span><strong>'+overdue+'</strong></article></div>';
  }
  function bookCard(b){
    const avail=availableCopies(b);
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(b.accessionNo)+'</span><span class="badge">'+(b.active===false?'Inactive':avail>0?avail+' available':'All issued')+'</span></div><h3>'+esc(b.title)+'</h3><p class="muted">'+esc(b.author||'Unknown author')+' · '+esc(b.category||'General')+'</p><p><strong>Copies:</strong> '+Number(b.totalCopies||0)+' · <strong>Shelf:</strong> '+esc(b.shelf||'-')+'</p>'+(b.isbn?'<p class="muted">ISBN '+esc(b.isbn)+'</p>':'')+(isHead()?'<div class="paper-actions"><button data-lib-edit="'+esc(b.id)+'">Edit</button><button class="secondary" data-lib-delete="'+esc(b.id)+'">Delete</button></div>':'')+'</article>';
  }
  function loanRows(loans){
    if(!loans.length)return '<div class="muted">No library loans.</div>';
    return loans.map(x=>'<div class="row"><strong>'+esc(x.studentName)+'</strong><span>'+esc(x.bookTitle)+'</span><span>'+esc(x.dueDate)+'</span><span class="badge">'+(x.returnedAt?'Returned':isOverdue(x)?'Overdue':'Issued')+'</span>'+(isStaff()&&!x.returnedAt?'<button data-lib-return="'+esc(x.id)+'">Return</button>':'<span></span>')+'</div>').join('');
  }
  async function saveBook(){
    const id=$('libEditId')?.value||'',accessionNo=$('libAccession')?.value.trim(),title=$('libTitle')?.value.trim(),totalCopies=Number($('libCopies')?.value||0);
    if(!accessionNo||!title||totalCopies<1)return alert('Accession no., title aur copies required hain.');
    const rows=read(BOOK_KEY),dupe=rows.find(x=>x.accessionNo.toLowerCase()===accessionNo.toLowerCase()&&String(x.id)!==String(id));if(dupe)return alert('Accession number already exists.');
    const activeCount=read(LOAN_KEY).filter(x=>String(x.bookId)===String(id)&&!x.returnedAt).length;
    if(id&&totalCopies<activeCount)return alert('Total copies active issued copies se kam nahi ho sakti.');
    let item={id:id||String(Date.now()),accessionNo,title,author:$('libAuthor')?.value.trim()||'',isbn:$('libISBN')?.value.trim()||'',category:$('libCategory')?.value.trim()||'General',publisher:$('libPublisher')?.value.trim()||'',shelf:$('libShelf')?.value.trim()||'',totalCopies,active:$('libActive')?.value==='true',createdAt:new Date().toISOString()};
    try{const c=await saveBookCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud book save failed: '+(e.message||e))}
    const next=rows.filter(x=>String(x.id)!==String(id)&&x.accessionNo.toLowerCase()!==accessionNo.toLowerCase());next.push(item);write(BOOK_KEY,next);render();
  }
  async function editBook(id){
    const b=read(BOOK_KEY).find(x=>String(x.id)===String(id));if(!b||!isHead())return;
    const box=$('libCatalogEditor');if(box)box.innerHTML=catalogEditor(b);bindEditors();
  }
  async function deleteBook(id){
    if(!isHead())return;
    if(read(LOAN_KEY).some(x=>String(x.bookId)===String(id)))return alert('Book ki loan history maujood hai; delete ke bajaye Inactive karein.');
    if(!confirm('Delete this catalog book?'))return;
    try{await deleteBookCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(BOOK_KEY,read(BOOK_KEY).filter(x=>String(x.id)!==String(id)));render();
  }
  async function issue(){
    const bookId=$('libIssueBook')?.value,studentId=$('libIssueStudent')?.value,dueDate=$('libDueDate')?.value;
    if(!bookId||!studentId||!dueDate)return alert('Book, student aur due date select karein.');
    if(dueDate<today())return alert('Due date aaj ya future ki honi chahiye.');
    const books=read(BOOK_KEY),book=books.find(x=>String(x.id)===String(bookId)),student=students().find(x=>String(x.id)===String(studentId));if(!book||!student)return;
    if(availableCopies(book)<1)return alert('Is book ki koi copy available nahi.');
    if(read(LOAN_KEY).some(x=>String(x.bookId)===String(bookId)&&String(x.studentId)===String(studentId)&&!x.returnedAt))return alert('Ye book is student ko already issued hai.');
    let loan={id:String(Date.now()),bookId:book.id,studentId:String(student.id),studentName:student.name,className:student.className||'',sectionName:student.sectionName||'',bookTitle:book.title,accessionNo:book.accessionNo,issuedAt:today(),dueDate,returnedAt:'',status:'Issued',notes:''};
    try{
      const c=await issueCloud(bookId,studentId,dueDate);
      if(c){await pullCloud();render();return}
    }catch(e){if(cloudReady())return alert('Cloud issue failed: '+(e.message||e))}
    const loans=read(LOAN_KEY);loans.unshift(loan);write(LOAN_KEY,loans);render();
  }
  async function returnBook(id){
    const loans=read(LOAN_KEY),loan=loans.find(x=>String(x.id)===String(id));if(!loan||!isStaff())return;
    if(!confirm('Mark '+loan.bookTitle+' as returned?'))return;
    try{const c=await returnCloud(id);if(c){await pullCloud();render();return}}catch(e){if(cloudReady())return alert('Cloud return failed: '+(e.message||e))}
    loan.returnedAt=today();loan.status='Returned';write(LOAN_KEY,loans);render();
  }
  function printRegister(books,loans){
    const st=settings(),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    const active=loans.filter(x=>!x.returnedAt);
    w.document.write('<!doctype html><html><head><title>Library Register</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}.meta{display:flex;justify-content:space-between;margin:20px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd6dc;padding:7px;text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Library Issue Register</h3></div><div class="meta"><strong>Titles: '+books.filter(x=>x.active!==false).length+'</strong><strong>Active Loans: '+active.length+'</strong></div><table><thead><tr><th>Student</th><th>Class</th><th>Book</th><th>Accession</th><th>Issued</th><th>Due</th><th>Status</th></tr></thead><tbody>'+visibleLoans(loans).map(x=>'<tr><td>'+esc(x.studentName)+'</td><td>'+esc((x.className||'-')+(x.sectionName?' - '+x.sectionName:''))+'</td><td>'+esc(x.bookTitle)+'</td><td>'+esc(x.accessionNo)+'</td><td>'+esc(x.issuedAt)+'</td><td>'+esc(x.dueDate)+'</td><td>'+(x.returnedAt?'Returned':isOverdue(x)?'Overdue':'Issued')+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bindEditors(){
    $('libSaveBook')?.addEventListener('click',saveBook);$('libCancelBook')?.addEventListener('click',render);
  }
  function bind(books,loans){
    bindEditors();$('libIssueBtn')?.addEventListener('click',issue);$('libPrint')?.addEventListener('click',()=>printRegister(books,loans));
    $('libSearch')?.addEventListener('input',render);
    document.querySelectorAll('[data-lib-edit]').forEach(b=>b.onclick=()=>editBook(b.dataset.libEdit));
    document.querySelectorAll('[data-lib-delete]').forEach(b=>b.onclick=()=>deleteBook(b.dataset.libDelete));
    document.querySelectorAll('[data-lib-return]').forEach(b=>b.onclick=()=>returnBook(b.dataset.libReturn));
  }
  async function render(){
    const root=$('libraryCenterApp');if(!root)return;
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Library cloud sync:',e.message)}}
    const allBooks=read(BOOK_KEY).sort((a,b)=>String(a.title).localeCompare(String(b.title))),allLoans=read(LOAN_KEY);
    const query=($('libSearch')?.value||root.dataset.query||'').trim().toLowerCase();root.dataset.query=query;
    const books=allBooks.filter(b=>!query||[b.title,b.author,b.accessionNo,b.category,b.isbn].some(v=>String(v||'').toLowerCase().includes(query)));
    const loans=visibleLoans(allLoans).sort((a,b)=>String(b.issuedAt).localeCompare(String(a.issuedAt)));
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><div class="quick-actions"><input id="libSearch" placeholder="Search title, author, accession..." value="'+esc(query)+'"><button id="libPrint" class="secondary">Print Loan Register</button></div></div>'+
      metrics(allBooks,allLoans)+'<div id="libCatalogEditor" style="margin-top:16px">'+catalogEditor()+'</div>'+circulationEditor(allBooks)+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Loans & Returns</h3><p class="muted">Issued, overdue and returned books.</p></div></div><div class="list">'+loanRows(loans)+'</div></article>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Book Catalog</h3><p class="muted">Physical library catalog and copy availability.</p></div></div><div class="paper-grid">'+(books.length?books.map(bookCard).join(''):'<div class="empty-state">No matching books.</div>')+'</div>';
    bind(allBooks,allLoans);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('libraryCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_LIBRARY_CENTER={render,pullCloud,cloudReady};
})();