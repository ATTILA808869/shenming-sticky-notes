function mountLobbyBillboard(root,signal){
  const slideInterval=5000;
  const bar=document.createElement('div');bar.className='billboard-bar';
  const heading=document.createElement('h2');heading.id='lobby-view-title';heading.textContent='廟埕布告欄';
  const controls=document.createElement('div');controls.className='billboard-controls';controls.hidden=true;
  const button=(glyph,label,act)=>{
    const item=document.createElement('button');item.type='button';item.textContent=glyph;
    item.title=label;item.setAttribute('aria-label',label);item.onclick=act;controls.append(item);return item;
  };
  const count=document.createElement('span');count.className='billboard-count';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let pages=[],cursor=0,shown=null,switchId=0,switching=false,paused=reduced.matches,hovered=false,focused=false,timer,pending=false,signature='';
  const pictures=new Map();
  button('‹','上一張橫幅',()=>move(-1,true));
  controls.append(count);
  button('›','下一張橫幅',()=>move(1,true));
  const play=button('', '',()=>{paused=!paused;updatePlay();restart();});
  const link=document.createElement('a');link.className='billboard-link';link.target='_blank';link.rel='noopener noreferrer';link.hidden=true;
  const copy=document.createElement('div');copy.className='billboard-copy';
  const label=document.createElement('span'),title=document.createElement('strong'),out=document.createElement('span');
  out.textContent='↗';out.setAttribute('aria-hidden','true');
  const live=document.createElement('span');live.className='billboard-live';live.setAttribute('role','status');
  const feedback=document.createElement('p');feedback.setAttribute('role','status');feedback.textContent='載入公告中…';
  const retry=document.createElement('button');retry.type='button';retry.textContent='重新載入';retry.hidden=true;retry.onclick=()=>void refresh(true);
  copy.append(label,title,out);link.append(copy);bar.append(heading,controls);root.append(bar,feedback,retry,link,live);
  function updatePlay(){
    play.textContent=paused?'▶':'Ⅱ';play.title=paused?'播放輪播':'暫停輪播';
    play.setAttribute('aria-label',play.title);
  }
  const wrap=index=>(index+pages.length)%pages.length;
  function prepare(url,force=false){
    let picture=pictures.get(url);
    if(picture&&(!picture.failedAt||(!force&&Date.now()-picture.failedAt<15000))){
      pictures.delete(url);pictures.set(url,picture);
      return picture;
    }
    const image=document.createElement('img');image.alt='';image.decoding='async';
    image.width=1140;image.height=820;
    const loaded=new Promise(resolve=>{image.onload=()=>resolve(true);image.onerror=()=>resolve(false);});
    picture={image,ready:false,failedAt:0,promise:loaded.then(async ok=>{
      if(ok){
        try{await image.decode?.();}catch{/* A loaded image can still be rendered if decode is unavailable. */}
      }
      picture.ready=ok&&image.naturalWidth>0;
      if(!picture.ready)picture.failedAt=Date.now();
      return picture.ready;
    })};
    pictures.set(url,picture);
    image.src=url;
    return picture;
  }
  function show(index,announce=false,force=false){
    const token=++switchId;
    const page=pages[index];
    cursor=index;
    controls.hidden=pages.length<2;
    retry.hidden=true;
    if(!page){
      switching=false;shown=null;link.hidden=true;feedback.hidden=false;
      link.querySelector('img')?.remove();
      feedback.textContent='目前沒有刊登中的公告。';
      restart();return;
    }
    switching=true;restart();
    if(!shown){feedback.hidden=false;feedback.textContent='載入公告中…';}
    const picture=prepare(page.imageUrl,force);
    const nearby=new Set([page.imageUrl,shown?.imageUrl]);
    for(const step of [1,-1]){
      const url=pages[wrap(index+step)].imageUrl;
      if(!nearby.has(url)){nearby.add(url);prepare(url);}
    }
    for(const url of pictures.keys()){
      if(pictures.size<=6)break;
      if(!nearby.has(url))pictures.delete(url);
    }
    function finish(ready){
      if(token!==switchId||signal.aborted)return;
      switching=false;
      if(ready){
        // Insert the decoded element itself so no-store image responses are not fetched again.
        const current=link.querySelector('img');
        if(current!==picture.image){
          if(current)current.replaceWith(picture.image);
          else link.prepend(picture.image);
        }
        shown=page;
        link.href=page.targetUrl;link.setAttribute('aria-label',page.title+'（另開分頁）');
        label.textContent=page.kind==='ad'?'廣告':'公告';title.textContent=page.title;
        count.textContent=(index+1)+' / '+pages.length;
        feedback.hidden=true;link.hidden=false;
        if(announce)live.textContent='第 '+(index+1)+' 張：'+page.title;
      }else if(!shown){
        feedback.textContent='暫時無法載入橫幅。';retry.hidden=false;
      }else if(announce){
        live.textContent='暫時無法載入「'+page.title+'」。';
      }
      restart();
    }
    if(picture.ready)finish(true);
    else void picture.promise.then(finish);
  }
  function restart(){
    clearTimeout(timer);
    if(!signal.aborted&&!switching&&!paused&&!hovered&&!focused&&!document.hidden&&pages.length>1)timer=setTimeout(()=>move(1),slideInterval);
  }
  function move(step,announce=false){if(pages.length>1)show(wrap(cursor+step),announce);}
  async function refresh(force=false){
    if(pending||document.hidden||signal.aborted)return;
    pending=true;
    try{
      const response=await fetch('/games/nezha/api/billboard',{signal});
      if(!response.ok)throw new Error();
      const {rows}=await response.json();
      if(signal.aborted)return;
      const incoming=rows.filter(page=>page.imageUrl);
      const key=JSON.stringify(incoming);
      if(key===signature&&!force)return;
      const active=shown?.id??pages[cursor]?.id;
      const index=incoming.findIndex(page=>page.id===active);
      if(index<0){shown=null;link.hidden=true;count.textContent='';}
      signature=key;pages=incoming;
      show(Math.max(0,index),false,force);
    }catch{
      if(!signal.aborted&&!pages.length){feedback.textContent='暫時無法載入公告。';retry.hidden=false;}
    }
    finally{pending=false;}
  }
  root.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&!hovered){hovered=true;restart();}},{signal});
  root.addEventListener('pointerleave',()=>{hovered=false;restart();},{signal});
  root.addEventListener('focusin',()=>{focused=true;restart();},{signal});
  root.addEventListener('focusout',event=>{focused=root.contains(event.relatedTarget);restart();},{signal});
  root.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1,true);}
  },{signal});
  let point=null,swiped=0;
  link.ontouchstart=event=>{point=event.touches.length===1?event.touches[0]:null;swiped=0;};
  link.ontouchcancel=()=>{point=null;};
  link.ontouchend=event=>{
    if(!point)return;
    const {clientX,clientY}=event.changedTouches[0],dx=clientX-point.clientX,dy=clientY-point.clientY;
    point=null;
    if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(dy)*1.4&&pages.length>1){swiped=Date.now();move(dx<0?1:-1,true);}
  };
  link.onclick=event=>{if(Date.now()-swiped<400)event.preventDefault();};
  document.addEventListener('visibilitychange',()=>{restart();void refresh();},{signal});
  reduced.addEventListener('change',event=>{if(event.matches){paused=true;updatePlay();restart();}},{signal});
  const poll=setInterval(()=>void refresh(),30000);
  signal.addEventListener('abort',()=>{clearInterval(poll);clearTimeout(timer);},{once:true});
  updatePlay();void refresh();
}
