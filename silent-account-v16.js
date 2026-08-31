
(() => {
  'use strict';

  const staleSelectors=[
    '#f2w-auth-checking',
    '.f2w-auth-checking',
    '#flix2watch-account-check',
    '.flix2watch-account-check',
    '.account-checking-overlay',
    '.checking-account-overlay'
  ];

  function removeStaleCheckingUI(root=document){
    for(const selector of staleSelectors){
      root.querySelectorAll?.(selector)?.forEach(node=>node.remove());
    }

    root.querySelectorAll?.('body > div,body > section,body > aside')?.forEach(node=>{
      const text=String(node.textContent||'').trim().toLowerCase();
      if(
        text.startsWith('checking your flix2watch account') ||
        text==='checking your flix2watch account…' ||
        text==='checking your flix2watch account...'
      ){
        node.remove();
      }
    });
  }

  removeStaleCheckingUI();

  if(document.documentElement){
    document.documentElement.classList.add('f2w-silent-account-check');
  }

  const observer=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(!(node instanceof Element))continue;

        const text=String(node.textContent||'').trim().toLowerCase();
        if(
          node.matches?.(staleSelectors.join(',')) ||
          text.startsWith('checking your flix2watch account')
        ){
          node.remove();
          continue;
        }

        removeStaleCheckingUI(node);
      }
    }
  });

  observer.observe(document.documentElement,{subtree:true,childList:true});

  // The account guard continues to verify ban/account state silently in the
  // background. This only removes obsolete visual preflight/checking screens.
  window.addEventListener('flix2watch:account-state',()=>{
    removeStaleCheckingUI();
  });
})();
