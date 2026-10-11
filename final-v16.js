
(() => {
  'use strict';

  const THEMES={
    'theme-red':['#e50914','229,9,20'],
    'theme-blue':['#3b82f6','59,130,246'],
    'theme-green':['#10b981','16,185,129'],
    'theme-purple':['#8b5cf6','139,92,246'],
    'theme-amber':['#f59e0b','245,158,11'],
    'theme-matrix':['#00ff66','0,255,102'],
    'theme-cyan':['#06b6d4','6,182,212'],
    'theme-pink':['#ec4899','236,72,153'],
    'theme-orange':['#f97316','249,115,22'],
    'theme-ice':['#7dd3fc','125,211,252'],
    'theme-gold':['#eab308','234,179,8'],
    'theme-midnight':['#6366f1','99,102,241']
  };

  function savedTheme(){
    const saved=
      localStorage.getItem('flix2watch_theme')
      ||localStorage.getItem('josh_site_theme')
      ||'theme-red';

    return Object.prototype.hasOwnProperty.call(THEMES,saved)
      ?saved
      :'theme-red';
  }

  function applyTheme(theme,save=false){
    const value=Object.prototype.hasOwnProperty.call(THEMES,theme)
      ?theme
      :'theme-red';

    document.documentElement.dataset.flix2watchTheme=value;

    if(document.body){
      Object.keys(THEMES).forEach(name=>document.body.classList.remove(name));
      document.body.classList.add(value);
    }

    if(save){
      localStorage.setItem('flix2watch_theme',value);
      localStorage.setItem('josh_site_theme',value);
    }

    const [color]=THEMES[value];
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute('content',color);
  }

  window.setTheme=function(_name,themeClass){
    applyTheme(themeClass,true);
    document.querySelectorAll('.dropdown-menu')
      .forEach(menu=>menu.classList.remove('show'));
  };

  function removeCheckingScreens(){
    document.querySelectorAll(
      '#f2w-auth-checking,.f2w-auth-checking,#flix2watch-account-check,.flix2watch-account-check,.account-checking-overlay,.checking-account-overlay'
    ).forEach(node=>node.remove());

    document.querySelectorAll('body > div,body > section,body > aside')
      .forEach(node=>{
        const text=String(node.textContent||'').trim().toLowerCase();
        if(
          text.startsWith('checking your flix2watch account')
          ||text.startsWith('verifying your flix2watch account')
        ){
          node.remove();
        }
      });
  }

  const PROFILE_ROLE_MAP={
    owner:{label:'Owner',icon:'fa-shield-halved',color:'#ff2b3d',className:'owner'},
    staff:{label:'Staff',icon:'fa-shield-halved',color:'#a855f7',className:'staff'},
    admin:{label:'Admin',icon:'fa-crown',color:'#fb923c',className:'admin'},
    moderator:{label:'Moderator',icon:'fa-gavel',color:'#38bdf8',className:'moderator'},
    curator:{label:'Curator',icon:'fa-clapperboard',color:'#f472b6',className:'curator'},
    support:{label:'Support',icon:'fa-headset',color:'#22d3ee',className:'support'},
    developer:{label:'Developer',icon:'fa-code',color:'#4ade80',className:'developer'},
    verified:{label:'Verified',icon:'fa-circle-check',color:'#facc15',className:'verified'},
    contributor:{label:'Contributor',icon:'fa-star',color:'#818cf8',className:'contributor'}
  };

  function timeAgo(dateValue){
    if(!dateValue)return 'Recently';

    const date=new Date(dateValue);
    if(Number.isNaN(date.getTime()))return 'Recently';

    const delta=Math.max(0,Date.now()-date.getTime());
    const days=Math.floor(delta/86400000);

    if(days<1)return 'Today';
    if(days===1)return 'Yesterday';
    if(days<30)return `${days} days ago`;

    const months=Math.floor(days/30);
    if(months<12)return `${months} month${months===1?'':'s'} ago`;

    const years=Math.floor(months/12);
    return `${years} year${years===1?'':'s'} ago`;
  }

  function memberAge(dateValue){
    if(!dateValue)return '—';
    const date=new Date(dateValue);
    if(Number.isNaN(date.getTime()))return '—';

    const months=Math.max(
      0,
      (new Date().getFullYear()-date.getFullYear())*12
      +(new Date().getMonth()-date.getMonth())
    );

    if(months<1)return 'New';
    if(months<12)return `${months} mo`;
    const years=Math.floor(months/12);
    const remainder=months%12;
    return remainder?`${years}y ${remainder}m`:`${years}y`;
  }

  async function renderPublicRoleBadges(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    const host=document.getElementById('v16-profile-badges');
    if(!host)return;

    let profile=null;
    try{profile=viewedProfile}catch{}
    if(!profile){
      host.innerHTML='<span class="profile-v16-none">No public profile loaded.</span>';
      return;
    }

    const roles=[];

    try{
      if(String(profile.user_id||'')==='f5454804-a2a6-4602-9086-51cf51f11c77'){
        roles.push('owner');
      }else{
        const {data}=await chatSupabase.rpc(
          'get_public_profile_role',
          {target_username:profile.username}
        );
        if(data==='staff')roles.push('staff');
      }
    }catch{}

    try{
      const {data,error}=await chatSupabase.rpc(
        'get_public_profile_badges',
        {target_username:profile.username}
      );

      if(!error){
        (Array.isArray(data)?data:[])
          .map(item=>String(item?.role_key||''))
          .filter(role=>PROFILE_ROLE_MAP[role])
          .forEach(role=>roles.push(role));
      }
    }catch{}

    const unique=[...new Set(roles)];

    const inline=document.getElementById('v16-profile-inline-roles');

    if(!unique.length){
      host.innerHTML='<span class="profile-v16-none">No extra public roles.</span>';
      if(inline){
        inline.hidden=true;
        inline.innerHTML='';
      }
      return;
    }

    const markup=unique.map(role=>{
      const meta=PROFILE_ROLE_MAP[role];
      return `
        <span
          class="profile-v16-badge ${meta.className}"
          style="--badge-color:${meta.color}"
          title="Flix2Watch ${meta.label}"
        >
          <i class="fa-solid ${meta.icon}"></i>
          ${meta.label}
        </span>`;
    }).join('');

    host.innerHTML=markup;

    if(inline){
      const custom=unique.filter(role=>!['owner','staff'].includes(role));

      if(custom.length){
        inline.hidden=false;
        inline.innerHTML=custom.map(role=>{
          const meta=PROFILE_ROLE_MAP[role];
          return `<span class="profile-v16-badge ${meta.className}" style="--badge-color:${meta.color}">
            <i class="fa-solid ${meta.icon}"></i>${meta.label}
          </span>`;
        }).join('');
      }else{
        inline.hidden=true;
        inline.innerHTML='';
      }
    }
  }

  function renderProfileExtras(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    let profile=null;
    let favorites=[];
    let social={followers:0,following:0};

    try{profile=viewedProfile}catch{}
    try{favorites=Array.isArray(viewedProfileFavorites)?viewedProfileFavorites:[]}catch{}
    try{social=viewedSocial||social}catch{}

    const age=document.getElementById('v16-profile-age');
    const mix=document.getElementById('v16-profile-mix');
    const privacy=document.getElementById('v16-profile-privacy');
    const socialCount=document.getElementById('v16-profile-social');
    const activity=document.getElementById('v16-profile-activity');

    if(age)age.textContent=profile?memberAge(profile.created_at):'—';

    const movies=favorites.filter(item=>item.media_type==='movie').length;
    const tv=favorites.filter(item=>item.media_type==='tv').length;

    if(mix){
      if(!favorites.length){
        mix.textContent='No saves';
      }else if(movies===tv){
        mix.textContent='Balanced';
      }else if(movies>tv){
        mix.textContent=`${Math.round(movies/favorites.length*100)}% movies`;
      }else{
        mix.textContent=`${Math.round(tv/favorites.length*100)}% TV`;
      }
    }

    if(privacy)privacy.textContent=profile?.is_private?'Private':'Public';

    if(socialCount){
      socialCount.textContent=String(
        Number(social?.followers||0)+Number(social?.following||0)
      );
    }

    if(activity){
      if(!favorites.length){
        activity.innerHTML='<div class="profile-v16-none">No recent public activity yet.</div>';
      }else{
        activity.innerHTML=favorites.slice(0,6).map(item=>`
          <a
            class="profile-v16-activity-item"
            href="/watch/?id=${encodeURIComponent(item.media_id)}&type=${encodeURIComponent(item.media_type)}"
            style="text-decoration:none"
          >
            <span class="profile-v16-activity-icon">
              <i class="fa-solid ${item.media_type==='tv'?'fa-tv':'fa-film'}"></i>
            </span>
            <span class="profile-v16-activity-copy">
              <strong>${String(item.title||'Untitled').replace(/[&<>"']/g,ch=>({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
              }[ch]))}</strong>
              <span>Saved to public favorites</span>
            </span>
            <span class="profile-v16-activity-time">${timeAgo(item.created_at)}</span>
          </a>
        `).join('');
      }
    }

    renderPublicRoleBadges();
  }

  function installProfileHooks(){
    if(!document.body?.classList.contains('f2w-profile-page'))return;

    try{
      if(typeof renderViewedProfile==='function'&&!renderViewedProfile.__v16Wrapped){
        const original=renderViewedProfile;
        const wrapped=function(...args){
          const result=original.apply(this,args);
          setTimeout(renderProfileExtras,0);
          return result;
        };
        wrapped.__v16Wrapped=true;
        renderViewedProfile=wrapped;
      }
    }catch{}

    try{
      if(typeof renderViewedFavorites==='function'&&!renderViewedFavorites.__v16Wrapped){
        const original=renderViewedFavorites;
        const wrapped=function(...args){
          const result=original.apply(this,args);
          setTimeout(renderProfileExtras,0);
          return result;
        };
        wrapped.__v16Wrapped=true;
        renderViewedFavorites=wrapped;
      }
    }catch{}

    setTimeout(renderProfileExtras,350);
    setTimeout(renderProfileExtras,900);

    window.addEventListener('focus',renderProfileExtras);
    window.addEventListener('pageshow',()=>setTimeout(renderProfileExtras,100));

    try{
      chatSupabase
        .channel('flix2watch-public-profile-roles-v16')
        .on(
          'postgres_changes',
          {event:'*',schema:'public',table:'profile_role_assignments'},
          ()=>setTimeout(renderPublicRoleBadges,100)
        )
        .subscribe();
    }catch{}
  }

  function boot(){
    removeCheckingScreens();
    applyTheme(savedTheme(),false);
    installProfileHooks();
  }

  const observer=new MutationObserver(removeCheckingScreens);
  observer.observe(document.documentElement,{subtree:true,childList:true});

  window.addEventListener('storage',event=>{
    if(event.key==='flix2watch_theme'||event.key==='josh_site_theme'){
      applyTheme(savedTheme(),false);
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  }else{
    boot();
  }
})();
