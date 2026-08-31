
(() => {
  'use strict';

  function isPlainEnter(event){
    return event.key==='Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
  }

  async function activateFirstUserResult(input){
    if(typeof window.searchUsersLive==='function'){
      try{ await window.searchUsersLive(input.value); }catch{}
    }
    const first=document.querySelector('#user-search-results .user-search-result');
    if(first)first.click();
  }

  function scrollToHomeResults(){
    const target=document.getElementById('v15-movie-search-section')
      || document.getElementById('section-title')
      || document.getElementById('movie-grid');
    if(!target)return;
    const header=document.querySelector('header');
    const top=target.getBoundingClientRect().top+window.scrollY-(header?.offsetHeight||0)-14;
    window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
  }

  function activateMovieSearch(input){
    const value=String(input.value||'').trim();

    if(typeof window.searchMediaWatch==='function'){
      const box=document.getElementById('watch-search-results');
      const first=box?.querySelector('.watch-search-result');

      if(first){
        first.click();
        return;
      }

      let finished=false;
      const observer=box
        ? new MutationObserver(()=>{
            const result=box.querySelector('.watch-search-result');
            if(result&&!finished){
              finished=true;
              observer.disconnect();
              result.click();
            }
          })
        : null;

      if(observer){
        observer.observe(box,{childList:true,subtree:true});
        setTimeout(()=>{
          if(!finished){
            finished=true;
            observer.disconnect();
          }
        },3500);
      }

      window.searchMediaWatch(value);
      return;
    }

    if(typeof window.searchMedia==='function'){
      window.searchMedia(value);
      scrollToHomeResults();
    }
  }

  function bindOnce(element,key,handler){
    if(!element)return;
    const marker=`f2wBound${key}`;
    if(element.dataset[marker]==='1')return;
    element.dataset[marker]='1';
    handler(element);
  }

  function installMainEnterActions(){
    const movieSearch=document.getElementById('search');
    if(movieSearch&&movieSearch.dataset.f2wEnterMovie!=='1'){
      movieSearch.dataset.f2wEnterMovie='1';
      movieSearch.enterKeyHint='search';
      movieSearch.addEventListener('keydown',event=>{
        if(!isPlainEnter(event))return;
        event.preventDefault();
        activateMovieSearch(movieSearch);
        movieSearch.blur();
      });
    }

    const userSearch=document.getElementById('user-search');
    if(userSearch&&userSearch.dataset.f2wEnterUser!=='1'){
      userSearch.dataset.f2wEnterUser='1';
      userSearch.enterKeyHint='search';
      userSearch.addEventListener('keydown',event=>{
        if(!isPlainEnter(event)||event.isComposing)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if(typeof window.submitUserDirectorySearch==='function'){
          window.submitUserDirectorySearch(userSearch.value);
        }else{
          const clean=String(userSearch.value||'').trim().replace(/[^A-Za-z0-9]/g,'');
          if(clean)window.location.href=`/users/?q=${encodeURIComponent(clean)}&page=1`;
        }
      },true);
    }

    const favoriteSearch=document.getElementById('favorite-search');
    if(favoriteSearch&&favoriteSearch.dataset.f2wEnterFavorite!=='1'){
      favoriteSearch.dataset.f2wEnterFavorite='1';
      favoriteSearch.enterKeyHint='search';
      favoriteSearch.addEventListener('keydown',event=>{
        if(!isPlainEnter(event))return;
        event.preventDefault();
        if(typeof window.renderFavorites==='function')window.renderFavorites();
        if(typeof window.renderLibraryFavorites==='function')window.renderLibraryFavorites();
        favoriteSearch.blur();
      });
    }

    const chatInput=document.getElementById('chat-message-input');
    if(chatInput&&chatInput.dataset.f2wEnterChat!=='1'){
      chatInput.dataset.f2wEnterChat='1';
      chatInput.enterKeyHint='send';
      chatInput.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        event.stopPropagation();
        if(typeof window.sendChatMessage==='function')window.sendChatMessage();
      });
    }

    ['account-email','account-password','account-confirm','account-username'].forEach(id=>{
      const input=document.getElementById(id);
      if(!input||input.dataset.f2wEnterAuth==='1')return;
      input.dataset.f2wEnterAuth='1';
      input.enterKeyHint=id==='account-password'||id==='account-confirm'?'go':'next';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        if(typeof window.submitAccountAuth==='function')window.submitAccountAuth();
      });
    });

    const changeUsername=document.getElementById('account-change-username');
    if(changeUsername&&changeUsername.dataset.f2wEnterUsername!=='1'){
      changeUsername.dataset.f2wEnterUsername='1';
      changeUsername.enterKeyHint='done';
      changeUsername.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        if(typeof window.changeFlix2WatchUsername==='function')window.changeFlix2WatchUsername();
      });
    }
  }

  function installStaffEnterActions(){
    const map=[
      ['user-target','inspectUser'],
      ['slow-seconds','setSlowMode'],
      ['pin-message-id','pinChat'],
      ['collection-name','createCollection'],
      ['collection-description','createCollection'],
      ['collection-order','createCollection'],
      ['block-id','setContentBlock',true],
      ['block-reason','setContentBlock',true]
    ];

    for(const [id,fn,arg] of map){
      const input=document.getElementById(id);
      if(!input||input.dataset.f2wEnterStaff==='1')continue;
      input.dataset.f2wEnterStaff='1';
      input.enterKeyHint='done';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        const action=window[fn];
        if(typeof action==='function')action(arg);
      });
    }

    document.querySelectorAll('[id^="src-priority-"],[id^="src-notice-"]').forEach(input=>{
      if(input.dataset.f2wEnterSource==='1')return;
      input.dataset.f2wEnterSource='1';
      input.enterKeyHint='done';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        const prefix=input.id.startsWith('src-priority-')?'src-priority-':'src-notice-';
        const name=input.id.slice(prefix.length);
        if(typeof window.saveSource==='function')window.saveSource(name);
      });
    });


    document.querySelectorAll('[id^="ci-id-"]').forEach(input=>{
      if(input.dataset.f2wEnterLookup==='1')return;
      input.dataset.f2wEnterLookup='1';
      input.enterKeyHint='search';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event)||event.isComposing)return;
        event.preventDefault();
        const id=input.id.slice('ci-id-'.length);
        if(typeof window.lookupCollectionItem==='function')window.lookupCollectionItem(id);
      });
    });

    document.querySelectorAll('[id^="ci-title-"],[id^="ci-poster-"]').forEach(input=>{
      if(input.dataset.f2wEnterCollectionItem==='1')return;
      input.dataset.f2wEnterCollectionItem='1';
      input.enterKeyHint='done';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event)||event.isComposing)return;
        event.preventDefault();
        const prefix=input.id.startsWith('ci-title-')?'ci-title-':'ci-poster-';
        const id=input.id.slice(prefix.length);
        if(typeof window.addCollectionItem==='function')window.addCollectionItem(id);
      });
    });

    document.querySelectorAll('[id^="collection-name-"],[id^="collection-description-"],[id^="collection-sort-"]').forEach(input=>{
      if(input.dataset.f2wEnterCollectionSettings==='1')return;
      input.dataset.f2wEnterCollectionSettings='1';
      input.enterKeyHint='done';
      input.addEventListener('keydown',event=>{
        if(!isPlainEnter(event)||event.isComposing)return;
        event.preventDefault();
        let id='';
        for(const prefix of ['collection-name-','collection-description-','collection-sort-']){
          if(input.id.startsWith(prefix)){id=input.id.slice(prefix.length);break}
        }
        if(id&&typeof window.updateCollectionSettings==='function'){
          window.updateCollectionSettings(id);
        }
      });
    });

    const announcement=document.getElementById('announcement-message');
    if(announcement&&announcement.dataset.f2wEnterAnnouncement!=='1'){
      announcement.dataset.f2wEnterAnnouncement='1';
      announcement.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
          event.preventDefault();
          if(typeof window.publishAnnouncement==='function')window.publishAnnouncement();
        }
      });
    }

    const maintenance=document.getElementById('maintenance-message');
    if(maintenance&&maintenance.dataset.f2wEnterMaintenance!=='1'){
      maintenance.dataset.f2wEnterMaintenance='1';
      maintenance.addEventListener('keydown',event=>{
        if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){
          event.preventDefault();
          if(typeof window.saveMaintenance==='function')window.saveMaintenance();
        }
      });
    }
  }

  function installSupportEnterActions(){
    const subject=document.getElementById('ticket-subject');
    const message=document.getElementById('ticket-message');

    if(subject&&subject.dataset.f2wEnterSubject!=='1'){
      subject.dataset.f2wEnterSubject='1';
      subject.enterKeyHint='next';
      subject.addEventListener('keydown',event=>{
        if(!isPlainEnter(event) || event.isComposing)return;
        event.preventDefault();
        message?.focus();
      });
    }

    if(message&&message.dataset.f2wEnterSupport!=='1'){
      message.dataset.f2wEnterSupport='1';
      message.enterKeyHint='send';
      message.addEventListener('keydown',event=>{
        if(
          event.key==='Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.isComposing
        ){
          event.preventDefault();
          if(typeof window.createTicket==='function')window.createTicket();
        }
      });
    }

    document.querySelectorAll('textarea[id^="reply-"]').forEach(input=>{
      if(input.dataset.f2wEnterTicketReply==='1')return;
      input.dataset.f2wEnterTicketReply='1';
      input.enterKeyHint='send';
      input.addEventListener('keydown',event=>{
        if(
          event.key==='Enter' &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.isComposing
        ){
          event.preventDefault();
          const id=input.id.slice('reply-'.length);
          if(typeof window.reply==='function')window.reply(id);
        }
      });
    });
  }


  function installTvNavigation(){
    document.querySelectorAll('.recent-card:not([tabindex])').forEach(card=>{
      card.tabIndex=0;
      card.setAttribute('role','link');
      card.addEventListener('keydown',event=>{
        if(event.key==='Enter'){
          event.preventDefault();
          card.click();
        }
      });
    });
  }

  function spatialFocus(event){
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;

    const active=document.activeElement;
    if(!active||active===document.body)return;

    const container=active.closest(
      '.movie-grid,.favorites-grid,.library-grid,.staff-collection-row,.recent-strip,.f2w-shelf-track'
    );
    if(!container)return;

    const focusables=[...container.querySelectorAll(
      'a[href],button:not([disabled]),[tabindex="0"]'
    )].filter(el=>el.offsetParent!==null);

    if(focusables.length<2)return;

    const current=active.getBoundingClientRect();
    const cx=current.left+current.width/2;
    const cy=current.top+current.height/2;

    const candidates=focusables
      .filter(el=>el!==active)
      .map(el=>{
        const rect=el.getBoundingClientRect();
        const x=rect.left+rect.width/2;
        const y=rect.top+rect.height/2;
        const dx=x-cx;
        const dy=y-cy;

        let primary=Infinity;
        let secondary=Infinity;

        if(event.key==='ArrowRight'&&dx>4){primary=dx;secondary=Math.abs(dy)}
        if(event.key==='ArrowLeft'&&dx<-4){primary=-dx;secondary=Math.abs(dy)}
        if(event.key==='ArrowDown'&&dy>4){primary=dy;secondary=Math.abs(dx)}
        if(event.key==='ArrowUp'&&dy<-4){primary=-dy;secondary=Math.abs(dx)}

        return {el,score:primary*10+secondary};
      })
      .filter(item=>Number.isFinite(item.score))
      .sort((a,b)=>a.score-b.score);

    if(candidates[0]){
      event.preventDefault();
      candidates[0].el.focus({preventScroll:true});
      candidates[0].el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});
    }
  }

  function install(){
    installMainEnterActions();
    installStaffEnterActions();
    installSupportEnterActions();
    installTvNavigation();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',install,{once:true});
  }else{
    install();
  }

  // Dynamic staff/source rows can be re-rendered after load.
  window.addEventListener('flix2watch:ui-updated',install);
  document.addEventListener('keydown',spatialFocus);

  const observer=new MutationObserver(()=>{
    clearTimeout(window.__flix2watchEnterMutationTimer);
    window.__flix2watchEnterMutationTimer=setTimeout(install,80);
  });

  if(document.body){
    observer.observe(document.body,{childList:true,subtree:true});
  }else{
    document.addEventListener('DOMContentLoaded',()=>{
      observer.observe(document.body,{childList:true,subtree:true});
    },{once:true});
  }
})();
