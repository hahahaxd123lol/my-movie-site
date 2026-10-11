
(() => {
  'use strict';

  window.toggleF2WMobileMenu=function(){
    document.querySelector('body.f2w-main-page > header')?.classList.toggle('mobile-open');
  };

  window.toggleF2WGenreMenu=function(event){
    event?.stopPropagation?.();
    const menu=document.getElementById('f2w-genre-menu');
    if(!menu)return;
    menu.classList.toggle('show');
  };

  window.openHeaderAuth=function(mode='login'){
    try{
      if(typeof showAccountMode==='function')showAccountMode(mode);
      if(typeof openAccountModal==='function')openAccountModal();
    }catch(error){
      console.warn('Could not open account modal:',error);
    }
  };

  function syncPrimaryNav(){
    const params=new URLSearchParams(window.location.search);
    const tab=params.get('tab');
    const path=window.location.pathname;

    document.querySelectorAll('.f2w-nav-link').forEach(link=>{
      link.classList.remove('active');
    });

    if(path.startsWith('/home/')){
      if(tab==='movie'){
        document.getElementById('f2w-nav-movies')?.classList.add('active');
      }else if(tab==='tv'){
        document.getElementById('f2w-nav-tv')?.classList.add('active');
      }else if(params.get('genre')){
        document.getElementById('f2w-nav-genres')?.classList.add('active');
      }else{
        document.getElementById('f2w-nav-home')?.classList.add('active');
      }
    }
  }

  document.addEventListener('click',event=>{
    const genre=document.getElementById('f2w-genre-menu');
    if(genre&&!event.target.closest('.f2w-genre-wrap')){
      genre.classList.remove('show');
    }
  });

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',syncPrimaryNav,{once:true});
  }else{
    syncPrimaryNav();
  }
})();
