
(() => {
  'use strict';

  let channel=null;
  const timers=new Map();

  function getClient(){
    try{
      if(typeof chatSupabase!=='undefined'&&chatSupabase)return chatSupabase;
    }catch{}
    try{
      if(typeof db!=='undefined'&&db)return db;
    }catch{}
    return window.__flix2watchAccountGuardClient||null;
  }

  function debounce(key,fn,delay=120){
    clearTimeout(timers.get(key));
    timers.set(key,setTimeout(()=>{
      timers.delete(key);
      try{fn?.()}catch(error){console.warn(`Realtime refresh failed: ${key}`,error)}
    },delay));
  }

  function refreshMain(table){
    if(table==='site_announcements'&&typeof window.loadSiteAnnouncement==='function'){
      debounce('announcement',window.loadSiteAnnouncement);
    }
    if(table==='site_settings'&&typeof window.loadPublicOpsConfig==='function'){
      debounce('site-settings',window.loadPublicOpsConfig);
    }
    if(table==='stream_source_status'&&typeof window.loadPublicStreamOperations==='function'){
      debounce('streams',window.loadPublicStreamOperations);
    }
    if(
      (table==='staff_collections'||table==='staff_collection_items'||table==='content_blocks')
      && typeof window.loadPublicContentOps==='function'
    ){
      debounce('public-content',window.loadPublicContentOps);
    }

    if(
      (table==='profiles'||table==='profile_follows'||table==='user_favorites')
      && typeof window.loadViewedProfile==='function'
    ){
      debounce('public-profile',window.loadViewedProfile,220);
    }

    if(
      table==='user_favorites'
      && typeof window.loadLibraryFavorites==='function'
    ){
      debounce('favorite-library',window.loadLibraryFavorites,180);
    }
  }

  function refreshStaff(table){
    if(typeof window.loadStats==='function'){
      debounce('staff-stats',window.loadStats,180);
    }

    const map={
      moderation_reports:'loadReports',
      stream_source_status:'loadSources',
      staff_collections:'loadCollections',
      staff_collection_items:'loadCollections',
      support_tickets:'loadTickets',
      support_ticket_messages:'loadTickets',
      site_settings:'loadSettings',
      staff_audit_log:'loadAudit',
      chat_bans:'loadLiveModeration',
      user_mutes:'loadLiveModeration',
      user_warnings:'loadLiveModeration',
      site_announcements:'loadAnnouncementHistory'
    };

    const fn=map[table];
    if(fn&&typeof window[fn]==='function'){
      debounce(`staff-${fn}`,window[fn],180);
    }

    window.dispatchEvent(new Event('flix2watch:ui-updated'));
  }

  function refreshSupport(table){
    if(
      (table==='support_tickets'||table==='support_ticket_messages')
      && typeof window.loadTickets==='function'
    ){
      debounce('support-tickets',window.loadTickets,120);
    }
  }

  function install(){
    const client=getClient();
    if(!client||channel)return;

    const tables=[
      'site_announcements',
      'site_settings',
      'stream_source_status',
      'staff_collections',
      'staff_collection_items',
      'content_blocks',
      'moderation_reports',
      'support_tickets',
      'support_ticket_messages',
      'staff_audit_log',
      'chat_bans',
      'user_mutes',
      'user_warnings'
    ];

    if(typeof window.loadViewedProfile==='function'){
      tables.push('profiles','profile_follows','user_favorites');
    }else if(typeof window.loadLibraryFavorites==='function'){
      tables.push('user_favorites');
    }

    channel=client.channel(`flix2watch-live-${Math.random().toString(36).slice(2)}`);

    for(const table of tables){
      channel=channel.on(
        'postgres_changes',
        {event:'*',schema:'public',table},
        ()=>{
          refreshMain(table);
          refreshStaff(table);
          refreshSupport(table);
        }
      );
    }

    channel.subscribe(status=>{
      const live=status==='SUBSCRIBED';
      document.documentElement.dataset.flixRealtime=live?'live':'connecting';

      const indicator=document.getElementById('staff-live-status');
      if(indicator){
        indicator.innerHTML=live
          ? '<i class="fa-solid fa-signal"></i> Realtime live'
          : '<i class="fa-solid fa-spinner fa-spin"></i> Connecting';
      }
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});
  }else{
    setTimeout(install,0);
  }
})();
