(()=> {
'use strict';
if(window.__f2wStaffCredentialsV1)return;
if(!/^\/staff(?:\/|$)/i.test(location.pathname))return;
window.__f2wStaffCredentialsV1=true;

const styleId='f2w-staff-credentials-v1-css';
const styleText = [
 '#auth-management-card.staff-credentials-panel{margin-top:12px;min-width:0;overflow:hidden}',
 '#auth-management-card .f2w-sc-identity{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(220px,.85fr);gap:10px;align-items:stretch}',
 '#auth-management-card .f2w-sc-identity .notice,#auth-management-card .f2w-sc-identity .field{min-width:0;margin:0;overflow-wrap:anywhere}',
 '#auth-management-card .f2w-sc-history{margin-top:12px;padding:11px 12px;border:1px solid var(--line,#233449);border-radius:10px;background:rgba(0,0,0,.14)}',
 '#auth-management-card .f2w-sc-history-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center;min-height:24px}',
 '#auth-management-card .f2w-sc-history-list .status{max-width:100%;overflow-wrap:anywhere;text-transform:none}',
 '#auth-management-card .f2w-sc-empty{color:var(--muted,#91a0b4);font-size:.72rem;line-height:1.5}',
 '#auth-management-card .f2w-sc-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px;min-width:0}',
 '#auth-management-card .f2w-sc-fields .field,#auth-management-card .f2w-sc-fields input{min-width:0}',
 '#auth-management-card .f2w-sc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}',
 '#auth-management-card .f2w-sc-actions .btn{justify-content:center}',
 '#auth-management-card .f2w-sc-actions .btn:disabled{opacity:.45;cursor:not-allowed}',
 '@media(max-width:850px){#auth-management-card .f2w-sc-identity,#auth-management-card .f2w-sc-fields{grid-template-columns:minmax(0,1fr)}#auth-management-card .f2w-sc-actions .btn{flex:1 1 190px}}',
 '@media(max-width:420px){#auth-management-card .f2w-sc-actions .btn{flex:1 1 100%;width:100%}#auth-management-card .card-head{align-items:flex-start;flex-direction:column}}'
].join('\n');
const css=document.createElement('style');css.id=styleId;css.textContent=styleText;(document.head||document.documentElement).appendChild(css);

function $(id){return document.getElementById(id)}
function roleCanManage(){return ['owner','staff'].includes(String(staffContext?.role||'').toLowerCase())}
function safeText(v){return String(v??'')}
function setActions(enabled){
 ['f2w-sc-update-email','f2w-sc-set-password','f2w-sc-send-reset'].forEach(id=>{const el=$(id);if(el)el.disabled=!enabled});
}
let authAccount=null;
let selectedSearch='';
let originalClear=window.clearModerationTarget;

const card=$('auth-management-card');
if(!card||!$('user-target'))return;
card.classList.add('staff-credentials-panel');
card.innerHTML=[
 '<div class="card-head"><div><strong><i class="fa-solid fa-key"></i> Account email &amp; password</strong><span style="display:block;text-align:left;margin-top:4px">Uses the username in Account Moderation to resolve the Supabase Auth UID.</span></div><span>Owner / Staff</span></div>',
 '<div class="f2w-sc-identity">',
   '<div class="notice" id="f2w-sc-identity">Load an account in Account Moderation to view the authentication record.</div>',
   '<div class="field"><label for="f2w-sc-current-email">CURRENT SUPABASE EMAIL</label><input id="f2w-sc-current-email" type="email" readonly placeholder="Load an account first"></div>',
 '</div>',
 '<div class="f2w-sc-history"><label>USERNAME HISTORY</label><div class="f2w-sc-history-list" id="f2w-sc-history-list"><span class="f2w-sc-empty">Recorded names will appear here.</span></div></div>',
 '<div class="f2w-sc-fields">',
   '<div class="field"><label for="f2w-sc-new-email">CHANGE ACCOUNT EMAIL</label><input id="f2w-sc-new-email" type="email" autocomplete="off" maxlength="254" placeholder="new-address@example.com"></div>',
   '<div class="field"><label for="f2w-sc-new-password">NEW PASSWORD (12–128 CHARACTERS)</label><input id="f2w-sc-new-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="New password"></div>',
   '<div class="field"><label for="f2w-sc-confirm-password">CONFIRM NEW PASSWORD</label><input id="f2w-sc-confirm-password" type="password" autocomplete="new-password" minlength="12" maxlength="128" placeholder="Confirm new password"></div>',
 '</div>',
 '<div class="row f2w-sc-actions">',
   '<button class="btn primary" id="f2w-sc-update-email" type="button" disabled><i class="fa-solid fa-at"></i> Update email</button>',
   '<button class="btn purple" id="f2w-sc-set-password" type="button" disabled><i class="fa-solid fa-lock"></i> Set new password</button>',
   '<button class="btn" id="f2w-sc-send-reset" type="button" disabled><i class="fa-solid fa-envelope"></i> Send password reset email</button>',
 '</div>',
 '<div class="moderation-status" id="f2w-sc-status" role="status" aria-live="polite">Search and load a username above to enable account actions.</div>'
].join('');
card.hidden=true;card.style.setProperty('display','none','important');

function setCardVisible(show){
 const visible=!!show&&roleCanManage()&&!!currentSnapshot?.profile?.user_id;
 card.hidden=!visible;
 if(visible){card.style.removeProperty('display');card.style.removeProperty('visibility')}
 else card.style.setProperty('display','none','important');
}
function status(message){const el=$('f2w-sc-status');if(el)el.textContent=message}
function safeErr(error,fallback){return error?.message||fallback}
function dedupeNames(names){
 const seen=new Set(),out=[];
 for(const item of names){const value=String(item||'').trim().replace(/^@/,'');const key=value.toLowerCase();if(value&&!seen.has(key)){seen.add(key);out.push(value)}}
 return out;
}
function showAccount(account){
 authAccount=account||null;
 const targetId=String(account?.user_id||'');
 const name=String(account?.username||currentSnapshot?.profile?.username||'').replace(/^@/,'');
 const email=String(account?.email||'');
 const identity=$('f2w-sc-identity');if(identity)identity.textContent='Username: '+(name?'@'+name:'not recorded in Auth metadata')+' · UUID: '+targetId+' · '+(account?.email_confirmed?'Email confirmed':'Email not confirmed');
 const current=$('f2w-sc-current-email');if(current)current.value=email;
 const historyNames=dedupeNames([name,...(Array.isArray(account?.username_history)?account.username_history:[]),...(Array.isArray(currentSnapshot?.profile?.username_history)?currentSnapshot.profile.username_history:[])]);
 const history=$('f2w-sc-history-list');
 if(history)history.innerHTML=historyNames.length?historyNames.map((n,i)=>'<span class="status">'+(i===0?'Current · ':'')+'@'+esc(n)+'</span>').join(''):'<span class="f2w-sc-empty">No previous username changes are recorded for this account.</span>';
 setActions(!!targetId);
}
async function invokeAuth(operation,identifier,extras={}){
 const body={action:'staff_account_admin',operation,identifier:String(identifier||''),...extras};
 const {data,error}=await db.functions.invoke('rapid-worker',{body});
 if(error){
  let detail=error.message||'Supabase Auth request failed.';
  try{const response=error.context;if(response&&typeof response.clone==='function'){const payload=await response.clone().json();if(payload?.error||payload?.message)detail=payload.error||payload.message}}catch{}
  throw new Error(detail);
 }
 if(!data?.success)throw new Error(data?.error||'Supabase Auth request failed.');
 return data;
}
async function getAccount(identifier){
 const result=await invokeAuth('lookup',identifier);
 const account=result?.account;
 if(!account?.user_id)throw new Error('Supabase Auth did not return a matching account.');
 return {
  ...account,
  user_id:String(account.user_id),
  username:String(account.username||identifier||''),
  email:String(account.email||''),
  email_confirmed:!!(account.email_confirmed||account.email_confirmed_at),
  username_history:Array.isArray(account.username_history)?account.username_history:[]
 };
}
function renderAuthOnlyNotice(account){
 const snap=$('user-snapshot');
 if(!snap)return;
 snap.hidden=false;
 snap.innerHTML='<div class="card-head"><strong><i class="fa-solid fa-database"></i> Supabase Auth account</strong><span>Username metadata lookup</span></div><div class="notice">Resolved username to UID '+esc(account.user_id)+'. Profile-based moderation data was not available, so the restriction switches stay disabled.</div>';
 const profile=$('moderation-target-profile');if(profile)profile.innerHTML='';
 ['quick-public-chat-ban','quick-chat-mute','quick-site-suspension','quick-account-ban'].forEach(id=>{const el=$(id);if(el)el.checked=false});
 if(typeof setQuickControlsEnabled==='function')setQuickControlsEnabled(false);
 const perms=$('permission-card');if(perms)perms.hidden=true;
}
window.showAuthManagementCard=setCardVisible;
window.loadStaffAuthDetails=async function(targetId){
 try{
  const account=await getAccount(String(targetId||currentSnapshot?.profile?.user_id||''));
  showAccount(account);
  return account;
 }catch(error){
  authAccount=null;setActions(false);
  const identity=$('f2w-sc-identity');if(identity)identity.textContent='Could not load the Supabase Auth record: '+safeErr(error,'unknown error');
  status('Authentication lookup failed. No account changes are enabled.');
  return null;
 }
};
window.inspectUser=async function(){
 const input=$('user-target');
 const username=String(input?.value||'').trim();
 if(!username)return;
 const sync=$('moderation-sync-label'),modStatus=$('moderation-status');
 if(sync)sync.textContent='Loading account…';
 if(modStatus)modStatus.innerHTML='<strong>Loading account…</strong> Resolving username against Supabase Auth metadata.';
 setActions(false);setCardVisible(false);authAccount=null;selectedSearch=username;
 let account=null,authError=null,snapshot=null,snapshotError=null;
 const canManage=roleCanManage();
 if(canManage){
  try{account=await getAccount(username)}catch(error){authError=error}
 }
 try{
  snapshot=await rpc('get_staff_user_snapshot',{p_username:String(account?.username||username)});
  if(!snapshot?.profile?.user_id||(account&&String(snapshot.profile.user_id)!==String(account.user_id)))snapshot=null;
 }catch(error){snapshotError=error}
 if(!snapshot&&account){
  currentSnapshot={profile:{user_id:String(account.user_id),username:String(account.username||username),username_history:Array.isArray(account.username_history)?account.username_history:[],created_at:account.created_at||null},role:'member',warnings:[],notes:[]};
  setCardVisible(canManage);showAccount(account);renderAuthOnlyNotice(account);
  if(modStatus)modStatus.innerHTML='<strong>Supabase Auth account found.</strong> Login controls are ready. No profile moderation record was available, so restriction switches stay disabled.';
  if(sync)sync.textContent='Auth account found';
  return;
 }
 if(!snapshot){
  currentSnapshot=null;setCardVisible(false);authAccount=null;
  const targetProfile=$('moderation-target-profile');if(targetProfile)targetProfile.innerHTML='';
  const userSnapshot=$('user-snapshot');if(userSnapshot){userSnapshot.hidden=true;userSnapshot.innerHTML=''}
  if(typeof setQuickControlsEnabled==='function')setQuickControlsEnabled(false);
  const message=safeErr(authError,safeErr(snapshotError,'No account matched that username.'));
  if(modStatus)modStatus.innerHTML='<strong>User not found.</strong> '+esc(message);
  if(sync)sync.textContent='No target';
  toast(message);return;
 }
 currentSnapshot=snapshot;
 if(account){
  currentSnapshot.profile.username=account.username||currentSnapshot.profile.username||username;
  currentSnapshot.profile.user_id=account.user_id;
  const histories=dedupeNames([...(Array.isArray(account.username_history)?account.username_history:[]),...(Array.isArray(currentSnapshot.profile.username_history)?currentSnapshot.profile.username_history:[])]);
  currentSnapshot.profile.username_history=histories;
 }
 renderUserSnapshot();
 if(canManage&&account){setCardVisible(true);showAccount(account)}
 else{
  setCardVisible(false);
  if(canManage&&authError)status('Account moderation loaded, but Supabase Auth lookup failed: '+safeErr(authError,'unknown error'));
 }
 await loadQuickModerationState();
 if(staffContext?.role==='owner')await renderPermissions();
 if(sync)sync.textContent='Realtime / autosave';
};
window.clearModerationTarget=(function(old){
 return function(){
  if(typeof old==='function')old();
  authAccount=null;selectedSearch='';
  setCardVisible(false);setActions(false);
  const email=$('f2w-sc-current-email');if(email)email.value='';
  const newEmail=$('f2w-sc-new-email');if(newEmail)newEmail.value='';
  const p=$('f2w-sc-new-password');if(p)p.value='';
  const c=$('f2w-sc-confirm-password');if(c)c.value='';
  const history=$('f2w-sc-history-list');if(history)history.innerHTML='<span class="f2w-sc-empty">Recorded names will appear here.</span>';
  status('Search and load a username above to enable account actions.');
 };
})(window.clearModerationTarget);

async function act(operation){
 if(!roleCanManage()||!currentSnapshot?.profile?.user_id||!authAccount?.user_id){
  status('Load the intended username in Account Moderation first.');return;
 }
 const target=String(authAccount.user_id);
 let extras={},title='',copy='',confirmText='Confirm';
 if(operation==='update_email'){
  const email=String($('f2w-sc-new-email')?.value||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254){status('Enter a valid email address.');return}
  if(email===String(authAccount.email||'').toLowerCase()){status('That is already the current account email.');return}
  extras={email};title='Change account email?';copy='Update the Supabase Auth email for UID '+target+' to '+email+'. The server confirms this staff change immediately.';
 }else if(operation==='set_password'){
  const password=String($('f2w-sc-new-password')?.value||'');
  const confirm=String($('f2w-sc-confirm-password')?.value||'');
  if(password.length<12||password.length>128){status('Use a password between 12 and 128 characters.');return}
  if(password!==confirm){status('The new password and confirmation do not match.');return}
  extras={password,confirm_password:confirm};title='Set new account password?';copy='This immediately changes the Supabase Auth password for '+(authAccount.username?'@'+authAccount.username:target)+'. It will not be shown or logged after saving.';
 }else if(operation==='send_reset'){
  if(!authAccount.email){status('This account has no email address. Update its email first.');return}
  title='Send password reset email?';copy='Send the Supabase password-reset email to '+authAccount.email+'. The user can choose their own password from that email link.';confirmText='Send reset email';
 }else{return}
 if(!await staffConfirm({title,copy,confirmText}))return;
 status('Applying action…');
 try{
  await invokeAuth(operation,target,extras);
  if(operation==='update_email'){
   $('f2w-sc-new-email').value='';
   const refreshed=await getAccount(target);showAccount(refreshed);
   status('Account email updated successfully in Supabase Auth.');toast('Account email updated');
  }else if(operation==='set_password'){
   $('f2w-sc-new-password').value='';$('f2w-sc-confirm-password').value='';
   status('Password changed successfully in Supabase Auth.');toast('Account password changed');
  }else{
   status('Password-reset email requested for '+authAccount.email+'. Supabase will send the link through its configured email provider.');
   toast('Password-reset email requested');
  }
 }catch(error){status(safeErr(error,'Account action failed.'));toast(safeErr(error,'Account action failed.'))}
}
window.f2wStaffCredentialAction=act;
$('f2w-sc-update-email')?.addEventListener('click',()=>act('update_email'));
$('f2w-sc-set-password')?.addEventListener('click',()=>act('set_password'));
$('f2w-sc-send-reset')?.addEventListener('click',()=>act('send_reset'));
$('user-target')?.addEventListener('input',()=>{
 const v=String($('user-target')?.value||'').trim();
 if(selectedSearch&&v!==selectedSearch){
  authAccount=null;setActions(false);
  status('Username changed. Load the new account before applying any login changes.');
 }
});
})();