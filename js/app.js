const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const cfg=window.AMMO_CONFIG||{};
let sb, USER, PROFILE, BASE={products:[],locations:[],personnel:[]};
function say(el,t,ok=true){el.textContent=t;el.className='msg '+(ok?'ok':'bad')}
function val(el){return el?.value??''}
function errText(e){return e?.message||String(e)}
if(!cfg.supabaseUrl||!cfg.supabaseAnonKey){document.body.innerHTML='<main class="configerror panel"><h1>Configuration required</h1><p>Open <code>config.js</code> and enter the Supabase project URL and publishable/anon key. See README.md.</p></main>'} else { sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey); boot(); }
async function boot(){
  const {data:{session}}=await sb.auth.getSession(); if(session) await enter(session.user); else showLogin();
  sb.auth.onAuthStateChange(async(e,s)=>{
  if(e==='PASSWORD_RECOVERY'){
    showPasswordReset();
    return;
  }
  if(s?.user&&!USER) await enter(s.user);
  if(!s){USER=PROFILE=null;showLogin()}
});
  $('#loginf').onsubmit=login; $('#logout').onclick=()=>sb.auth.signOut();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
function showLogin(){ $('#authscreen').hidden=false; $('#appscreen').hidden=true; }
function showPasswordReset(){
  $('#authscreen').hidden=false;
  $('#appscreen').hidden=true;
  $('#authscreen').innerHTML=`
    <main class="panel" style="max-width:480px;margin:80px auto">
      <h1>Set New Password</h1>
      <p>Enter a new password for your Armory Inventory Manager account.</p>
      <form id="resetpwform">
        <label>New Password</label>
        <input id="newpassword" type="password" minlength="8" required>
        <label>Confirm New Password</label>
        <input id="confirmpassword" type="password" minlength="8" required>
        <button type="submit">Set Password</button>
        <p id="resetmsg" class="msg"></p>
      </form>
    </main>`;
  $('#resetpwform').onsubmit=setNewPassword;
}

async function setNewPassword(e){
  e.preventDefault();
  const password=val($('#newpassword'));
  const confirm=val($('#confirmpassword'));
  const msg=$('#resetmsg');

  if(password!==confirm){
    say(msg,'Passwords do not match.',false);
    return;
  }

  if(password.length<8){
    say(msg,'Password must be at least 8 characters.',false);
    return;
  }

  say(msg,'Updating password...');

  const {error}=await sb.auth.updateUser({password});

  if(error){
    say(msg,errText(error),false);
    return;
  }

  say(msg,'Password updated successfully.');

  setTimeout(async()=>{
    const {data:{session}}=await sb.auth.getSession();
    if(session?.user) await enter(session.user);
    else showLogin();
  },1000);
}
async function login(e){e.preventDefault();say($('#loginmsg'),'Signing in…');const {error}=await sb.auth.signInWithPassword({email:val($('#loginemail')).trim(),password:val($('#loginpw'))});if(error)say($('#loginmsg'),error.message,false)}
async function enter(user){USER=user;const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).single();if(error||!data?.active){await sb.auth.signOut();say($('#loginmsg'),'Account profile is missing or inactive. Contact an administrator.',false);return}PROFILE=data;$('#who').textContent=`${PROFILE.display_name} · ${PROFILE.role}`;$('#authscreen').hidden=true;$('#appscreen').hidden=false;applyRole();wire();await loadBase();await dash();}
function applyRole(){const review=['ADMIN','SUPERVISOR'].includes(PROFILE.role),write=['ADMIN','SUPERVISOR','ARMORER'].includes(PROFILE.role);if(!review)$('[data-v="approvals"]').classList.add('rolehidden');if(!write){$('[data-v="scan"]').classList.add('rolehidden');$('[data-v="movement"]').classList.add('rolehidden');$('[data-v="admin"]').classList.add('rolehidden')}if(PROFILE.role!=='ADMIN')$('#admin .grid2')?.children[1]?.classList?.add('rolehidden')}
let wired=false;function wire(){if(wired)return;wired=true;$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.remove('active'));$$('.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#'+b.dataset.v).classList.add('active');if(b.dataset.v==='inventory')renderInventory();if(b.dataset.v==='transactions')renderTx();if(b.dataset.v==='approvals')renderApprovals();if(b.dataset.v==='dashboard')dash()});
$$('.prod').forEach(s=>s.onchange=()=>loadLots(s.closest('form')));$$('.newlot').forEach(b=>b.onclick=()=>openLot(b.closest('form')));$('#lotcancel').onclick=()=>$('#lotdlg').close();$('#lotf').onsubmit=saveLot;$('#lookup').onclick=lookupUPC;$('#receive').onsubmit=e=>submitMove(e,'RECEIVE');$('#issue').onsubmit=e=>submitMove(e,'ISSUE');$('#returnf').onsubmit=e=>submitMove(e,'RETURN');$('#transfer').onsubmit=e=>submitMove(e,'TRANSFER');$('#countf').onsubmit=submitCount;$('#productf').onsubmit=addProduct;}
async function q(table,select='*',build=x=>x){let r=await build(sb.from(table).select(select));if(r.error)throw r.error;return r.data}
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data}
async function loadBase(){try{BASE.products=await q('products','*',x=>x.order('manufacturer').order('caliber'));BASE.locations=await q('locations','*',x=>x.order('name'));BASE.personnel=await q('personnel','*',x=>x.eq('active',true).order('name'));const po=BASE.products.map(x=>`<option value="${x.id}">${x.manufacturer} ${x.caliber} ${x.load_name}</option>`).join(''),lo=BASE.locations.map(x=>`<option value="${x.id}">${x.name}</option>`).join(''),pe='<option value="">—</option>'+BASE.personnel.map(x=>`<option value="${x.id}">${x.name}${x.badge_id?' #'+x.badge_id:''}</option>`).join('');$$('.prod').forEach(x=>x.innerHTML=po);$$('.loc,.fromloc,.toloc').forEach(x=>x.innerHTML=lo);$$('.person').forEach(x=>x.innerHTML=pe);$('#lotprod').innerHTML=po;await Promise.all($$('form .prod').map(s=>loadLots(s.closest('form'))));}catch(e){alert(errText(e))}}
async function loadLots(form){if(!form)return;const p=form.querySelector('.prod'),l=form.querySelector('.lot');if(!p||!l)return;const d=await q('ammo_lots','*',x=>x.eq('product_id',+p.value).order('received_date',{ascending:false}));l.innerHTML=d.map(x=>`<option value="${x.id}">${x.lot_number}${x.recalled?' ⚠ RECALL':''}</option>`).join('')}
function openLot(form){$('#lotprod').value=form.querySelector('.prod').value;$('#lotdate').value=new Date().toISOString().slice(0,10);$('#lotdlg').showModal()}
async function saveLot(e){e.preventDefault();try{await rpc('add_lot',{p_product_id:+$('#lotprod').value,p_lot_number:val($('#lotnum')),p_received_date:val($('#lotdate')),p_vendor:val($('#lotvendor')),p_purchase_order:val($('#lotpo'))});say(e.target.querySelector('.msg'),'Lot saved');$('#lotdlg').close();await loadBase()}catch(x){say(e.target.querySelector('.msg'),errText(x),false)}}
async function lookupUPC(){const upc=val($('#upc')).trim();const {data,error}=await sb.from('products').select('*').eq('upc',upc).maybeSingle();$('#scanresult').textContent=error?'Lookup failed':data?`${data.manufacturer} ${data.caliber} ${data.load_name} — ${data.rounds_per_box} rounds/box`:'UPC not found';if(data)$$('.prod').forEach(s=>{s.value=data.id;s.dispatchEvent(new Event('change'))})}
async function submitMove(e,kind){e.preventDefault();const f=e.target,m=f.querySelector('.msg');try{const pid=+f.querySelector('.prod').value,lid=+f.querySelector('.lot').value,p=BASE.products.find(x=>x.id===pid);let qty;if(kind==='RECEIVE'||kind==='ISSUE')qty=+(f.querySelector('.boxes').value||0)*p.rounds_per_box+(+f.querySelector('.loose').value||0);else qty=+f.querySelector('.qty').value;let from=null,to=null,person=f.querySelector('.person')?.value||null;if(kind==='RECEIVE'||kind==='RETURN')to=+(f.querySelector('.loc').value);if(kind==='ISSUE')from=+(f.querySelector('.loc').value);if(kind==='TRANSFER'){from=+f.querySelector('.fromloc').value;to=+f.querySelector('.toloc').value}await rpc('inventory_txn',{p_kind:kind,p_product_id:pid,p_lot_id:lid,p_quantity:qty,p_from:from,p_to:to,p_personnel:person?+person:null,p_reason:f.querySelector('.reason')?.value||kind,p_notes:''});say(m,`${kind} recorded: ${qty} rounds`);await dash()}catch(x){say(m,errText(x),false)}}
async function submitCount(e){e.preventDefault();const f=e.target,m=f.querySelector('.msg');try{const d=await rpc('submit_count',{p_product_id:+f.querySelector('.prod').value,p_lot_id:+f.querySelector('.lot').value,p_location_id:+f.querySelector('.loc').value,p_counted:+f.querySelector('.qty').value,p_reason:'Physical inventory',p_notes:''});say(m,`Count saved. Expected ${d.expected}; variance ${d.variance}.`);await dash()}catch(x){say(m,errText(x),false)}}
async function addProduct(e){e.preventDefault();const m=e.target.querySelector('.msg');try{await rpc('add_product',{p_manufacturer:val($('#pm')),p_caliber:val($('#pc')),p_load_name:val($('#pl')),p_bullet_weight:val($('#pw')),p_upc:val($('#pu')),p_sku:val($('#ps')),p_rounds_per_box:+val($('#pr')),p_category:val($('#pca')),p_reorder_threshold:+val($('#pth'))});say(m,'Product added');e.target.reset();$('#pr').value=50;$('#pth').value=0;await loadBase()}catch(x){say(m,errText(x),false)}}
async function joinedInventory(){return await q('inventory_balance','current_qty,product_id,lot_id,location_id,products(manufacturer,caliber,load_name,bullet_weight,rounds_per_box,category),ammo_lots(lot_number,recalled),locations(name)',x=>x.neq('current_qty',0))}
async function joinedTx(limit=500){return await q('transactions','*,products(manufacturer,caliber,load_name),ammo_lots(lot_number),from:locations!transactions_from_location_id_fkey(name),to:locations!transactions_to_location_id_fkey(name),personnel(name)',x=>x.order('id',{ascending:false}).limit(limit))}
async function dash(){try{const inv=await joinedInventory(),tx=await joinedTx(8);$('#rounds').textContent=inv.reduce((a,x)=>a+x.current_qty,0).toLocaleString();$('#productsN').textContent=new Set(inv.map(x=>x.product_id)).size;$('#lotsN').textContent=new Set(inv.map(x=>x.lot_id)).size;let pending=0;if(['ADMIN','SUPERVISOR'].includes(PROFILE.role)){const {count}=await sb.from('adjustment_requests').select('*',{count:'exact',head:true}).eq('status','PENDING');pending=count||0}$('#pendingN').textContent=pending;$('#recent').innerHTML=tx.length?tx.map(x=>`<div class="item"><strong>${x.txn_type}</strong> ${x.quantity_rounds} rounds — ${x.products.manufacturer} ${x.products.caliber} ${x.products.load_name}<br><span class="muted">${new Date(x.created_at).toLocaleString()}</span></div>`).join(''):'<p class="muted">No transactions yet.</p>'}catch(e){console.error(e)}}
async function renderInventory(){try{const d=await joinedInventory();$('#inv').innerHTML=d.map(x=>`<tr><td>${x.products.manufacturer} ${x.products.caliber} ${x.products.load_name} ${x.products.bullet_weight||''}</td><td>${x.ammo_lots.lot_number}${x.ammo_lots.recalled?' ⚠':''}</td><td>${x.locations.name}</td><td><strong>${x.current_qty.toLocaleString()}</strong></td><td>${x.products.category}</td></tr>`).join('')}catch(e){alert(errText(e))}}
async function renderTx(){try{const d=await joinedTx();$('#tx').innerHTML=d.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString()}</td><td>${x.txn_type}</td><td>${x.products.manufacturer} ${x.products.caliber} ${x.products.load_name}</td><td>${x.ammo_lots?.lot_number||'—'}</td><td>${x.quantity_rounds}</td><td>${x.from?.name||''}${x.from&&x.to?' → ':''}${x.to?.name||''}</td><td>${x.personnel?.name||'—'}</td><td>${x.created_by||'—'}</td></tr>`).join('')}catch(e){alert(errText(e))}}
async function renderApprovals(){try{const d=await q('adjustment_requests','*,products(manufacturer,caliber,load_name),ammo_lots(lot_number),locations(name),profiles!adjustment_requests_requested_by_user_id_fkey(display_name)',x=>x.order('id',{ascending:false}));$('#adjustments').innerHTML=d.length?d.map(x=>`<div class="item"><strong>${x.status}</strong> ${x.delta_rounds>0?'+':''}${x.delta_rounds} rounds — ${x.products.manufacturer} ${x.products.caliber} ${x.products.load_name}, lot ${x.ammo_lots.lot_number}, ${x.locations.name}<br><span class="muted">Requested by ${x.profiles?.display_name||'User'}: ${x.reason}</span>${x.status==='PENDING'?`<div class="actions"><button data-review="${x.id}" data-ok="1">Approve</button><button class="secondary" data-review="${x.id}" data-ok="0">Reject</button></div>`:''}</div>`).join(''):'<p class="muted">No adjustment requests.</p>';$$('[data-review]').forEach(b=>b.onclick=async()=>{try{await rpc('review_adjustment',{p_adjustment_id:+b.dataset.review,p_approve:b.dataset.ok==='1',p_review_note:''});await renderApprovals();await dash()}catch(e){alert(errText(e))}})}catch(e){$('#adjustments').innerHTML='<p class="muted">Supervisor or Administrator permission is required.</p>'}}
