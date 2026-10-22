/* Progressive reading aids. The complete guide and contents work without JS. */
(() => {
 const page=document.querySelector('.reader-page');
 if(!page)return;
 const body=page.querySelector('.article-body');
 if(!body)return;
 const progress=page.querySelector('.reader-progress span');
 const links=Array.from(page.querySelectorAll('.reader-contents a'));
 const headings=Array.from(body.querySelectorAll('h2[id]'));
 if(!headings.length)return;
 let queued=false;
 function update(){
  queued=false;
  const rect=body.getBoundingClientRect();
  const distance=Math.max(1,rect.height-window.innerHeight*.5);
  const ratio=Math.min(1,Math.max(0,-rect.top/distance));
  if(progress)progress.style.width=`${ratio*100}%`;
  let active=headings[0].id;
  for(const heading of headings){if(heading.getBoundingClientRect().top<=130)active=heading.id;}
  for(const link of links){
   if(link.hash===`#${active}`)link.setAttribute('aria-current','location');
   else link.removeAttribute('aria-current');
  }
 }
 function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
 // Legacy layouts may scroll the body rather than the window.
 document.addEventListener('scroll',schedule,{passive:true,capture:true});
 window.addEventListener('resize',schedule);
 for(const link of links)link.addEventListener('click',()=>{
  const menu=link.closest('.reader-mobile-contents');
  if(menu)menu.open=false;
 });
 update();
})();
