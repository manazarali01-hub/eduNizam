(function(){
  const KEY='edunizam_inventory_assets_v1';
  const MOVE_KEY='edunizam_inventory_movements_v1';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const session=()=>{try{return JSON.parse(localStorage.getItem('edunizam_session')||'null')}catch{return null}};
  const role=()=>session()?.role||'student';
  const cfg=()=>window.EDUNIZAM_CLOUD_CONFIG||{};
  const cloud=()=>window.EDUNIZAM_CLOUD;
  const cloudReady=()=>!!(cfg().enabled&&cfg().institutionId&&cloud()?.state?.client&&cloud()?.state?.user);
  const isHead=()=>role()==='head';
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
  function write(v){localStorage.setItem(KEY,JSON.stringify(v))}
  function staff(){try{return JSON.parse(localStorage.getItem('edunizam_staff_profiles_v1')||'[]')}catch{return[]}}
  function settings(){try{return JSON.parse(localStorage.getItem('edunizam_settings')||'{}')}catch{return{}}}
  function money(v){return 'Rs '+Number(v||0).toLocaleString('en-PK')}
  function activeStaff(){return staff().filter(x=>x.status!=='inactive')}
  function movements(){try{return JSON.parse(localStorage.getItem(MOVE_KEY)||'[]')}catch{return[]}}
  function writeMovements(v){localStorage.setItem(MOVE_KEY,JSON.stringify(v.slice(0,500)))}
  function mapMovement(x){return {id:x.id,itemId:x.item_id,type:x.movement_type,delta:Number(x.quantity_delta||0),before:Number(x.before_quantity||0),after:Number(x.after_quantity||0),note:x.note||'',createdAt:x.created_at}}
  function assignedName(x){
    if(x.assignedStaffName)return x.assignedStaffName;
    return staff().find(s=>String(s.id)===String(x.assignedStaffId))?.fullName||'';
  }
  function lowStock(x){return x.itemType==='Stock Item'&&Number(x.quantity||0)<=Number(x.reorderLevel||0)}
  function totalValue(x){return Number(x.quantity||0)*Number(x.unitCost||0)}
  function toLocal(x){
    return {
      id:x.id,itemCode:x.item_code,itemName:x.item_name,itemType:x.item_type,category:x.category||'Other',
      quantity:Number(x.quantity||0),reorderLevel:Number(x.reorder_level||0),unitCost:Number(x.unit_cost||0),
      condition:x.condition||'Good',location:x.location||'',purchaseDate:x.purchase_date||'',
      assignedStaffId:x.assigned_staff_profile_id||'',assignedStaffName:x.staff_profiles?.full_name||'',
      notes:x.notes||'',active:x.active!==false,createdAt:x.created_at
    };
  }
  async function pullCloud(){
    if(!cloudReady())return read();
    const c=cloud().state.client,id=cfg().institutionId;
    const [items,moves]=await Promise.all([
      c.from('school_inventory_items').select('*,staff_profiles(full_name,staff_code)').eq('institution_id',id).order('item_name'),
      c.from('school_inventory_movements').select('*').eq('institution_id',id).order('created_at',{ascending:false}).limit(200)
    ]);
    if(items.error)throw items.error;
    if(!moves.error)writeMovements((moves.data||[]).map(mapMovement));
    const rows=(items.data||[]).map(toLocal);write(rows);return rows;
  }
  async function adjustStockCloud(id,delta,note){
    const {data,error}=await cloud().state.client.rpc('adjust_inventory_stock',{p_item_id:id,p_quantity_delta:delta,p_note:note||null});
    if(error)throw error;return data;
  }
  async function saveCloud(item){
    if(!cloudReady())return null;
    const payload={
      institution_id:cfg().institutionId,item_code:item.itemCode,item_name:item.itemName,item_type:item.itemType,
      category:item.category,quantity:item.itemType==='Asset'?Math.max(1,Number(item.quantity||1)):Math.max(0,Number(item.quantity||0)),
      reorder_level:item.itemType==='Stock Item'?Math.max(0,Number(item.reorderLevel||0)):0,
      unit_cost:Math.max(0,Number(item.unitCost||0)),condition:item.itemType==='Asset'?item.condition:'Good',
      location:item.location||null,purchase_date:item.purchaseDate||null,
      assigned_staff_profile_id:item.itemType==='Asset'?(item.assignedStaffId||null):null,
      notes:item.notes||null,active:item.active!==false,updated_by:cloud().state.user.id,updated_at:new Date().toISOString()
    };
    const {data,error}=await cloud().state.client.from('school_inventory_items')
      .upsert(payload,{onConflict:'institution_id,item_code'})
      .select('*,staff_profiles(full_name,staff_code)').single();
    if(error)throw error;return toLocal(data);
  }
  async function deleteCloud(id){
    if(!cloudReady())return;
    const {error}=await cloud().state.client.from('school_inventory_items').delete().eq('id',id);
    if(error)throw error;
  }
  function editor(edit=null){
    if(!isHead())return '<div class="coverage-note">Inventory read-only view. Changes Head of Institute manage karta hai.</div>';
    return '<article class="card"><h3>'+(edit?'Edit Inventory Item':'Add Inventory Item')+'</h3><div class="form-grid">'+
      '<input id="invEditId" type="hidden" value="'+esc(edit?.id||'')+'">'+
      '<input id="invCode" placeholder="Item code e.g. PC-001" value="'+esc(edit?.itemCode||'')+'">'+
      '<input id="invName" placeholder="Item name" value="'+esc(edit?.itemName||'')+'">'+
      '<select id="invType"><option '+(edit?.itemType==='Asset'?'selected':'')+'>Asset</option><option '+(edit?.itemType==='Stock Item'?'selected':'')+'>Stock Item</option></select>'+
      '<select id="invCategory">'+['Furniture','Computer / IT','Lab Equipment','Books','Stationery','Sports','Electrical','Cleaning','Other'].map(x=>'<option '+(edit?.category===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<input id="invQty" type="number" min="0" value="'+esc(edit?.quantity??1)+'" placeholder="Quantity">'+
      '<input id="invReorder" type="number" min="0" value="'+esc(edit?.reorderLevel??0)+'" placeholder="Reorder level">'+
      '<input id="invUnitCost" type="number" min="0" step="0.01" value="'+esc(edit?.unitCost??0)+'" placeholder="Unit cost">'+
      '<select id="invCondition">'+['Good','Needs Repair','Damaged','Retired'].map(x=>'<option '+(edit?.condition===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
      '<input id="invLocation" placeholder="Room / location" value="'+esc(edit?.location||'')+'">'+
      '<input id="invPurchaseDate" type="date" value="'+esc(edit?.purchaseDate||'')+'">'+
      '<select id="invAssignedStaff"><option value="">Not assigned</option>'+activeStaff().map(s=>'<option value="'+esc(s.id)+'" '+(String(edit?.assignedStaffId||'')===String(s.id)?'selected':'')+'>'+esc(s.fullName)+' · '+esc(s.staffCode||'')+'</option>').join('')+'</select>'+
      '<input id="invNotes" placeholder="Notes / serial / vendor (optional)" value="'+esc(edit?.notes||'')+'">'+
      '<select id="invActive"><option value="true" '+(edit?.active===false?'':'selected')+'>Active</option><option value="false" '+(edit?.active===false?'selected':'')+'>Inactive</option></select>'+
      '<button id="invSave">'+(edit?'Update Item':'Save Item')+'</button>'+(edit?'<button id="invCancel" class="secondary">Cancel</button>':'')+
      '</div></article>';
  }
  function metricCards(rows){
    const active=rows.filter(x=>x.active!==false),units=active.reduce((a,x)=>a+Number(x.quantity||0),0),low=active.filter(lowStock).length,issued=active.filter(x=>x.itemType==='Asset'&&x.assignedStaffId).length,value=active.reduce((a,x)=>a+totalValue(x),0);
    return '<div class="cards">'+
      '<article class="card stat"><span>Inventory Items</span><strong>'+active.length+'</strong></article>'+
      '<article class="card stat"><span>Total Units</span><strong>'+units+'</strong></article>'+
      '<article class="card stat"><span>Low Stock</span><strong>'+low+'</strong></article>'+
      '<article class="card stat"><span>Assets Issued</span><strong>'+issued+'</strong></article>'+
      '<article class="card stat"><span>Estimated Value</span><strong>'+money(value)+'</strong></article>'+
      '</div>';
  }
  function card(x){
    const alert=lowStock(x),assign=assignedName(x);
    const stockActions=isHead()&&x.itemType==='Stock Item'?'<button data-inv-stock-in="'+esc(x.id)+'">Stock In</button><button class="secondary" data-inv-stock-out="'+esc(x.id)+'">Stock Out</button>':'';
    return '<article class="paper-card"><div class="paper-card-top"><span class="mini-badge">'+esc(x.itemCode)+'</span><span class="badge">'+(x.active===false?'Inactive':alert?'Low Stock':esc(x.itemType))+'</span></div>'+
      '<h3>'+esc(x.itemName)+'</h3><p class="muted">'+esc(x.category)+(x.location?' · '+esc(x.location):'')+'</p>'+
      '<p><strong>Qty:</strong> '+Number(x.quantity||0)+(x.itemType==='Stock Item'?' · Reorder '+Number(x.reorderLevel||0):'')+'</p>'+
      '<p><strong>Condition:</strong> '+esc(x.condition||'Good')+' · <strong>Value:</strong> '+money(totalValue(x))+'</p>'+
      (assign?'<p><strong>Issued to:</strong> '+esc(assign)+'</p>':'')+
      (x.notes?'<p class="muted">'+esc(x.notes)+'</p>':'')+
      (isHead()?'<div class="paper-actions">'+stockActions+'<button data-inv-edit="'+esc(x.id)+'">Edit</button><button class="secondary" data-inv-delete="'+esc(x.id)+'">Delete</button></div>':'')+
      '</article>';
  }
  function lowStockList(rows){
    const lows=rows.filter(x=>x.active!==false&&lowStock(x)).sort((a,b)=>Number(a.quantity)-Number(b.quantity));
    return lows.length?lows.map(x=>'<div class="row"><strong>'+esc(x.itemName)+'</strong><span>'+esc(x.itemCode)+'</span><span>Qty '+Number(x.quantity||0)+'</span><span>Reorder '+Number(x.reorderLevel||0)+'</span><span></span></div>').join(''):'<div class="muted">No low-stock items.</div>';
  }
  function filterRows(rows,root){
    const type=root.dataset.invType||'',category=root.dataset.invCategory||'',status=root.dataset.invStatus||'',q=(root.dataset.invSearch||'').trim().toLowerCase();
    return rows.filter(x=>(!type||x.itemType===type)&&(!category||x.category===category)&&(!status||(status==='active'&&x.active!==false)||(status==='inactive'&&x.active===false)||(status==='low'&&lowStock(x)))&&(!q||[x.itemCode,x.itemName,x.category,x.location,x.condition,x.notes,assignedName(x)].join(' ').toLowerCase().includes(q)));
  }
  function movementRows(){
    const items=new Map(read().map(x=>[String(x.id),x]));
    const rows=movements().slice(0,50);
    return rows.length?rows.map(m=>{const item=items.get(String(m.itemId));return '<div class="row"><strong>'+esc(item?.itemName||'Stock Item')+'</strong><span>'+esc(m.type)+'</span><span>'+(m.delta>0?'+':'')+m.delta+' ('+m.before+' → '+m.after+')</span><span>'+new Date(m.createdAt).toLocaleString()+'</span><span>'+esc(m.note||'')+'</span></div>'}).join(''):'<div class="muted">No stock movements recorded yet.</div>';
  }
  async function save(){
    const id=$('invEditId')?.value||'',itemCode=$('invCode')?.value.trim(),itemName=$('invName')?.value.trim(),itemType=$('invType')?.value;
    if(!itemCode||!itemName)return alert('Item code aur item name required hain.');
    const current=read(),duplicate=current.find(x=>x.itemCode.toLowerCase()===itemCode.toLowerCase()&&String(x.id)!==String(id));if(duplicate)return alert('Item code already exists.');
    let item={id:id||String(Date.now()),itemCode,itemName,itemType,category:$('invCategory')?.value||'Other',quantity:Number($('invQty')?.value||0),reorderLevel:Number($('invReorder')?.value||0),unitCost:Number($('invUnitCost')?.value||0),condition:$('invCondition')?.value||'Good',location:$('invLocation')?.value.trim()||'',purchaseDate:$('invPurchaseDate')?.value||'',assignedStaffId:$('invAssignedStaff')?.value||'',assignedStaffName:activeStaff().find(s=>String(s.id)===String($('invAssignedStaff')?.value||''))?.fullName||'',notes:$('invNotes')?.value.trim()||'',active:$('invActive')?.value==='true',createdAt:new Date().toISOString()};
    if(item.itemType==='Asset'){item.quantity=Math.max(1,item.quantity||1);item.reorderLevel=0}else{item.assignedStaffId='';item.assignedStaffName='';item.condition='Good'}
    try{const c=await saveCloud(item);if(c)item=c}catch(e){if(cloudReady())return alert('Cloud inventory save failed: '+(e.message||e))}
    const next=current.filter(x=>String(x.id)!==String(id)&&x.itemCode.toLowerCase()!==itemCode.toLowerCase());next.push(item);write(next);render();
  }
  async function edit(id){
    const x=read().find(r=>String(r.id)===String(id));if(!x||!isHead())return;
    const box=$('invEditor');if(box)box.innerHTML=editor(x);bindEditor();
  }
  async function remove(id){
    if(!isHead()||!confirm('Delete this inventory item?'))return;
    try{await deleteCloud(id)}catch(e){if(cloudReady())return alert('Cloud delete failed: '+(e.message||e))}
    write(read().filter(x=>String(x.id)!==String(id)));render();
  }
  async function adjustStock(id,direction){
    if(!isHead())return;
    const rows=read(),item=rows.find(x=>String(x.id)===String(id));if(!item||item.itemType!=='Stock Item')return;
    const raw=prompt((direction>0?'Stock In':'Stock Out')+' quantity for '+item.itemName+':','1');if(raw===null)return;
    const qty=Math.floor(Number(raw));if(!Number.isFinite(qty)||qty<1)return alert('Enter a valid quantity of 1 or more.');
    const delta=direction*qty;if(Number(item.quantity||0)+delta<0)return alert('Stock cannot go below zero.');
    const note=prompt('Movement note / reference (optional):','')||'';
    try{
      if(cloudReady()){await adjustStockCloud(id,delta,note);await pullCloud();render();return}
    }catch(e){return alert('Cloud stock adjustment failed: '+(e.message||e))}
    const before=Number(item.quantity||0);item.quantity=before+delta;write(rows);
    const ms=movements();ms.unshift({id:String(Date.now()),itemId:item.id,type:delta>0?'IN':'OUT',delta,before,after:item.quantity,note,createdAt:new Date().toISOString()});writeMovements(ms);render();
  }
  function printReport(rows){
    const st=settings(),active=rows.filter(x=>x.active!==false),value=active.reduce((a,x)=>a+totalValue(x),0),w=window.open('','_blank','width=1000,height=760');if(!w)return alert('Popup blocked.');
    w.document.write('<!doctype html><html><head><title>Inventory Report</title><style>body{font-family:Arial;padding:28px;color:#17324a}.head{text-align:center}.meta{display:flex;justify-content:space-between;margin:20px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd6dc;padding:7px;text-align:left}</style></head><body><div class="head"><h2>'+esc(st.schoolName||'EduNizam Institute')+'</h2><h3>Inventory & Assets Report</h3></div><div class="meta"><strong>Active Items: '+active.length+'</strong><strong>Estimated Value: '+money(value)+'</strong></div><table><thead><tr><th>Code</th><th>Item</th><th>Type</th><th>Category</th><th>Qty</th><th>Condition</th><th>Location</th><th>Issued To</th><th>Value</th></tr></thead><tbody>'+active.map(x=>'<tr><td>'+esc(x.itemCode)+'</td><td>'+esc(x.itemName)+'</td><td>'+esc(x.itemType)+'</td><td>'+esc(x.category)+'</td><td>'+Number(x.quantity||0)+'</td><td>'+esc(x.condition||'Good')+'</td><td>'+esc(x.location||'-')+'</td><td>'+esc(assignedName(x)||'-')+'</td><td>'+money(totalValue(x))+'</td></tr>').join('')+'</tbody></table></body></html>');
    w.document.close();w.focus();setTimeout(()=>w.print(),250);
  }
  function bindEditor(){
    $('invSave')?.addEventListener('click',save);$('invCancel')?.addEventListener('click',render);
    $('invType')?.addEventListener('change',()=>{
      const asset=$('invType').value==='Asset';
      if($('invReorder'))$('invReorder').disabled=asset;
      if($('invCondition'))$('invCondition').disabled=!asset;
      if($('invAssignedStaff'))$('invAssignedStaff').disabled=!asset;
    });
    $('invType')?.dispatchEvent(new Event('change'));
  }
  function bind(rows,root){
    bindEditor();$('invPrint')?.addEventListener('click',()=>printReport(rows));
    $('invFilterType')?.addEventListener('change',e=>{root.dataset.invType=e.target.value;render()});
    $('invFilterCategory')?.addEventListener('change',e=>{root.dataset.invCategory=e.target.value;render()});
    $('invFilterStatus')?.addEventListener('change',e=>{root.dataset.invStatus=e.target.value;render()});
    $('invSearch')?.addEventListener('input',e=>{root.dataset.invSearch=e.target.value;clearTimeout(bind.timer);bind.timer=setTimeout(render,150)});
    $('invClearFilters')?.addEventListener('click',()=>{root.dataset.invType='';root.dataset.invCategory='';root.dataset.invStatus='';root.dataset.invSearch='';render()});
    document.querySelectorAll('[data-inv-stock-in]').forEach(b=>b.onclick=()=>adjustStock(b.dataset.invStockIn,1));
    document.querySelectorAll('[data-inv-stock-out]').forEach(b=>b.onclick=()=>adjustStock(b.dataset.invStockOut,-1));
    document.querySelectorAll('[data-inv-edit]').forEach(b=>b.onclick=()=>edit(b.dataset.invEdit));
    document.querySelectorAll('[data-inv-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.invDelete));
  }
  async function render(){
    const root=$('inventoryCenterApp');if(!root)return;
    let rows=read();
    if(cloudReady()&&!root.dataset.cloudLoaded){root.dataset.cloudLoaded='1';try{rows=await pullCloud()}catch(e){root.dataset.cloudLoaded='';console.warn('Inventory cloud sync:',e.message)}}
    rows=[...rows].sort((a,b)=>String(a.itemName).localeCompare(String(b.itemName)));
    const categories=[...new Set(rows.map(x=>x.category).filter(Boolean))].sort(),filtered=filterRows(rows,root);
    root.innerHTML='<div class="section-head"><div><span class="academic-pill">'+(cloudReady()?'Cloud Sync':'Local Mode')+'</span></div><button id="invPrint" class="secondary">Print Inventory Report</button></div>'+
      metricCards(rows)+'<div id="invEditor" style="margin-top:16px">'+editor()+'</div>'+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Low Stock Alerts</h3><p class="muted">Stock items at or below reorder level.</p></div></div><div class="list">'+lowStockList(rows)+'</div></article>'+
      '<article class="card" style="margin-top:16px"><div class="section-head"><div><h3>Stock Movement History</h3><p class="muted">Recent Stock In / Stock Out audit trail.</p></div></div><div class="list">'+movementRows()+'</div></article>'+
      '<div class="section-head" style="margin-top:18px"><div><h3>Inventory Directory</h3><p class="muted">'+filtered.length+' of '+rows.length+' items shown.</p></div><button id="invClearFilters" class="secondary">Clear Filters</button></div><div class="form-grid"><select id="invFilterType"><option value="">All Types</option>'+['Asset','Stock Item'].map(v=>'<option value="'+v+'" '+((root.dataset.invType||'')===v?'selected':'')+'>'+v+'</option>').join('')+'</select><select id="invFilterCategory"><option value="">All Categories</option>'+categories.map(v=>'<option value="'+esc(v)+'" '+((root.dataset.invCategory||'')===v?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select><select id="invFilterStatus"><option value="">All Status</option><option value="active" '+((root.dataset.invStatus||'')==='active'?'selected':'')+'>Active</option><option value="inactive" '+((root.dataset.invStatus||'')==='inactive'?'selected':'')+'>Inactive</option><option value="low" '+((root.dataset.invStatus||'')==='low'?'selected':'')+'>Low Stock</option></select><input id="invSearch" type="search" value="'+esc(root.dataset.invSearch||'')+'" placeholder="Search code, item, category, location or assignee"></div><div class="paper-grid" style="margin-top:12px">'+(filtered.length?filtered.map(card).join(''):'<div class="empty-state">No inventory item matches this filter.</div>')+'</div>';
    bind(rows,root);
  }
  window.addEventListener('edunizam:auth',()=>{const root=$('inventoryCenterApp');if(root)delete root.dataset.cloudLoaded;render()});
  setTimeout(render,0);setTimeout(render,900);
  window.EDUNIZAM_INVENTORY_CENTER={render,pullCloud,cloudReady};
})();