(()=>{
  'use strict';
  const MARK='f2w-red-button-v154';
  const ICON='f2w-red-icon-button-v154';
  let seen=new WeakSet();
  const parseRgb=(s)=>{
    const m=String(s||'').match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+))?/i);
    return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]==null?1:+m[4]}:null;
  };
  const looksRed=(el)=>{
    let cs;
    try{cs=getComputedStyle(el)}catch(_){return false}
    const bg=parseRgb(cs.backgroundColor);
    const border=parseRgb(cs.borderTopColor);
    const red=(c)=>c&&c.a>.16&&c.r>=145&&c.r>=c.g*1.45&&c.r>=c.b*1.25;
    if(red(bg)) return true;
    if(/linear-gradient|radial-gradient/i.test(cs.backgroundImage||'')){
      const nums=(cs.backgroundImage.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/ig)||[]);
      for(const token of nums){
        if(token[0]==='#'){
          let h=token.slice(1); if(h.length===3)h=h.split('').map(x=>x+x).join('');
          const c=h.length>=6?{r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1}:null;
          if(red(c)) return true;
        }else if(red(parseRgb(token))) return true;
      }
    }
    return red(border)&&bg&&bg.a>.15&&bg.r>70;
  };
  const isControl=(el)=>el instanceof HTMLElement && (el.matches('button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,a.button,[role="button"]'));
  const process=(el)=>{
    if(!isControl(el)||seen.has(el)) return;
    seen.add(el);
    if(!looksRed(el)) return;
    el.classList.add(MARK);
    const text=(el.textContent||el.value||'').trim();
    if(text.length<=2 || el.getAttribute('aria-label')&&text.length===0) el.classList.add(ICON);
  };
  const scan=(root=document)=>{
    if(root instanceof Element) process(root);
    root.querySelectorAll?.('button,input[type="button"],input[type="submit"],input[type="reset"],a.btn,a.button,[role="button"]').forEach(process);
  };
  const start=()=>{
    scan(document);
    const mo=new MutationObserver(ms=>{
      for(const m of ms) for(const n of m.addedNodes) if(n.nodeType===1) scan(n);
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
    // Some pages change button classes/styles after auth/data loads.
    setTimeout(()=>{seen=new WeakSet();scan(document)},1200);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
