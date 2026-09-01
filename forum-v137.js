(() => {
  'use strict';
  const URL='https://viqufxlcxwgboyxbdhjb.supabase.co';
  const KEY='sb_publishable_zdfvnwwgL9LI3yTK0-1Sbg_RsYRvNge';
  const db=(window.f2wSupabase||window.supabaseClient||window.__f2wSupabaseClient||window.supabase?.createClient?.(URL,KEY));
  if(!db){ console.error('Forum v137: Supabase client unavailable'); return; }
  window.__f2wForumDb=db;

  const S={user:null,threads:[],category:'all',sort:'hot',search:'',channel:null,loading:false,postBusy:false,threadBusy:false};
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const cat=v=>({general:'General',movies:'Movies',tv:'TV Shows',reviews:'Reviews',recommendations:'Recommendations','off-topic':'Off-topic'}[v]||'General');
  const ago=v=>{const n=new Date(v).getTime();if(!Number.isFinite(n))return'';const s=Math.max(0,Math.floor((Date.now()-n)/1000));if(s<45)return'just now';if(s<3600)return Math.floor(s/60)+'m ago';if(s<86400)return Math.floor(s/3600)+'h ago';if(s<604800)return Math.floor(s/86400)+'d ago';return new Date(n).toLocaleDateString()};
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const withTimeout=(p,ms,msg)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error(msg||'Request timed out.')),ms))]);
  async function rpc(name,args={}){const {data,error}=await withTimeout(db.rpc(name,args),10000,'Forum server timed out. Please try again.');if(error)throw error;return data}
  function toast(msg){let e=$('forum-v30-toast');if(!e){e=document.createElement('div');e.id='forum-v30-toast';e.className='forum-v30-toast';document.body.appendChild(e)}e.textContent=msg;e.classList.add('show');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('show'),2400)}
  function status(msg='',kind=''){const e=$('forum-compose-status');if(!e)return;e.textContent=msg;e.className='forum-v30-status'+(kind?' '+kind:'')}
  function moveModals(){['forum-composer','forum-thread-modal'].forEach(id=>{const e=$(id);if(e&&e.parentElement!==document.body)document.body.appendChild(e)})}
  function unlockSearch(){const e=$('forum-search');if(!e)return;e.readOnly=false;e.removeAttribute('readonly')}

  function rows(){
    let a=[...S.threads];
    if(S.category!=='all')a=a.filter(x=>x.category===S.category);
    const q=S.search.trim().toLowerCase();
    if(q)a=a.filter(x=>[x.title,x.body,x.username,x.display_name].some(v=>String(v||'').toLowerCase().includes(q)));
    a.sort((x,y)=>S.sort==='new'?new Date(y.created_at)-new Date(x.created_at):
      (Number(y.reply_count||0)*8+Number(y.view_count||0)*.06+new Date(y.updated_at||y.created_at).getTime()/1e12)-
      (Number(x.reply_count||0)*8+Number(x.view_count||0)*.06+new Date(x.updated_at||x.created_at).getTime()/1e12));
    return a;
  }
  function render(){
    const host=$('forum-thread-feed');if(!host)return;
    const a=rows();
    if(!a.length){host.innerHTML='<div class="forum-v30-empty">No discussions match this filter yet. Start the first one.</div>';return}
    host.innerHTML=a.map(x=>`<article class="forum-v30-thread"><button class="forum-v30-thread-main" type="button" data-thread="${esc(x.id)}"><span class="forum-v30-thread-icon"><i class="fa-solid ${x.is_spoiler?'fa-eye-slash':'fa-message'}"></i></span><span class="forum-v30-thread-copy"><span><span class="forum-v30-category">${esc(cat(x.category))}</span>${x.is_spoiler?'<span class="forum-v30-spoiler">SPOILER</span>':''}</span><strong>${esc(x.title)}</strong><small>by <span class="forum-v30-author" data-username="${esc(x.username||'')}" data-role="${esc(x.top_role||'')}">${esc(x.display_name||x.username||'Member')}</span> · ${esc(ago(x.created_at))}</small></span><span class="forum-v30-thread-stats"><span><i class="fa-regular fa-comment"></i><b>${Number(x.reply_count||0)}</b></span><span><i class="fa-regular fa-eye"></i><b>${Number(x.view_count||0)}</b></span></span></button></article>`).join('');
    host.querySelectorAll('[data-thread]').forEach(b=>b.addEventListener('click',()=>openThread(b.dataset.thread)));
    window.decorateNames?.();
  }
  async function loadThreads(quiet=false){
    if(S.loading&&quiet)return;
    S.loading=true;
    try{const data=await rpc('get_forum_threads_v137',{p_limit:100});S.threads=Array.isArray(data)?data:[];if($('forum-thread-count'))$('forum-thread-count').textContent=String(S.threads.length);render()}
    catch(e){console.error('Forum load failed',e);if(!quiet&&$('forum-thread-feed'))$('forum-thread-feed').innerHTML=`<div class="forum-v30-empty">${esc(e.message||'Could not load discussions.')}</div>`}
    finally{S.loading=false}
  }
  async function loadRanks(){
    const host=$('forum-rankings');if(!host)return;
    try{const data=await rpc('get_public_leaderboard',{p_page:1,p_page_size:5,p_sort:'overall'});const a=Array.isArray(data)?data:[];host.innerHTML=a.length?a.map((x,i)=>`<a class="forum-v30-rank-row" href="/profile/@${encodeURIComponent(x.username||'')}"><span>#${i+1}</span><span class="forum-v30-rank-name" data-username="${esc(x.username||'')}" data-role="${esc(x.top_role||'')}">${esc(x.display_name||x.username||'Member')}</span><b>${Number(x.score||0)}</b></a>`).join('')+'<a class="forum-v30-rank-more" href="/leaderboard/">View full leaderboard →</a>':'<div class="forum-v30-empty">Rankings appear as members get active.</div>';window.decorateNames?.()}
    catch(e){host.innerHTML='<div class="forum-v30-empty">Rankings unavailable.</div>'}
  }
  function setCategory(v){S.category=v||'all';document.querySelectorAll('.forum-v30-nav.category').forEach(b=>b.classList.toggle('active',b.dataset.category===S.category));if($('forum-category-select'))$('forum-category-select').value=S.category;render()}
  async function ensureSession(){const {data}=await db.auth.getSession();S.user=data?.session?.user||null;if($('forum-account-state'))$('forum-account-state').textContent=S.user?'Member':'Guest';return S.user}
  async function openComposer(){
    if(!S.user)await ensureSession();
    if(!S.user){window.openHeaderAuth?.('login');return}
    moveModals();const m=$('forum-composer');if(!m)return;m.hidden=false;document.body.style.overflow='hidden';status('');requestAnimationFrame(()=>setTimeout(()=>$('forum-compose-title')?.focus(),40));
  }
  function closeComposer(){const m=$('forum-composer');if(m)m.hidden=true;document.body.style.overflow='';status('')}
  async function submitThread(){
    if(S.postBusy)return;
    const title=$('forum-compose-title')?.value.trim()||'',body=$('forum-compose-body')?.value.trim()||'',btn=$('forum-compose-submit');
    if(title.length<3){status('Title needs at least 3 characters.');$('forum-compose-title')?.focus();return}
    if(!body){status('Write something in the post first.');$('forum-compose-body')?.focus();return}
    if(!await ensureSession()){status('Your session expired. Log in again.');window.openHeaderAuth?.('login');return}
    S.postBusy=true;const old=btn?.innerHTML;if(btn){btn.disabled=true;btn.innerHTML='<span class="forum-v30-submit-spinner"></span> Posting…'}status('Posting discussion…','busy');
    try{
      const id=await rpc('create_forum_thread_v137',{p_title:title,p_body:body,p_category:$('forum-compose-category')?.value||'general',p_is_spoiler:Boolean($('forum-compose-spoiler')?.checked)});
      const optimistic={id,author_user_id:S.user.id,username:S.user.user_metadata?.username||'',display_name:S.user.user_metadata?.display_name||S.user.user_metadata?.username||'You',top_role:'',title,body,category:$('forum-compose-category')?.value||'general',is_spoiler:Boolean($('forum-compose-spoiler')?.checked),view_count:0,reply_count:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
      S.threads.unshift(optimistic);render();if($('forum-thread-count'))$('forum-thread-count').textContent=String(S.threads.length);
      $('forum-compose-title').value='';$('forum-compose-body').value='';$('forum-compose-spoiler').checked=false;status('Posted.','ok');
      await delay(120);closeComposer();toast('Discussion posted.');loadThreads(true);if(id)openThread(id);
    }catch(e){console.error('Discussion post failed:',e);status(e.message||'Could not post discussion.');}
    finally{S.postBusy=false;if(btn){btn.disabled=false;btn.innerHTML=old||'Post discussion'}}
  }
  async function openThread(id){
    if(!id||S.threadBusy)return;S.threadBusy=true;moveModals();const modal=$('forum-thread-modal'),host=$('forum-thread-detail');if(!modal||!host){S.threadBusy=false;return}modal.hidden=false;document.body.style.overflow='hidden';host.innerHTML='<div class="forum-v30-empty">Loading discussion…</div>';
    try{const x=await rpc('get_forum_thread_v137',{p_thread_id:id});if(!x)throw new Error('Thread not found');if($('forum-thread-title'))$('forum-thread-title').textContent=x.title||'Discussion';host.innerHTML=`<article class="forum-v30-thread-full"><div class="forum-v30-thread-full-meta"><span class="forum-v30-category">${esc(cat(x.category))}</span>${x.is_spoiler?'<span class="forum-v30-spoiler">SPOILER</span>':''}<span>${esc(ago(x.created_at))}</span></div><h3>${esc(x.title)}</h3><div class="forum-v30-thread-authorline">by <a href="/profile/@${encodeURIComponent(x.username||'')}" data-username="${esc(x.username||'')}" data-role="${esc(x.top_role||'')}">${esc(x.display_name||x.username||'Member')}</a></div><div class="forum-v30-thread-body">${esc(x.body).replace(/\n/g,'<br>')}</div></article><section class="forum-v30-replies"><strong>${Number(x.reply_count||0)} Replies</strong><div class="forum-v30-reply-list">${(x.replies||[]).map(r=>`<article class="forum-v30-reply"><div class="forum-v30-reply-head"><a href="/profile/@${encodeURIComponent(r.username||'')}" data-username="${esc(r.username||'')}" data-role="${esc(r.top_role||'')}">${esc(r.display_name||r.username||'Member')}</a><span>${esc(ago(r.created_at))}</span></div><div>${esc(r.body).replace(/\n/g,'<br>')}</div></article>`).join('')||'<div class="forum-v30-empty">No replies yet.</div>'}</div>${S.user?`<div class="forum-v30-reply-box"><textarea id="forum-reply-body" maxlength="3000" placeholder="Write a reply…"></textarea><div><span id="forum-reply-status" class="forum-v30-status"></span><button id="forum-reply-submit" type="button">Reply</button></div></div>`:'<div class="forum-v30-empty">Log in to join the discussion.</div>'}</section>`;$('forum-reply-submit')?.addEventListener('click',()=>reply(id));$('forum-reply-body')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();reply(id)}});window.decorateNames?.();loadThreads(true)}
    catch(e){host.innerHTML=`<div class="forum-v30-empty">${esc(e.message||'Could not load discussion.')}</div>`}
    finally{S.threadBusy=false}
  }
  async function reply(id){
    const input=$('forum-reply-body'),body=input?.value.trim()||'',st=$('forum-reply-status'),btn=$('forum-reply-submit');if(!body||!btn||btn.disabled)return;btn.disabled=true;if(st)st.textContent='Sending…';
    try{await rpc('create_forum_reply_v137',{p_thread_id:id,p_body:body});input.value='';toast('Reply posted.');await openThreadFresh(id)}catch(e){if(st)st.textContent=e.message||'Could not reply.'}finally{btn.disabled=false}
  }
  async function openThreadFresh(id){S.threadBusy=false;await openThread(id)}
  function closeThread(){const m=$('forum-thread-modal');if(m)m.hidden=true;document.body.style.overflow=''}
  function realtime(){
    try{if(S.channel)db.removeChannel?.(S.channel);let t;const refresh=()=>{clearTimeout(t);t=setTimeout(()=>loadThreads(true),90)};S.channel=db.channel('forum-v137-live').on('postgres_changes',{event:'*',schema:'public',table:'forum_threads'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'forum_replies'},refresh).subscribe()}
    catch(e){console.warn('Forum realtime unavailable',e)}
  }
  function bind(){
    document.querySelectorAll('[data-new-thread]').forEach(b=>b.addEventListener('click',openComposer));
    document.querySelectorAll('[data-close-composer]').forEach(b=>b.addEventListener('click',closeComposer));
    document.querySelectorAll('[data-close-thread]').forEach(b=>b.addEventListener('click',closeThread));
    $('forum-compose-submit')?.addEventListener('click',submitThread);
    $('forum-compose-body')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();submitThread()}});
    $('forum-search')?.addEventListener('input',e=>{S.search=e.target.value;render()});
    $('forum-category-select')?.addEventListener('change',e=>setCategory(e.target.value));
    document.querySelectorAll('.forum-v30-nav.category').forEach(b=>b.addEventListener('click',()=>setCategory(b.dataset.category)));
    document.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-sort]').forEach(x=>x.classList.toggle('active',x===b));S.sort=b.dataset.sort;render()}));
    $('forum-my-profile')?.addEventListener('click',()=>window.openMyProfile?.());
    $('forum-composer')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeComposer()});
    $('forum-thread-modal')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeThread()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('forum-composer')?.hidden)closeComposer();else if(!$('forum-thread-modal')?.hidden)closeThread()}});
  }
  async function boot(){
    moveModals();unlockSearch();bind();await ensureSession();await Promise.allSettled([loadThreads(),loadRanks()]);realtime();db.auth.onAuthStateChange((_e,s)=>{S.user=s?.user||null;if($('forum-account-state'))$('forum-account-state').textContent=S.user?'Member':'Guest'});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
