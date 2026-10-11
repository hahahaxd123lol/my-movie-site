
(() => {
  'use strict';

  window.protectMovieSearchField=function(field){
    if(!field)return;

    field.removeAttribute('readonly');
    field.type='search';
    field.inputMode='search';
    field.autocomplete='one-time-code';
    field.setAttribute('enterkeyhint','search');
    field.setAttribute('aria-autocomplete','none');
    field.setAttribute('data-form-type','search');
    field.setAttribute('data-lpignore','true');
    field.setAttribute('data-1p-ignore','true');
    field.setAttribute('data-bwignore','true');
    field.setAttribute('data-protonpass-ignore','true');
    field.setAttribute('data-keeper-ignore','true');

    if(!field.dataset.v22SearchName){
      field.dataset.v22SearchName='1';
      field.name=`title_lookup_${Date.now().toString(36)}`;
    }
  };

  function hardenMovieSearch(){
    const field=document.getElementById('movie-search');
    if(!field)return;

    field.type='search';
    field.autocomplete='one-time-code';
    field.inputMode='search';
    field.setAttribute('enterkeyhint','search');
    field.setAttribute('aria-autocomplete','none');
    field.setAttribute('data-form-type','search');
    field.setAttribute('data-lpignore','true');
    field.setAttribute('data-1p-ignore','true');
    field.setAttribute('data-bwignore','true');
    field.setAttribute('data-protonpass-ignore','true');
    field.setAttribute('data-keeper-ignore','true');
    field.setAttribute('readonly','');

    if(field.dataset.v22Guard==='1')return;
    field.dataset.v22Guard='1';

    const unlock=()=>window.protectMovieSearchField(field);

    field.addEventListener('pointerdown',unlock,{capture:true});
    field.addEventListener('touchstart',unlock,{capture:true,passive:true});
    field.addEventListener('focus',unlock,{capture:true});

    field.addEventListener('blur',()=>{
      setTimeout(()=>{
        if(document.activeElement!==field){
          field.setAttribute('readonly','');
          field.autocomplete='one-time-code';
        }
      },100);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',hardenMovieSearch,{once:true});
  }else{
    hardenMovieSearch();
  }
})();
