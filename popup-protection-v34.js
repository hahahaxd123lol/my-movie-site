
(() => {
  'use strict';

  /*
    V34 popup/new-tab protection for the Flix2Watch parent document.

    Important browser boundary:
    an UNSANDBOXED cross-origin provider iframe owns its own browsing context.
    The parent cannot monkey-patch that iframe's window.open() after it has
    navigated cross-origin. V33 therefore blocks every popup/new-tab path that
    Flix2Watch itself can control, hardens links/forms, and removes opener access.
    It does not use anti-adblock evasion.
  */

  const nativeOpen=window.open.bind(window);
  const nativeAnchorClick=HTMLAnchorElement.prototype.click;
  const nativeFormSubmit=HTMLFormElement.prototype.submit;

  const AUTH_HOSTS=new Set([
    'viqufxlcxwgboyxbdhjb.supabase.co',
    'accounts.google.com',
    'discord.com',
    'www.discord.com'
  ]);

  const AD_HOST_FRAGMENTS=[
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'adservice.google.',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'adsterra.com',
    'exoclick.com',
    'onclicka.com',
    'hilltopads.net',
    'trafficstars.com',
    'mgid.com',
    'taboola.com',
    'outbrain.com'
  ];

  function parseUrl(value){
    try{
      return new URL(String(value||''),location.href);
    }catch{
      return null;
    }
  }

  function safeDestination(value){
    const url=parseUrl(value);
    if(!url)return false;

    if(url.origin===location.origin)return true;
    if(AUTH_HOSTS.has(url.hostname.toLowerCase()))return true;

    return false;
  }

  function explicitAllowedElement(element){
    return Boolean(
      element
      &&element.dataset
      &&element.dataset.f2wAllowPopup==='true'
    );
  }

  function blockedAdDestination(value){
    const url=parseUrl(value);
    if(!url)return false;
    const host=url.hostname.toLowerCase();
    return AD_HOST_FRAGMENTS.some(fragment=>host===fragment||host.endsWith('.'+fragment)||host.includes(fragment));
  }

  function removeKnownAdNode(node){
    if(!node||node.nodeType!==1)return;

    const candidates=[];

    if(node.matches?.('script[src],iframe[src],img[src],link[href]')){
      candidates.push(node);
    }

    node.querySelectorAll?.('script[src],iframe[src],img[src],link[href]').forEach(el=>candidates.push(el));

    for(const el of candidates){
      const url=el.src||el.href||'';
      if(blockedAdDestination(url)){
        console.info('[Flix2Watch] Removed known parent-page ad resource:',url);
        el.remove();
      }
    }
  }

  function hardenOpenedWindow(opened){
    try{
      if(opened)opened.opener=null;
    }catch{}
    return opened;
  }

  window.open=function(url,target,features){
    if(safeDestination(url)){
      return hardenOpenedWindow(nativeOpen(url,target,features));
    }

    console.info('[Flix2Watch] Blocked parent-page popup/new tab:',url);
    return null;
  };

  // Block scripted .click() on external target=_blank anchors unless the
  // element is explicitly trusted (e.g. a user-pasted public-chat link).
  HTMLAnchorElement.prototype.click=function(){
    if(
      String(this.target||'').toLowerCase()==='_blank'
      &&!safeDestination(this.href)
      &&!explicitAllowedElement(this)
    ){
      console.info('[Flix2Watch] Blocked scripted external new-tab click:',this.href);
      return;
    }

    if(String(this.target||'').toLowerCase()==='_blank'){
      this.rel='noopener noreferrer';
      this.referrerPolicy='no-referrer';
    }

    return nativeAnchorClick.call(this);
  };

  // Prevent hidden/scripted external forms from opening pop-under tabs.
  HTMLFormElement.prototype.submit=function(){
    const target=String(this.target||'').toLowerCase();
    const action=this.action||location.href;

    if(target==='_blank'&&!safeDestination(action)&&!explicitAllowedElement(this)){
      console.info('[Flix2Watch] Blocked scripted external new-tab form:',action);
      return;
    }

    return nativeFormSubmit.call(this);
  };

  function protectAnchor(anchor){
    if(!anchor)return;

    if(String(anchor.target||'').toLowerCase()==='_blank'){
      const rel=new Set(String(anchor.rel||'').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      anchor.rel=[...rel].join(' ');
      anchor.referrerPolicy='no-referrer';
    }
  }

  function protectTree(root=document){
    root.querySelectorAll?.('a[target="_blank"]').forEach(protectAnchor);
  }

  // Trusted user clicks: normal internal/OAuth links work. External blank links
  // are blocked unless specifically whitelisted by Flix2Watch (chat links use it).
  document.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a');
    if(!anchor)return;

    protectAnchor(anchor);

    if(String(anchor.target||'').toLowerCase()!=='_blank')return;

    if(
      safeDestination(anchor.href)
      ||explicitAllowedElement(anchor)
    ){
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    console.info('[Flix2Watch] Blocked external popup/new-tab navigation:',anchor.href);
  },true);

  // Also cover middle-click / auxiliary opening.
  document.addEventListener('auxclick',event=>{
    const anchor=event.target.closest?.('a');
    if(!anchor)return;

    protectAnchor(anchor);

    if(
      String(anchor.target||'').toLowerCase()==='_blank'
      &&!safeDestination(anchor.href)
      &&!explicitAllowedElement(anchor)
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  // Cover normal form submission events with target=_blank.
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(!(form instanceof HTMLFormElement))return;

    if(
      String(form.target||'').toLowerCase()==='_blank'
      &&!safeDestination(form.action||location.href)
      &&!explicitAllowedElement(form)
    ){
      event.preventDefault();
      event.stopImmediatePropagation();
      console.info('[Flix2Watch] Blocked external popup form:',form.action);
    }
  },true);

  protectTree();
  removeKnownAdNode(document.documentElement);

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node?.nodeType!==1)continue;
        if(node.matches?.('a[target="_blank"]'))protectAnchor(node);
        protectTree(node);
        removeKnownAdNode(node);
      }
    }
  });

  observer.observe(document.documentElement,{
    childList:true,
    subtree:true
  });
})();

(() => {
  'use strict';
  let lastPlayerPointer=0;
  document.addEventListener('pointerdown',e=>{if(e.target.closest?.('.player-wrapper,.video-container,#video-frame'))lastPlayerPointer=Date.now()},true);
  window.addEventListener('blur',()=>{if(Date.now()-lastPlayerPointer<1800){setTimeout(()=>{try{window.focus()}catch{}},0)}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastPlayerPointer<5000){try{window.focus()}catch{}}});
})();
