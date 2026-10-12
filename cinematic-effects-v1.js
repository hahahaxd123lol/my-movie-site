/* Flix2Watch cinematic interaction layer. No dependencies; gracefully degrades. */
(()=>{'use strict';
 if(window.__f2wCinemaMotionV1)return;window.__f2wCinemaMotionV1=true;
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const home=()=>document.body?.classList.contains('f2w-home-page');
 const init=()=>{
  if(!home())return;
  const hero=document.querySelector('#hero-banner');
  const grid=document.querySelector('#movie-grid');
  if(reduced){document.querySelectorAll('.movie-card,.section-header,.section-heading-row,.recent-section,.f2w-home-stage>section').forEach(e=>e.classList.add('f2w-cinema-visible'));return;}
  // A quiet, canvas-based film-dust layer: no images, no network, no click interception.
  let canvas=document.getElementById('f2w-cinema-atmosphere');
  if(!canvas){canvas=document.createElement('canvas');canvas.id='f2w-cinema-atmosphere';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);}
  const ctx=canvas.getContext('2d',{alpha:true});
  if(ctx){
   let w=0,h=0,dpr=1,raf=0,last=0,particles=[];
   const resize=()=>{dpr=Math.min(window.devicePixelRatio||1,1.5);w=window.innerWidth;h=window.innerHeight;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(dpr,0,0,dpr,0,0);const count=Math.min(44,Math.max(16,Math.round(w*h/32000)));particles=Array.from({length:count},()=>({x:Math.random()*w,y:Math.random()*h,r:.4+Math.random()*1.5,v:.12+Math.random()*.36,a:.12+Math.random()*.36,phase:Math.random()*6.28}));};
   const draw=t=>{raf=0;if(document.hidden)return;if(t-last<32){raf=requestAnimationFrame(draw);return;}last=t;ctx.clearRect(0,0,w,h);for(const p of particles){p.y-=p.v;p.x+=Math.sin(t*.00025+p.phase)*.16;if(p.y<-5){p.y=h+5;p.x=Math.random()*w;}if(p.x<-5)p.x=w+5;if(p.x>w+5)p.x=-5;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(255,105,120,'+p.a+')';ctx.fill();}raf=requestAnimationFrame(draw);};
   resize();raf=requestAnimationFrame(draw);window.addEventListener('resize',resize,{passive:true});document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(draw);});
  }
  // Scroll reveals are one-shot; elements remain visible if observer is unsupported.
  let observer=null;
  if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('f2w-cinema-visible');observer.unobserve(entry.target);}}),{threshold:.08,rootMargin:'0px 0px -35px 0px'});}
  const reveal=el=>{if(!el||el.dataset.f2wCinemaSeen)return;el.dataset.f2wCinemaSeen='1';el.classList.add('f2w-cinema-reveal');if(observer)observer.observe(el);else el.classList.add('f2w-cinema-visible');};
  const enhanceCards=root=>(root||document).querySelectorAll?.('.movie-card')?.forEach((card,i)=>{reveal(card);if(card.dataset.f2wCinemaPointer)return;card.dataset.f2wCinemaPointer='1';card.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=card.getBoundingClientRect();card.style.setProperty('--f2w-card-x',((e.clientX-r.left)/r.width*100)+'%');card.style.setProperty('--f2w-card-y',((e.clientY-r.top)/r.height*100)+'%');},{passive:true});card.addEventListener('pointerleave',()=>{card.style.setProperty('--f2w-card-x','50%');card.style.setProperty('--f2w-card-y','50%');},{passive:true});if(i<8)card.style.setProperty('--f2w-card-order',i);});
  document.querySelectorAll('.section-header,.section-heading-row,.recent-section,.catalog-pagination').forEach(reveal);
  enhanceCards();
  if(grid&&'MutationObserver'in window){let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceCards(grid);});}).observe(grid,{childList:true,subtree:true});}
  // Spotlight follows the pointer and nudges the hero backdrop, without moving its content.
  if(hero&&window.matchMedia('(hover:hover) and (pointer:fine)').matches){
   hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();const x=(e.clientX-r.left)/r.width;const y=(e.clientY-r.top)/r.height;hero.style.setProperty('--f2w-light-x',(x*100).toFixed(1)+'%');hero.style.setProperty('--f2w-light-y',(y*100).toFixed(1)+'%');hero.style.backgroundPosition=(50+(x-.5)*2.2)+'% '+(50+(y-.5)*2.2)+'%';},{passive:true});
   hero.addEventListener('pointerleave',()=>{hero.style.setProperty('--f2w-light-x','50%');hero.style.setProperty('--f2w-light-y','48%');hero.style.backgroundPosition='center';},{passive:true});
  }
  // When the featured film changes, briefly bloom the hero rather than hard-cutting.
  if(hero&&'MutationObserver'in window){let timer;new MutationObserver(()=>{hero.classList.remove('f2w-cinema-hero-change');void hero.offsetWidth;hero.classList.add('f2w-cinema-hero-change');clearTimeout(timer);timer=setTimeout(()=>hero.classList.remove('f2w-cinema-hero-change'),900);}).observe(hero,{attributes:true,attributeFilter:['style']});}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();