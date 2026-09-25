(function(){
const ROOMS={
 hol:{w:300,l:160,op:[{id:'door-1',k:'door',wall:'N',o:10,d:90},{id:'window-1',k:'win',wall:'S',o:140,d:100},{id:'radiator-1',k:'rad',wall:'E',o:50,d:20}]},
 living:{w:420,l:380,op:[{id:'window-1',k:'win',wall:'N',o:30,d:80},{id:'window-2',k:'win',wall:'N',o:170,d:80},{id:'door-1',k:'door',wall:'S',o:300,d:80},{id:'socket-1',k:'sock',wall:'E',o:190}]}
};
const FUR={
 living:[
  {id:1,n:'Sofa, 3-seat linen',x:0,y:100,w:90,d:210,c:'#b9a58a',p:890,t:'anchor'},
  {id:2,n:'Wool rug, flatweave',x:100,y:90,w:200,d:230,c:'#e2cfae',p:240,t:'mid',rug:1},
  {id:3,n:'Coffee table, oak',x:150,y:165,w:60,d:100,c:'#a57a52',p:180,t:'mid'},
  {id:4,n:'TV unit, walnut',x:375,y:110,w:45,d:160,c:'#6b4a32',p:320,t:'anchor'},
  {id:5,n:'Armchair, clay bouclé',x:255,y:20,w:80,d:80,c:'#c8794a',p:290,t:'mid'},
  {id:6,n:'Floor lamp, paper shade',x:20,y:20,w:40,d:40,c:'#efe3cf',p:95,t:'swappable',round:1},
  {id:7,n:'Low bookshelf',x:40,y:345,w:180,d:35,c:'#8a6a4a',p:210,t:'anchor'},
  {id:8,n:'Fiddle-leaf fig',x:370,y:20,w:40,d:40,c:'#5d6b3c',p:45,t:'swappable',round:1}
 ],
 hol:[
  {id:1,n:'Slim bench, oak',x:10,y:120,w:110,d:35,c:'#a57a52',p:160,t:'mid'},
  {id:2,n:'Shoe cabinet',x:190,y:130,w:90,d:30,c:'#6b4a32',p:140,t:'anchor'},
  {id:3,n:'Coat hooks',x:150,y:0,w:60,d:8,c:'#2b2622',p:35,t:'swappable'}
 ]
};
const TH={wall:'#2b2622',ww:5,dim:'#5a6e82',win:'#dbe6ee',arc:'#c8794a',sel:'#c8794a'};
function plan(r,o){
 o=Object.assign({W:440,H:260,P:46,dims:true,compass:true,fur:null,sel:null,labels:true},o||{});
 const t=TH,s=Math.min((o.W-o.P*2)/r.w,(o.H-o.P*2)/r.l),W=r.w*s,L=r.l*s,ox=(o.W-W)/2,oy=(o.H-L)/2,len=2*(W+L);
 let g=`<svg viewBox="0 0 ${o.W} ${o.H}" width="100%" style="display:block;max-height:${o.maxH||'none'}">`;
 g+=`<rect x="${ox}" y="${oy}" width="${W}" height="${L}" fill="rgba(255,250,240,.55)"/>`;
 (o.fur||[]).forEach((f,i)=>{
  const x=ox+f.x*s,y=oy+f.y*s,w=f.w*s,d=f.d*s,st=`style="animation-delay:${.6+i*.06}s"`;
  const common=`class="fur" data-item="${f.id}" ${st}`;
  if(f.round)g+=`<circle ${common} cx="${x+w/2}" cy="${y+d/2}" r="${w/2}" fill="${f.c}" stroke="#2b2622" stroke-width="1.2"/>`;
  else g+=`<rect ${common} x="${x}" y="${y}" width="${w}" height="${d}" fill="${f.c}" fill-opacity="${f.rug?.55:.85}" stroke="#2b2622" stroke-width="${f.rug?.8:1.2}" ${f.rug?'stroke-dasharray="3 3"':''}/>`;
  if(o.labels&&!f.rug&&w>16)g+=`<text x="${x+w/2}" y="${y+d/2+4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="${Math.max(9,Math.min(12,s*28))}" fill="${f.c==='#6b4a32'||f.c==='#2b2622'||f.c==='#5d6b3c'?'#fbf6ec':'#2b2622'}" pointer-events="none">${f.id}</text>`;
 });
 g+=`<rect x="${ox+2}" y="${oy-1.5}" width="${W-1}" height="${L+2}" fill="none" stroke="${t.wall}" stroke-width="1" opacity=".35"/>`;
 g+=`<rect class="wall" style="--len:${len}" x="${ox}" y="${oy}" width="${W}" height="${L}" fill="none" stroke="${t.wall}" stroke-width="${t.ww}" stroke-linejoin="round"/>`;
 r.op.forEach(p=>{
  const a=p.o*s,d=(p.d||0)*s,h=t.ww+3,sel=o.sel===p.id,col=sel?t.sel:t.wall;
  if(p.k==='win'||p.k==='door'){
   const y=p.wall==='N'?oy-h/2:oy+L-h/2,x=ox+a;
   g+=`<rect x="${x}" y="${y}" width="${d}" height="${h}" fill="${p.k==='win'?(sel?'#f6d9c3':t.win):'#fbf6ec'}" ${p.k==='win'?`stroke="${col}" stroke-width="${sel?2:1}"`:''}/>`;
   if(p.k==='win')g+=`<line x1="${x}" x2="${x+d}" y1="${y+h/2}" y2="${y+h/2}" stroke="${col}" stroke-width=".8"/>`;
   else if(p.wall==='N'){g+=`<line x1="${x}" y1="${oy}" x2="${x}" y2="${oy+d}" stroke="${col}" stroke-width="2.5"/><path d="M${x+d} ${oy} A${d} ${d} 0 0 1 ${x} ${oy+d}" fill="none" stroke="${t.arc}" stroke-width="${sel?2:1.4}" stroke-dasharray="4 3"/>`}
   else{const hx=x+d,hy=oy+L;g+=`<line x1="${hx}" y1="${hy}" x2="${hx}" y2="${hy-d}" stroke="${col}" stroke-width="2.5"/><path d="M${hx-d} ${hy} A${d} ${d} 0 0 1 ${hx} ${hy-d}" fill="none" stroke="${t.arc}" stroke-width="${sel?2:1.4}" stroke-dasharray="4 3"/>`}
   if(sel)g+=`<rect x="${x-4}" y="${y-4}" width="${d+8}" height="${h+8}" fill="none" stroke="${t.sel}" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="${x}" cy="${y+h/2}" r="5" fill="${t.sel}"/><circle cx="${x+d}" cy="${y+h/2}" r="5" fill="${t.sel}"/>`;
  }
  if(p.k==='rad')g+=`<rect x="${ox+W-t.ww/2-9}" y="${oy+a}" width="6" height="${Math.max(d,14)}" fill="${sel?t.sel:'#c8794a'}" rx="1"/>`;
  if(p.k==='sock')g+=`<circle cx="${ox+W-t.ww/2-6}" cy="${oy+a}" r="4" fill="${t.arc}"/>`;
 });
 if(o.dims){
  const fs=o.fs||11,tx=(x,y,txt,rot)=>`<text x="${x}" y="${y}" fill="${t.dim}" font-family="IBM Plex Mono" font-size="${fs}" text-anchor="middle" ${rot?`transform="rotate(${rot} ${x} ${y})"`:''}>${txt}</text>`;
  const ln=(x1,y1,x2,y2)=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${t.dim}" stroke-width=".8"/>`+[[x1,y1],[x2,y2]].map(([x,y])=>`<line x1="${x-3}" y1="${y+3}" x2="${x+3}" y2="${y-3}" stroke="${t.dim}"/>`).join('');
  g+=ln(ox,oy-24,ox+W,oy-24)+tx(ox+W/2,oy-29,`${r.w} · N`);
  g+=ln(ox,oy+L+22,ox+W,oy+L+22)+tx(ox+W/2,oy+L+36,`${r.w} · S`);
  g+=ln(ox-22,oy,ox-22,oy+L)+tx(ox-28,oy+L/2,`${r.l} · W`,-90);
  g+=ln(ox+W+22,oy,ox+W+22,oy+L)+tx(ox+W+30,oy+L/2,`${r.l} · E`,90);
 }
 if(o.compass){const cx=o.W-22,cy=24;g+=`<circle cx="${cx}" cy="${cy}" r="14" fill="none" stroke="${t.dim}" stroke-width=".8"/><path d="M${cx} ${cy-11} L${cx+4} ${cy+2} L${cx} ${cy} L${cx-4} ${cy+2}Z" fill="${t.arc}"/><text x="${cx}" y="${cy-17}" font-size="9" text-anchor="middle" fill="${t.dim}" font-family="IBM Plex Mono">N</text>`}
 return g+'</svg>';
}
function drawAll(root){
 (root||document).querySelectorAll('[data-plan]').forEach(el=>{
  const k=el.dataset.plan,r=ROOMS[k]||JSON.parse(el.dataset.room||'null');if(!r)return;
  const opt=JSON.parse(el.dataset.opt||'{}');
  if(el.dataset.fur)opt.fur=FUR[el.dataset.fur];
  el.innerHTML=plan(r,opt);
 });
}
window.RP={ROOMS,FUR,plan,drawAll};

/* router */
const NAVMAP={apartments:'apartments',overview:'apartments',newroom:'apartments',editor:'apartments',design:'apartments',library:'library',moodboard:'moodboard',settings:'settings'};
function go(){
 const id=(location.hash.slice(1)||'apartments').split('?')[0];
 const target=document.querySelector(`section.screen[data-id="${id}"]`)||document.querySelector('section.screen');
 document.querySelectorAll('section.screen').forEach(s=>s.classList.toggle('on',s===target));
 document.querySelectorAll('.nav nav a').forEach(a=>a.classList.toggle('on',a.dataset.nav===NAVMAP[target.dataset.id]));
 drawAll(target);
 window.scrollTo(0,0);
 try{localStorage.setItem('rp-atelier-screen',target.dataset.id)}catch(e){}
}
window.addEventListener('hashchange',go);
document.addEventListener('DOMContentLoaded',()=>{
 if(!location.hash){try{const s=localStorage.getItem('rp-atelier-screen');if(s)location.hash=s}catch(e){}}
 go();wire();
});

function wire(){
 const $=(s,r)=>(r||document).querySelector(s),$$=(s,r)=>[...(r||document).querySelectorAll(s)];
 /* single-select groups */
 $$('[data-group]').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!g.contains(b))return;$$('button',g).forEach(x=>x.classList.toggle('on',x===b));}));
 $$('[data-multi]').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(b)b.classList.toggle('on')}));
 $$('.sw-t').forEach(t=>t.addEventListener('click',()=>t.classList.toggle('on')));
 /* new room live preview */
 const nr=$('#nr-form');
 if(nr){const upd=()=>{const w=+$('#nr-w').value||0,l=+$('#nr-l').value||0,el=$('#nr-plan');el.dataset.room=JSON.stringify({w:Math.max(w,50),l:Math.max(l,50),op:[]});drawAll(el.parentNode);$('#nr-area').textContent=(w*l/10000).toFixed(2).replace('.',',')+' m²';};
  nr.addEventListener('input',upd);upd();
  const bud=$('#nr-budget');bud.addEventListener('input',()=>$('#nr-bv').textContent='€ '+(+bud.value).toLocaleString('en'));}
 /* editor */
 const ed=$('#editor-plan');
 if(ed){let sel='door-1';const room=JSON.parse(JSON.stringify(ROOMS.hol));
  const draw=()=>{ed.innerHTML=plan(room,{W:720,H:440,P:70,sel,fs:13});$('#ed-area').textContent=(room.w*room.l/10000).toFixed(2)+' m²';$$('fieldset.op').forEach(f=>f.classList.toggle('sel',f.dataset.op===sel));};
  $$('fieldset.op').forEach(f=>f.addEventListener('click',()=>{sel=f.dataset.op;draw()}));
  $('#ed-w').addEventListener('input',e=>{room.w=Math.max(+e.target.value||0,120);draw()});
  $('#ed-l').addEventListener('input',e=>{room.l=Math.max(+e.target.value||0,120);draw()});
  $('#ed-door-o').addEventListener('input',e=>{room.op[0].o=+e.target.value||0;draw()});
  $('#ed-door-d').addEventListener('input',e=>{room.op[0].d=+e.target.value||0;draw()});
  document.addEventListener('rp:screen',draw);
  new MutationObserver(()=>{if(ed.closest('section').classList.contains('on'))draw()}).observe(ed.closest('section'),{attributes:true,attributeFilter:['class']});
  draw();}
 /* design: plan<->list linking + tooltip */
 const tip=$('.tip'),dp=$('#design-plan');
 if(dp){
  const hl=id=>{$$('#design-plan [data-item]').forEach(n=>{const on=n.dataset.item==id;n.setAttribute('stroke',on?'#c8794a':'#2b2622');n.setAttribute('stroke-width',on?3:1.2)});$$('.items>div[data-item]').forEach(r=>r.classList.toggle('hl',r.dataset.item==id))};
  dp.addEventListener('mousemove',e=>{const n=e.target.closest('[data-item]');if(!n){tip.style.display='none';hl(null);return}const f=FUR.living.find(x=>x.id==n.dataset.item);tip.innerHTML=`${f.id} · ${f.n}<br>${f.w} × ${f.d} cm · € ${f.p}`;tip.style.display='block';tip.style.left=e.clientX+14+'px';tip.style.top=e.clientY+14+'px';hl(f.id)});
  dp.addEventListener('mouseleave',()=>{tip.style.display='none';hl(null)});
  $$('.items>div[data-item]').forEach(r=>{r.addEventListener('mouseenter',()=>hl(r.dataset.item));r.addEventListener('mouseleave',()=>hl(null))});
  const gen=$('#gen-btn'),pr=$('.progress'),stages=$$('.progress li'),bar=$('.progress .bar i');
  gen.addEventListener('click',()=>{if(gen.disabled)return;gen.disabled=true;gen.textContent='Working…';pr.classList.add('on');let i=0;stages.forEach(s=>s.className='');
   const tick=()=>{stages.forEach((s,j)=>s.className=j<i?'done':j===i?'cur':'');bar.style.width=(i/stages.length*100)+'%';
    if(i<stages.length){i++;setTimeout(tick,700)}else{setTimeout(()=>{pr.classList.remove('on');gen.disabled=false;gen.textContent='Generate new version ✦';const v=$('.versions');const b=document.createElement('button');b.textContent='v'+(v.children.length+1)+' · new';v.appendChild(b);$$('button',v).forEach(x=>x.classList.toggle('on',x===b));drawAll(dp.parentNode)},500)}};tick();});
 }
 /* library tabs */
 $$('.tabs').forEach(t=>t.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;$$('button',t).forEach(x=>x.classList.toggle('on',x===b));$$('[data-pane]').forEach(p=>p.style.display=p.dataset.pane===b.dataset.tab?'':'none')}));
 $$('[data-add]').forEach(b=>b.addEventListener('click',()=>{const on=b.classList.toggle('on');b.textContent=on?'Added ✓':'+ Add'}));
}
})();
