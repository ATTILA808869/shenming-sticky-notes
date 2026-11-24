function mountLobbyBillboard(root,signal){
  const bar=document.createElement('div');bar.className='billboard-bar';
  const heading=document.createElement('h2');heading.id='lobby-view-title';heading.textContent='廟埕布告欄';
  const controls=document.createElement('div');controls.className='billboard-controls';controls.hidden=true;
  const button=(glyph,label,act)=>{
    const item=document.createElement('button');item.type='button';item.textContent=glyph;
    item.title=label;item.setAttribute('aria-label',label);item.onclick=act;controls.append(item);return item;
  };
  const count=document.createElement('span');count.className='billboard-count';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let pages=[],index=0,paused=reduced.matches,hovered=false,focused=false,timer,pending=false,signature='';
  const prev=button('‹','上一張橫幅',()=>move(-1));
  controls.append(count);
  const next=button('›','下一張橫幅',()=>move(1));
  const play=button('', '',()=>{paused=!paused;updatePlay();restart();});
  const link=document.createElement('a');link.className='billboard-link';link.target='_blank';link.rel='noopener noreferrer';link.hidden=true;
  const image=document.createElement('img');image.alt='';image.decoding='async';
  image.width=1140;image.height=820;
  const copy=document.createElement('div');copy.className='billboard-copy';
  const label=document.createElement('span'),title=document.createElement('strong'),out=document.createElement('span');
  out.textContent='↗';out.setAttribute('aria-hidden','true');
  const live=document.createElement('span');live.className='billboard-live';live.setAttribute('role','status');
  const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.textContent='載入公告中…';
  const retry=document.createElement('button');retry.type='button';retry.textContent='重新載入';retry.hidden=true;retry.onclick=()=>void refresh();
  copy.append(label,title,out);link.append(image,copy);bar.append(heading,controls);root.append(bar,feedback,retry,link,live);
  function updatePlay(){
    play.textContent=paused?'▶':'Ⅱ';play.title=paused?'播放輪播':'暫停輪播';
    play.setAttribute('aria-label',play.title);
  }
  function draw(announce=false){
    const page=pages[index];link.hidden=!page;controls.hidden=pages.length<2;
    feedback.hidden=Boolean(page);retry.hidden=true;
    if(!page)feedback.textContent='目前沒有刊登中的公告。';
    if(!page)return;
    link.href=page.targetUrl;link.setAttribute('aria-label',page.title+'（另開分頁）');
    if(image.getAttribute('src')!==page.imageUrl)image.src=page.imageUrl;
    label.textContent=page.kind==='ad'?'廣告':'公告';title.textContent=page.title;
    count.textContent=(index+1)+' / '+pages.length;
    if(announce)live.textContent='第 '+(index+1)+' 張：'+page.title;
  }
  function restart(){
    clearTimeout(timer);
    if(!signal.aborted&&!paused&&!hovered&&!focused&&!document.hidden&&pages.length>1)timer=setTimeout(()=>{index=(index+1)%pages.length;draw();restart();},7000);
  }
  function move(step){if(pages.length>1){index=(index+step+pages.length)%pages.length;draw(true);restart();}}
  async function refresh(){
    if(pending||document.hidden||signal.aborted)return;
    pending=true;
    try{
      const response=await fetch('/games/nezha/api/billboard',{signal});
      if(!response.ok)throw new Error();
      const {rows}=await response.json();
      if(signal.aborted)return;
      const incoming=rows.filter(page=>page.imageUrl);
      const key=JSON.stringify(incoming);
      if(key===signature)return;
      const active=pages[index]?.id;signature=key;pages=incoming;
      index=Math.max(0,pages.findIndex(page=>page.id===active));draw();restart();
    }catch{
      if(!signal.aborted&&!pages.length){feedback.textContent='暫時無法載入公告。';retry.hidden=false;}
    }
    finally{pending=false;}
  }
  root.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){hovered=true;restart();}},{signal});
  root.addEventListener('pointerleave',()=>{hovered=false;restart();},{signal});
  root.addEventListener('focusin',()=>{focused=true;restart();},{signal});
  root.addEventListener('focusout',event=>{focused=root.contains(event.relatedTarget);restart();},{signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}
  },{signal});
  let point=null,swiped=0;
  link.ontouchstart=event=>{point=event.touches.length===1?event.touches[0]:null;swiped=0;};
  link.ontouchcancel=()=>{point=null;};
  link.ontouchend=event=>{
    if(!point)return;
    const {clientX,clientY}=event.changedTouches[0],dx=clientX-point.clientX,dy=clientY-point.clientY;
    point=null;
    if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.4&&pages.length>1){swiped=Date.now();move(dx<0?1:-1);}
  };
  link.onclick=event=>{if(Date.now()-swiped<400)event.preventDefault();};
  document.addEventListener('visibilitychange',()=>{restart();void refresh();},{signal});
  reduced.addEventListener('change',event=>{if(event.matches){paused=true;updatePlay();restart();}},{signal});
  const poll=setInterval(refresh,30000);
  signal.addEventListener('abort',()=>{clearInterval(poll);clearTimeout(timer);},{once:true});
  updatePlay();void refresh();
}
