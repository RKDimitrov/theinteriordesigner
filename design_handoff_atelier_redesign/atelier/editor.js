const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const IC={select:'<path d="M5 3l5 16 2.5-6.5L19 10z"/>',pan:'<path d="M8 13V6.5a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V11m0-3.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7-2.5 0-4-1.2-5.5-3.5L4 14a1.5 1.5 0 012.5-1.6L8 14"/>',wall:'<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6"/>',room:'<rect x="4" y="4" width="16" height="16"/><path d="M4 9h3M20 15h-3"/>',door:'<path d="M5 20V4h10v16M3 20h16M12 12h.5"/>',window:'<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h16"/>',pass:'<path d="M4 20V4h16v16" stroke-dasharray="3 3"/>',rad:'<path d="M6 5v14M10 5v14M14 5v14M18 5v14M4 8h16M4 16h16"/>',socket:'<circle cx="12" cy="12" r="8"/><path d="M9.5 10v3M14.5 10v3"/>',measure:'<path d="M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',dim:'<path d="M3 12h18M6 9l-3 3 3 3M18 9l3 3-3 3M3 5v14M21 5v14"/>',label:'<path d="M5 7V4h14v3M12 4v16M9 20h6"/>',note:'<path d="M4 4h16v11l-5 5H4zM15 20v-5h5"/>',cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeoff:'<path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3 3.7M6.6 6.6C3.8 8.4 2 12 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4"/>',undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 000 12h3"/>',fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',magnet:'<path d="M6 3v8a6 6 0 0012 0V3M6 7h4M14 7h4"/>',export:'<path d="M12 15V3M7 8l5-5 5 5M4 14v6h16v-6"/>',back:'<path d="M15 5l-7 7 7 7"/>',search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',rot:'<path d="M20 12a8 8 0 11-3-6.3M20 4v5h-5"/>',dup:'<rect x="8" y="8" width="12" height="12"/><path d="M4 16V4h12"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',spark:'<path d="M12 3c.5 4.5 2 6.5 6.5 7-4.5.5-6 2.5-6.5 7-.5-4.5-2-6.5-6.5-7 4.5-.5 6-2.5 6.5-7zM19 16c.2 1.6.8 2.3 2.3 2.5-1.5.2-2.1.9-2.3 2.5-.2-1.6-.8-2.3-2.3-2.5 1.5-.2 2.1-.9 2.3-2.5z"/>',camera:'<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="3.5"/>',walk:'<circle cx="13" cy="4" r="2"/><path d="M9 21l2-6 3 2v4M7 12l4-4 3 2 3 3M11 8l-1 6"/>',layers:'<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',chair:'<path d="M6 10V5h12v5M4 10h16v5H4zM6 15v4M18 15v4"/>',grid:'<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/>',image:'<rect x="3" y="5" width="18" height="14"/><path d="M3 16l5-5 4 4 3-3 6 6"/>'};
const icons=(r=document)=>$$('[data-i]:not([data-done])',r).forEach(e=>{e.dataset.done=1;e.insertAdjacentHTML('afterbegin',`<svg class="ic" viewBox="0 0 24 24">${IC[e.dataset.i]||''}</svg>`)});
const INK='#2b2622',ST=`stroke="${INK}" stroke-width="1.2"`;
const shade=(h,a)=>{const n=parseInt(h.slice(1),16),f=v=>Math.round(a<0?v*(1+a):v+(255-v)*a);return `rgb(${f(n>>16)},${f(n>>8&255)},${f(n&255)})`};
function sym(t,w,d,c){
const R=(x,y,W,H,f=c,e='')=>`<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${f}" ${ST} ${e}/>`,L=(a,b,c2,d2,e='')=>`<line x1="${a}" y1="${b}" x2="${c2}" y2="${d2}" ${ST} ${e}/>`,lt=shade(c,.35);
switch(t){
case'sofa':case'armchair':{const a=t=='sofa'?14:12,b=18,n=t=='sofa'?(w>180?3:2):1;let s=R(0,0,w,d,c,'rx="5"')+R(a,b,w-2*a,d-b-3,lt,'rx="3"')+R(0,0,w,b,c,'rx="4"');for(let i=1;i<n;i++){const x=a+i*(w-2*a)/n;s+=L(x,b,x,d-3)}return s}
case'table':return w==d?`<circle cx="${w/2}" cy="${d/2}" r="${w/2}" fill="${c}" ${ST}/><circle cx="${w/2}" cy="${d/2}" r="${w/2-5}" fill="none" ${ST} stroke-opacity=".4"/>`:R(0,0,w,d,c,'rx="3"')+R(6,6,w-12,d-12,'none','stroke-opacity=".4"');
case'tv':return R(0,0,w,d,c)+R(w*.2,4,w*.6,5,INK)+L(w/2,9,w/2,d);
case'rug':{let s=R(0,0,w,d,c,'stroke-dasharray="5 3"')+R(12,12,w-24,d-24,'none','stroke-opacity=".45"');for(let x=6;x<w;x+=10)s+=L(x,-5,x,0,'stroke-opacity=".5"')+L(x,d,x,d+5,'stroke-opacity=".5"');return s}
case'lamp':return`<circle cx="${w/2}" cy="${d/2}" r="${w/2}" fill="${c}" ${ST}/><circle cx="${w/2}" cy="${d/2}" r="${w/6}" fill="none" ${ST}/>`+L(w/2,2,w/2,d-2,'stroke-opacity=".5"')+L(2,d/2,w-2,d/2,'stroke-opacity=".5"');
case'shelf':{let s=R(0,0,w,d,c);for(let i=1;i<4;i++)s+=L(i*w/4,0,i*w/4,d);return s}
case'plant':{let s=`<circle cx="${w/2}" cy="${d/2}" r="${w*.28}" fill="#c9a27a" ${ST}/>`;for(let k=0;k<7;k++)s+=`<ellipse cx="${w/2}" cy="${d*.22}" rx="${w*.13}" ry="${d*.24}" fill="${c}" fill-opacity=".85" ${ST} transform="rotate(${k*51} ${w/2} ${d/2})"/>`;return s}
case'bed':return R(0,0,w,d,c)+R(8,8,w/2-12,28,'#fbf6ec','rx="5"')+R(w/2+4,8,w/2-12,28,'#fbf6ec','rx="5"')+R(0,d*.3,w,d*.7,lt)+L(0,d*.42,w,d*.3);
case'dining':return[[30,0],[w-70,0],[30,d-32],[w-70,d-32]].map(([x,y])=>R(x,y,40,32,lt,'rx="4"')).join('')+R(15,26,w-30,d-52,c);
case'desk':return R(0,0,w,d,c)+`<circle cx="${w/2}" cy="${d*.72}" r="17" fill="${lt}" ${ST}/>`;
case'wardrobe':return R(0,0,w,d,c)+L(w/2,0,w/2,d)+L(0,0,w,d,'stroke-dasharray="3 3" stroke-opacity=".5"')+L(w,0,0,d,'stroke-dasharray="3 3" stroke-opacity=".5"');
}return R(0,0,w,d,c)}
let P=[
{id:'rug',t:'rug',n:'Wool rug, flatweave',w:230,d:200,h:1,x:215,y:200,r:0,c:'#e2cfae',p:240,tier:'mid'},
{id:'sofa',t:'sofa',n:'Sofa, 3-seat linen',w:210,d:90,h:82,x:65,y:200,r:-90,c:'#b9a58a',p:890,tier:'anchor'},
{id:'table',t:'table',n:'Coffee table, oak',w:100,d:60,h:40,x:215,y:200,r:90,c:'#a57a52',p:0,tier:'yours'},
{id:'tv',t:'tv',n:'TV unit, walnut',w:160,d:45,h:50,x:375,y:200,r:90,c:'#6b4a32',p:320,tier:'anchor'},
{id:'chair',t:'armchair',n:'Armchair, clay bouclé',w:80,d:80,h:78,x:320,y:72,r:45,c:'#c8794a',p:290,tier:'mid'},
{id:'lamp',t:'lamp',n:'Floor lamp, paper shade',w:40,d:40,h:150,x:376,y:28,r:0,c:'#efe3cf',p:95,tier:'swappable'},
{id:'shelf',t:'shelf',n:'Low bookshelf',w:180,d:35,h:80,x:250,y:380,r:180,c:'#8a6a4a',p:210,tier:'anchor'},
{id:'plant',t:'plant',n:'Fiddle-leaf fig',w:44,d:44,h:160,x:38,y:42,r:0,c:'#5d6b3c',p:45,tier:'swappable'},
{id:'bench',room:'hol',t:'table',n:'Slim bench, oak',w:110,d:35,h:45,x:-150,y:260,r:0,c:'#a57a52',p:160,tier:'mid'},
{id:'shoe',room:'hol',t:'shelf',n:'Shoe cabinet',w:90,d:30,h:100,x:-257,y:383,r:180,c:'#6b4a32',p:140,tier:'anchor'}];
P.forEach(p=>p.room=p.room||'living');
const VX=-420,VY=-100;
const ROOMS={living:{n:'Living room',x:0,y:0,w:400,l:400,a:'16.00',op:['<div class="win3"></div><div class="rad3"></div>','','','<div class="door3"></div>']},hol:{n:'Hol',x:-312,y:240,w:300,l:160,a:'4.80',op:['<div class="door3" style="left:10px;width:90px"></div>','<div class="win3" style="left:60px;width:100px"></div><div class="rad3" style="left:70px;width:80px"></div>','<div class="door3 open" style="left:70px;width:80px"></div>','']}};
let scope=new URLSearchParams(location.search).get('room');if(!['all','hol','living'].includes(scope))scope='living';
const inScope=p=>scope=='all'||p.room==scope,roomAt=(x,y)=>x<-6?'hol':'living';
const LIB=[['sofa','Sofa, 2-seat',160,88,'#b9a58a'],['sofa','Sofa, 3-seat linen',210,90,'#b9a58a','in plan'],['armchair','Armchair, bouclé',80,80,'#c8794a','in plan'],['table','Coffee table, oak',100,60,'#a57a52','mine'],['table','Side table, Ø 45',45,45,'#a57a52'],['tv','TV unit, walnut',160,45,'#6b4a32','in plan'],['shelf','Low bookshelf',180,35,'#8a6a4a','in plan'],['lamp','Floor lamp, paper',40,40,'#efe3cf','in plan'],['rug','Wool rug',230,200,'#e2cfae','in plan'],['plant','Fiddle-leaf fig',44,44,'#5d6b3c','in plan'],['dining','Dining for four',180,150,'#a57a52'],['bed','Double bed',160,200,'#d8c9ae'],['desk','Desk, oak',120,60,'#a57a52'],['wardrobe','Wardrobe',100,58,'#8a6a4a']];
let sel='chair',tool='select',z=1,offX=0,offY=0,snap=true,pending=null,uid=0;
const byId=id=>P.find(p=>p.id==id),stage=$('#stage'),paper=$('#paper'),plan=$('#plan');
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2400)};
/* plan */
plan.innerHTML=`<defs><pattern id="planks" width="400" height="20" patternUnits="userSpaceOnUse"><path d="M0 19.5H400" stroke="#dcc9a8" stroke-width=".7"/></pattern></defs>
<g id="L-floor"><g data-room="living"><rect x="0" y="0" width="400" height="400" fill="#f3e7d0"/><rect x="0" y="0" width="400" height="400" fill="url(#planks)"/></g><g data-room="hol"><rect x="-312" y="240" width="300" height="160" fill="#f3e7d0"/><rect x="-312" y="240" width="300" height="160" fill="url(#planks)"/></g></g>
<g id="L-furn"></g>
<g id="L-ai"><g class="ghost" data-sug="side"><circle cx="262" cy="136" r="22" fill="#c8794a" fill-opacity=".1" stroke="#c8794a" stroke-width="1.3" stroke-dasharray="4 3"/><text x="262" y="170" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#8e4f2f">✦ side table</text></g>
<g class="ghost" data-sug="pend"><circle cx="215" cy="200" r="28" fill="none" stroke="#c8794a" stroke-width="1.3" stroke-dasharray="4 3"/><path d="M195 180L235 220M235 180L195 220" stroke="#c8794a" stroke-width="1" stroke-dasharray="2 3"/><text x="215" y="242" text-anchor="middle" font-family="IBM Plex Mono" font-size="8" fill="#8e4f2f">✦ pendant</text></g></g>
<g id="L-elec"><rect x="-162" y="388" width="80" height="9" fill="#fbf6ec" ${ST}/><rect x="140" y="3" width="100" height="9" fill="#fbf6ec" ${ST}/><path d="M152 3v9M164 3v9M176 3v9M188 3v9M200 3v9M212 3v9M224 3v9" stroke="${INK}" stroke-width=".8"/>${[[396,300],[100,396],[4,240]].map(([x,y])=>`<g transform="translate(${x} ${y})"><circle r="5" fill="#fbf6ec" ${ST}/><path d="M-2 -2v4M2 -2v4" stroke="${INK}"/></g>`).join('')}</g>
<g id="L-walls"><path fill-rule="evenodd" fill="${INK}" d="M-324 228H0V412H-324ZM-312 240V400H-12V240Z"/><path fill-rule="evenodd" fill="${INK}" d="M-12 -12H412V412H-12ZM0 0V400H400V0Z"/><rect x="120" y="-12.5" width="140" height="13" fill="#fbf6ec"/><rect x="-12.5" y="310" width="13" height="80" fill="#fbf6ec"/><rect x="-302" y="227.5" width="90" height="13" fill="#fbf6ec"/><rect x="-172" y="399.5" width="100" height="13" fill="#fbf6ec"/></g>
<g id="L-doors" fill="none"><path d="M120 -12H260M120 -6H260M120 0H260M120 -12V0M260 -12V0" ${ST}/><path d="M0 390H80" stroke="${INK}" stroke-width="2.5"/><path d="M80 390A80 80 0 0 0 0 310" ${ST} stroke-dasharray="3 3"/><path d="M-172 400H-72M-172 406H-72M-172 412H-72M-172 400V412M-72 400V412" ${ST}/><path d="M-302 240V330" stroke="${INK}" stroke-width="2.5"/><path d="M-302 330A90 90 0 0 0 -212 240" ${ST} stroke-dasharray="3 3"/></g>
<g id="L-dims" font-family="IBM Plex Mono" font-size="10" fill="${INK}">
<path d="M0 -52H400M0 -58V-46M400 -58V-46M-4 -48L4 -56M396 -48L404 -56M0 -30H400M0 -34V-26M120 -34V-26M260 -34V-26M400 -34V-26M-52 0V400M-58 0H-46M-58 400H-46M-56 -4L-48 4M-56 396L-48 404M-30 310V390M-34 310H-26M-34 390H-26" fill="none" ${ST}/>
<rect x="183" y="-59" width="34" height="13" fill="#fbf6ec"/><text x="200" y="-49" text-anchor="middle">400</text>
<text x="60" y="-35" text-anchor="middle" font-size="8.5">120</text><text x="190" y="-35" text-anchor="middle" font-size="8.5">140 window</text><text x="330" y="-35" text-anchor="middle" font-size="8.5">140</text>
<g transform="translate(-52 200) rotate(-90)"><rect x="-17" y="-7" width="34" height="13" fill="#fbf6ec"/><text y="3" text-anchor="middle">400</text></g>
<g transform="translate(-34 350) rotate(-90)"><text y="0" text-anchor="middle" font-size="8.5">80 door</text></g><path d="M-312 452H-12M-312 446V458M-12 446V458M-364 240V400M-370 240H-358M-370 400H-358" fill="none" ${ST}/><rect x="-179" y="445" width="34" height="13" fill="#fbf6ec"/><text x="-162" y="455" text-anchor="middle">300</text><g transform="translate(-364 320) rotate(-90)"><rect x="-17" y="-7" width="34" height="13" fill="#fbf6ec"/><text y="3" text-anchor="middle">160</text></g></g>
<g id="L-labels"><rect x="168" y="318" width="94" height="32" fill="#fbf6ec" ${ST}/><text x="215" y="332" text-anchor="middle" font-family="Instrument Serif" font-size="14">Living room</text><text x="215" y="344" text-anchor="middle" font-family="IBM Plex Mono" font-size="8">16.00 m²</text><rect x="-209" y="302" width="94" height="32" fill="#fbf6ec" ${ST}/><text x="-162" y="316" text-anchor="middle" font-family="Instrument Serif" font-size="14">Hol</text><text x="-162" y="328" text-anchor="middle" font-family="IBM Plex Mono" font-size="8">4.80 m²</text></g>`;
const selBox=p=>`<g><rect x="-5" y="-5" width="${p.w+10}" height="${p.d+10}" fill="none" stroke="#c8794a" stroke-width="1.3" stroke-dasharray="4 3"/>${[[-5,-5],[p.w+5,-5],[-5,p.d+5],[p.w+5,p.d+5]].map(([x,y])=>`<rect x="${x-3.5}" y="${y-3.5}" width="7" height="7" fill="#fbf6ec" stroke="#c8794a" stroke-width="1.3"/>`).join('')}<path d="M${p.w/2} -5V-18" stroke="#c8794a" stroke-width="1.3"/><circle cx="${p.w/2}" cy="-22" r="4" fill="#c8794a"/></g>`;
function drawPieces(){$('#L-furn').innerHTML=P.map(p=>`<g class="pc2${inScope(p)?'':' dim'}" data-id="${p.id}" transform="translate(${p.x} ${p.y}) rotate(${p.r}) translate(${-p.w/2} ${-p.d/2})">${sym(p.t,p.w,p.d,p.c)}${p.id==sel?selBox(p):''}</g>`).join('');placeFtb()}
function rulers(){const pw=paper.clientWidth,ph=paper.clientHeight,k=1.2*z,ox=offX-VX*k,oy=offY-VY*k,st=z<.7?100:50;let hx='',hy='';
for(let cm=Math.ceil(-ox/k/st)*st;cm*k+ox<pw;cm+=st)hx+=`<span class="tk" style="left:${ox+cm*k}px">${cm}</span>`;
for(let cm=Math.ceil(-oy/k/st)*st;cm*k+oy<ph;cm+=st)hy+=`<span class="tk" style="top:${oy+cm*k}px">${cm}</span>`;
$('#rx').innerHTML=hx;$('#ry').innerHTML=hy;$('#rx').style.backgroundSize=`${10*k}px 6px`;$('#rx').style.backgroundPosition=`${ox}px 100%`;$('#ry').style.backgroundSize=`6px ${10*k}px`;$('#ry').style.backgroundPosition=`100% ${oy}px`;
const M=50*k,m=10*k;paper.style.backgroundSize=`${M}px ${M}px,${M}px ${M}px,${m}px ${m}px,${m}px ${m}px`;paper.style.backgroundPosition=`${ox}px ${oy}px`}
function view(){plan.style.transform=`translate(${offX}px,${offY}px) scale(${z})`;$('#zv').textContent=Math.round(z*100)+'%';rulers();placeFtb()}
function fit(){const B=scope=='all'?{x:-312,y:0,w:712,l:400}:ROOMS[scope],pw=paper.clientWidth,ph=paper.clientHeight,pad=85;z=Math.max(.35,Math.min(2.5,Math.min(pw/((B.w+pad*2)*1.2),ph/((B.l+pad*2)*1.2))));const k=1.2*z;offX=pw/2-(B.x+B.w/2-VX)*k;offY=ph/2-(B.y+B.l/2-VY)*k-10;view()}
function setScope(s){scope=s;$$('#scope button').forEach(b=>b.classList.toggle('on',b.dataset.scope==s));$$('#plan [data-room]').forEach(g=>g.style.opacity=s=='all'||g.dataset.room==s?1:.4);
$('#tb-s').textContent=s=='all'?'Whole apartment':ROOMS[s].n;$('#tb-a').textContent=(s=='all'?'20.80':ROOMS[s].a)+' m²';history.replaceState(null,'','?room='+s);
vis=new Set(s=='all'?Object.keys(ROOMS):[s]);drawVis();if(sel&&!inScope(byId(sel)||{}))sel=null;drawPieces();syncSel();fit();if(document.body.classList.contains('m3')){build3D();applyCam()}}
$('#scope').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setScope(b.dataset.scope)});
function zoomAt(nz,mx,my){nz=Math.max(.35,Math.min(3,nz));offX=mx-(mx-offX)*nz/z;offY=my-(my-offY)*nz/z;z=nz;view()}
function placeFtb(){const f=$('#ftb'),g=$(`.pc2[data-id="${sel}"]`);if(!g||document.body.classList.contains('m3')){f.classList.remove('on');return}
const r=g.getBoundingClientRect(),s=stage.getBoundingClientRect(),p=byId(sel);$('#ftbDim').textContent=`${p.w} × ${p.d}`;f.classList.add('on');f.style.left=Math.max(120,r.left+r.width/2-s.left)+'px';f.style.top=Math.max(34,r.top-s.top-50)+'px'}
/* selection */
function selHTML(){const p=byId(sel);if(!p)return`<div class="empty"><svg class="ic" viewBox="0 0 24 24">${IC.cube}</svg><p>Click something to edit it</p><ul><li>A <b>piece</b>: size, turn, swap it</li><li>A <b>wall</b>: length and thickness</li><li>A <b>door or window</b>: width and position</li></ul></div>`;
const F=(k,l,u='cm')=>`<div class="field"><label>${l}</label><div class="inp"><input data-k="${k}" type="number" value="${p[k]}"><span>${u}</span></div></div>`;
const calm=document.body.classList.contains('calm');return`<h5><span>Selected</span><span>${p.tier}</span></h5><div class="selhead"><i style="background:${p.c}"></i><div><b>${p.n}</b><small>${p.p?'€ '+p.p:'owned'} · ${p.w} × ${p.d} × ${p.h}</small></div></div>${calm?`<div class="fg3">${F('w','Width')}${F('d','Depth')}${F('r','Turn','°')}</div>`:`<div class="fg3">${F('w','Width')}${F('d','Depth')}${F('h','Height')}</div><div class="fg3">${F('x','From W')}${F('y','From N')}${F('r','Turn','°')}</div>`}<div class="row"><button class="btn sm p" data-act="swap" data-i="spark">Swap piece</button><button class="btn sm g dz" data-act="del">Remove</button></div>`}
function syncSel(){$('#sel2').innerHTML=$('#sel3').innerHTML=selHTML();icons($('.insp'))}
function updXY(){const p=byId(sel);if(!p)return;$$('.insp input[data-k="x"]').forEach(i=>i.value=p.x);$$('.insp input[data-k="y"]').forEach(i=>i.value=p.y)}
function select(id){sel=id;drawPieces();syncSel();$$('.p3').forEach(e=>e.classList.toggle('sel',e.dataset.id==id))}
$('.insp').addEventListener('input',e=>{const k=e.target.dataset.k,p=byId(sel);if(!k||!p||e.target.value==='')return;p[k]=+e.target.value;drawPieces();if(document.body.classList.contains('m3'))build3D()});
function act(a){const p=byId(sel);if(!p)return;
if(a=='rot'){p.r=(p.r+45)%360;drawPieces();syncSel()}
if(a=='dup'){const q={...p,id:'n'+(++uid),x:p.x+20,y:p.y+20};P.push(q);select(q.id)}
if(a=='del'){P=P.filter(q=>q!=p);select(null);build3D();toast(p.n+' removed')}
if(a=='swap')toast('✦ Designer is finding 3 alternatives for '+p.n.split(',')[0].toLowerCase()+'…')}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b)act(b.dataset.act)});
/* layers */
const LY=[['L-walls','Walls','wall','base'],['L-doors','Doors & windows','door'],['L-furn','Furniture','chair'],['L-ai','Designer suggestions','spark','ai'],['L-dims','Dimensions','dim'],['L-labels','Room labels','label','adv'],['L-elec','Electrical & heating','socket','adv'],['L-floor','Floor finish','layers','adv'],['grid','Grid','grid','adv'],['ref','Reference photo','image','adv']];
const off=new Set(['ref']);
function drawLayers(){$('#layers').innerHTML=LY.map(([id,n,i,f])=>`<div class="layer${off.has(id)?' off':''}${f=='ai'?' ai':''}${f=='adv'?' adv-l':''}" data-ly="${id}"><svg class="ic" viewBox="0 0 24 24">${IC[i]}</svg><span class="nm">${n}</span>${f=='base'?'<small>BASE</small>':''}<span class="eye"><svg class="ic" viewBox="0 0 24 24">${IC[off.has(id)?'eyeoff':'eye']}</svg></span></div>`).join('')+`<button class="lymore calm-only" id="lymore">${document.body.classList.contains('alllayers')?'− Fewer layers':'+ All layers'}</button>`;$('#lycount').textContent=`${LY.length-off.size} / ${LY.length}`;
LY.forEach(([id])=>{if(id=='grid')paper.classList.toggle('nogrid',off.has(id));else{const g=document.getElementById(id);if(g)g.style.display=off.has(id)?'none':''}})}
$('#layers').addEventListener('click',e=>{if(e.target.closest('#lymore')){document.body.classList.toggle('alllayers');drawLayers();return}const l=e.target.closest('.layer');if(!l)return;const id=l.dataset.ly;if(id=='ref'){toast('Drop a photo of your floor plan to trace over');return}off.has(id)?off.delete(id):off.add(id);drawLayers()});
/* catalogue */
$('#pieces').innerHTML=LIB.map((l,i)=>`<button class="pc" data-lib="${i}">${l[5]?`<span class="label ${l[5]=='mine'?'o':''}">${l[5]}</span>`:''}<svg viewBox="-10 -10 ${l[2]+20} ${l[3]+20}">${sym(l[0],l[2],l[3],l[4])}</svg><b>${l[1]}</b><small>${l[2]} × ${l[3]} cm</small></button>`).join('');
$('#pieces').addEventListener('click',e=>{const b=e.target.closest('.pc');if(!b)return;const on=!b.classList.contains('on');$$('.pc').forEach(x=>x.classList.remove('on'));if(on){b.classList.add('on');pending=+b.dataset.lib;$('#catfoot').textContent='Click the plan to place: '+LIB[pending][1];paper.classList.add('draw')}else{pending=null;$('#catfoot').textContent='Pick a piece, then click the plan to place it';paper.classList.remove('draw')}});
const toggleDrawer=()=>{document.body.classList.toggle('nodrawer');requestAnimationFrame(view)};$('#catbtn').onclick=toggleDrawer;$('#catx').onclick=toggleDrawer;
/* tools */
const HINT={select:'Drag a piece to move it · scroll to zoom · drag the paper to pan',pan:'Drag to move the sheet',wall:'Click to start a wall, double-click to finish',room:'Drag a rectangle to draw a room',door:'Click a wall to place a door · 90 cm by default',window:'Click a wall to place a window',pass:'Click a wall to cut an opening',rad:'Click a wall to hang a radiator',socket:'Click a wall to add a socket',measure:'Click two points to measure',dim:'Click two points to pin a dimension',label:'Click inside a room to label it',note:'Click to pin a margin note'};
function setTool(t){tool=t;$$('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool==t));$('#hint').textContent=HINT[t];paper.classList.toggle('pan',t=='pan');paper.classList.toggle('draw',!['select','pan'].includes(t))}
$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
/* pointer on plan */
let drag=null;const toCm=e=>{const r=paper.getBoundingClientRect(),k=1.2*z;return[(e.clientX-r.left-offX)/k+VX,(e.clientY-r.top-offY)/k+VY]};
paper.addEventListener('pointerdown',e=>{const g=e.target.closest('.pc2'),gh=e.target.closest('.ghost');
if(gh&&tool=='select'){switchTab('ai');return}
if(g&&tool=='select'&&pending==null){if(sel!=g.dataset.id)select(g.dataset.id);const p=byId(sel);drag={t:'move',p,sx:e.clientX,sy:e.clientY,ox:p.x,oy:p.y}}
else drag={t:'pan',sx:e.clientX,sy:e.clientY,ox:offX,oy:offY,moved:0};paper.setPointerCapture(e.pointerId)});
paper.addEventListener('pointermove',e=>{const[cx,cy]=toCm(e);$('#cur').textContent=`x ${Math.round(cx)} · y ${Math.round(cy)} cm`;if(!drag)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy,k=1.2*z;
if(drag.t=='move'){const s=snap?5:1;drag.p.x=Math.round((drag.ox+dx/k)/s)*s;drag.p.y=Math.round((drag.oy+dy/k)/s)*s;drawPieces();updXY()}
else{drag.moved=Math.max(drag.moved,Math.abs(dx)+Math.abs(dy));offX=drag.ox+dx;offY=drag.oy+dy;view()}});
paper.addEventListener('pointerup',e=>{if(drag&&drag.t=='pan'&&drag.moved<4){if(pending!=null){const l=LIB[pending],[cx,cy]=toCm(e),s=snap?5:1,q={id:'n'+(++uid),t:l[0],n:l[1],w:l[2],d:l[3],h:{sofa:82,armchair:78,table:45,tv:50,shelf:80,lamp:150,rug:1,plant:160,dining:75,bed:50,desk:75,wardrobe:210}[l[0]],x:Math.round(cx/s)*s,y:Math.round(cy/s)*s,r:0,c:l[4],p:120,tier:'added'};q.room=scope=='all'?roomAt(q.x,q.y):scope;P.push(q);$$('.pc').forEach(x=>x.classList.remove('on'));pending=null;paper.classList.remove('draw');$('#catfoot').textContent='Pick a piece, then click the plan to place it';select(q.id);toast(l[1]+' placed')}else if(tool=='select')select(null)}drag=null});
paper.addEventListener('wheel',e=>{e.preventDefault();const r=paper.getBoundingClientRect();zoomAt(z*(e.deltaY<0?1.1:1/1.1),e.clientX-r.left,e.clientY-r.top)},{passive:false});
const zc=f=>zoomAt(z*f,paper.clientWidth/2,paper.clientHeight/2);$('#zi').onclick=()=>zc(1.2);$('#zo').onclick=()=>zc(1/1.2);$('#zf').onclick=fit;
$('#snap').onclick=e=>{snap=!snap;e.currentTarget.classList.toggle('on',snap)};
/* designer */
$('#sugs').addEventListener('click',e=>{const a=e.target.closest('[data-accept]'),d=e.target.closest('[data-dismiss]');if(!a&&!d)return;const id=(a||d).dataset.accept||(a||d).dataset.dismiss;
$$(`[data-sug="${id}"]`).forEach(x=>x.remove());if(a&&id=='side'){P.push({id:'side',t:'table',n:'Side table, Ø 45',w:45,d:45,h:50,x:262,y:136,r:0,c:'#a57a52',p:85,tier:'mid'});select('side')}
if(a&&id=='pend')toast('Pendant added to the lighting list');const n=$$('.sug').length;$('#sugn').textContent=n?n+' suggestion'+(n>1?'s':''):'none left'});
$('#redo').onclick=()=>toast('✦ Drawing up v3 · keeping your placed pieces · about a minute');
$('#gen').onclick=()=>{setMode(2);switchTab('ai')};
/* tabs & groups */
function switchTab(p){const b=$(`[data-tabs] [data-p="${p}"]`);$$('button',b.parentNode).forEach(x=>x.classList.toggle('on',x==b));showPane()}
function showPane(){const set=$(document.body.classList.contains('m3')?'.tabs2.v3':'.tabs2.v2'),b=$('.on',set);$$('.pane').forEach(p=>p.classList.toggle('on',p.dataset.pane==b.dataset.p))}
$$('[data-tabs]').forEach(t=>t.addEventListener('click',e=>{const b=e.target.closest('button');if(b)switchTab(b.dataset.p)}));
$$('[data-group]').forEach(g=>g.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.parentNode!=g)return;$$('button',g).forEach(x=>x.classList.remove('on','f'));b.classList.add(b.classList.contains('label')?'f':'on')}));
$$('.sw-t').forEach(s=>s.onclick=()=>s.classList.toggle('on'));
/* 3D */
function box(x,y,zz,w,d,h,c){const a=shade(c,-.1),b=shade(c,-.24);return`<div class="bx" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px;transform:translateZ(${zz}px)"><i style="width:${w}px;height:${d}px;transform:translateZ(${h}px);background:${c}"></i><i style="width:${w}px;height:${h}px;transform-origin:50% 0;transform:rotateX(90deg);background:${a}"></i><i style="top:${d-h}px;width:${w}px;height:${h}px;transform-origin:50% 100%;transform:rotateX(-90deg);background:${a}"></i><i style="width:${h}px;height:${d}px;transform-origin:0 50%;transform:rotateY(-90deg);background:${b}"></i><i style="left:${w-h}px;width:${h}px;height:${d}px;transform-origin:100% 50%;transform:rotateY(90deg);background:${b}"></i></div>`}
function parts(p){const W=p.w,D=p.d,c=p.c,x0=-W/2,y0=-D/2;switch(p.t){
case'sofa':case'armchair':{const a=p.t=='sofa'?14:12,b=18;return box(x0+a,y0+b,0,W-2*a,D-b,42,c)+box(x0,y0,0,W,b,p.h,c)+box(x0,y0+b,0,a,D-b,60,c)+box(x0+W-a,y0+b,0,a,D-b,60,c)}
case'rug':return`<i class="rug3" style="left:${x0}px;top:${y0}px;width:${W}px;height:${D}px;background:${c}"></i>`;
case'tv':return box(x0,y0,0,W,D,p.h,c)+box(-W*.3,y0+8,p.h,W*.6,4,56,INK);
case'lamp':return box(-2,-2,0,4,4,120,INK)+box(-18,-18,120,36,36,32,c);
case'plant':return box(-13,-13,0,26,26,34,'#b58a60')+box(-20,-20,34,40,40,80,c)+`<div class="p3" style="transform:rotateZ(45deg)">${box(-15,-15,70,30,30,80,shade(c,.12))}</div>`;
case'bed':return box(x0,y0,0,W,D,45,c)+box(x0,y0,0,W,8,95,shade(c,-.2));
default:return box(x0,y0,0,W,D,p.h,c)}}
let BB={w:400,l:400},CX=0,CY=0,vis=new Set(Object.keys(ROOMS));
const OPEN=[{room:'living',side:3,a:310,b:390,t:'door',head:205},{room:'living',side:0,a:120,b:260,t:'win',sill:90,head:220,rad:1},{room:'hol',side:0,a:-302,b:-212,t:'door',head:210},{room:'hol',side:1,a:-172,b:-72,t:'win',sill:90,head:220,rad:1},{room:'hol',side:2,a:310,b:390,t:'door',head:205}];
const DOORS=[{id:'d1',n:'Hol → Living room',rooms:['living','hol'],hx:0,hy:390,w:80,h:205,base:-90,swing:90,zone:[-44,30,318,382]},{id:'d2',n:'Front door',rooms:['hol'],hx:-302,hy:240,w:90,h:210,base:0,swing:90,zone:[-294,-220,186,264]}];
const doorOpen={d1:false,d2:false};
const loc=(R,s,g)=>[g-R.x,R.x+R.w-g,g-R.y,R.y+R.l-g][s];
function wallHTML(R,side,len){const H=250,ops=OPEN.filter(o=>o.room==R.id&&o.side==side).map(o=>{const p=loc(R,side,o.a),q=loc(R,side,o.b);return{...o,s:Math.min(p,q),e:Math.max(p,q)}}).sort((m,n)=>m.s-n.s);
let x=0,s='';const seg=(l,t,w,hh,c='ws3')=>`<b class="${c}" style="left:${l}px;top:${t}px;width:${w}px;height:${hh}px"></b>`;
ops.forEach(o=>{if(o.s>x)s+=seg(x,0,o.s-x,H);const w=o.e-o.s;s+=seg(o.s,0,w,H-o.head);if(o.t=='win'){s+=seg(o.s,H-o.head,w,o.head-o.sill,'glass');s+=seg(o.s,H-o.sill,w,o.sill);if(o.rad)s+=`<b class="rad3" style="left:${o.s+10}px;width:${w-20}px"></b>`}x=o.e});
if(x<len)s+=seg(x,0,len-x,H);return s}
const leafT=d=>`rotateZ(${d.base+(doorOpen[d.id]?d.swing:0)}deg)`;
function build3D(){const rs=Object.entries(ROOMS).filter(([id])=>vis.has(id)).map(([id,r])=>({...r,id}));if(!rs.length){$('#world').innerHTML='<div class="ground"></div>';return}
const x0=Math.min(...rs.map(r=>r.x)),y0=Math.min(...rs.map(r=>r.y)),x1=Math.max(...rs.map(r=>r.x+r.w)),y1=Math.max(...rs.map(r=>r.y+r.l));CX=(x0+x1)/2;CY=(y0+y1)/2;BB={w:x1-x0,l:y1-y0};
const room=R=>{const W=R.w,L=R.l,S=[[0,0,W,L,0],[0,0,W,L,180],[(W-L)/2,(L-W)/2,L,W,90],[(W-L)/2,(L-W)/2,L,W,-90]];return`<div class="room3" style="left:${R.x-CX}px;top:${R.y-CY}px;width:${W}px;height:${L}px"><div class="floor3"></div>${S.map((s,i)=>`<div class="wside" style="left:${s[0]}px;top:${s[1]}px;width:${s[2]}px;height:${s[3]}px;transform:rotateZ(${s[4]}deg)"><div class="wall3" style="width:${s[2]}px">${wallHTML(R,i,s[2])}</div></div>`).join('')}</div>`};
const leaves=DOORS.filter(d=>d.rooms.some(r=>vis.has(r))).map(d=>`<div class="leaf" data-door="${d.id}" style="left:${d.hx-CX}px;top:${d.hy-CY}px;transform:${leafT(d)}"><i style="width:${d.w}px;height:${d.h}px;top:${-d.h}px"></i></div>`).join('');
$('#world').innerHTML=`<div class="ground"></div>${rs.map(room).join('')}${leaves}<div class="pcs">${P.filter(p=>vis.has(p.room)).map(p=>`<div class="p3${p.id==sel?' sel':''}" data-id="${p.id}" style="left:${p.x-CX}px;top:${p.y-CY}px;transform:rotateZ(${p.r}deg)">${parts(p)}</div>`).join('')}</div>`}
function toggleDoor(id){doorOpen[id]=!doorOpen[id];const d=DOORS.find(q=>q.id==id),el=$(`.leaf[data-door="${id}"]`);if(el)el.style.transform=leafT(d);toast(d.n+(doorOpen[id]?' · opened':' · closed'))}
function drawVis(){$('#rvis').innerHTML=Object.entries(ROOMS).map(([id,r])=>`<div class="rv${vis.has(id)?' on':''}" data-rv="${id}"><i></i><span>${r.n}</span><small>${r.a} m²</small><button class="only" data-only="${id}">only</button></div>`).join('');
const all=vis.size==Object.keys(ROOMS).length,one=vis.size==1?[...vis][0]:null;$$('#scope button').forEach(b=>b.classList.toggle('on',all?b.dataset.scope=='all':b.dataset.scope==one))}
$('#rvis').addEventListener('click',e=>{const o=e.target.closest('[data-only]'),r=e.target.closest('[data-rv]');if(!r)return;if(o)vis=new Set([o.dataset.only]);else{const id=r.dataset.rv;vis.has(id)?vis.size>1&&vis.delete(id):vis.add(id)}drawVis();build3D();W.on?applyWalk():applyCam()});
const cam={h:165,rot:-35,tilt:58,lens:'normal',dist:1};
const PRE={eye:{h:165,tilt:80,rot:-30,lens:'wide',dist:1.35},arch:{h:165,tilt:58,rot:-35,lens:'normal',dist:1},bird:{h:400,tilt:35,rot:-20,lens:'normal',dist:.75},plan:{h:250,tilt:0,rot:0,lens:'tele',dist:1},read:{h:120,tilt:78,rot:-140,lens:'wide',dist:1.45},door:{h:165,tilt:76,rot:-270,lens:'wide',dist:1.3}};
function applyCam(){const sc=$('#scene');if(!sc.clientWidth||W.on)return;cam.tilt=Math.max(0,Math.min(85,cam.tilt));cam.dist=Math.max(.5,Math.min(2,+cam.dist.toFixed(2)));cam.h=Math.max(60,Math.min(600,cam.h));
const s=Math.min(sc.clientWidth/(BB.w*1.5),sc.clientHeight/(BB.l*1.65))*cam.dist;$('#world').style.transform=`rotateX(${cam.tilt}deg) rotateZ(${cam.rot}deg) scale3d(${s},${s},${s})`;
sc.style.perspective={wide:700,normal:1200,tele:2600}[cam.lens]+'px';sc.style.perspectiveOrigin=`50% ${45-(cam.h-165)/8}%`;
const deg=((-cam.rot%360)+360)%360;$('#c-h').textContent=cam.h+' cm';$('#c-rot').textContent=deg+'°';$('#c-tilt').textContent=cam.tilt+'°';$('#c-lens').textContent={wide:'24 mm',normal:'35 mm',tele:'85 mm'}[cam.lens];$('#c-dist').textContent=cam.dist<.85?'Far':cam.dist>1.25?'Near':'Room';
$('#c3n').setAttribute('transform',`rotate(${cam.rot})`);
const ey=95-cam.h/6;$('#camdia').innerHTML=`<path d="M8 95H232" stroke="${INK}" stroke-width="1.2"/><rect x="130" y="${95-250/6}" width="90" height="${250/6}" fill="#f3e7d0" stroke="${INK}" stroke-dasharray="3 2"/><path d="M40 ${ey}L${175} ${95-Math.cos(cam.tilt*Math.PI/180)*60}" stroke="#c8794a" stroke-dasharray="3 3"/><path d="M40 ${ey}V95M33 95L40 ${ey+12}L47 95" stroke="${INK}" fill="none"/><rect x="32" y="${ey-6}" width="16" height="10" fill="${INK}"/><text x="52" y="${ey-8}" font-family="IBM Plex Mono" font-size="8" fill="${INK}">${cam.h} cm</text><text x="136" y="${95-250/6-4}" font-family="IBM Plex Mono" font-size="8" fill="#6f6152">ceiling 250</text>`;
$$('#presets .pre').forEach(b=>{const q=PRE[b.dataset.pre];b.classList.toggle('on',Object.keys(q).every(k=>q[k]==cam[k]))})}
$('.cam').addEventListener('click',e=>{const b=e.target.closest('[data-c],[data-set],[data-pre]');if(!b)return;
if(b.dataset.c)cam[b.dataset.c]+=+b.dataset.d;if(b.dataset.set){const[k,v]=b.dataset.set.split(':');cam[k]=isNaN(v)?v:+v}if(b.dataset.pre)Object.assign(cam,PRE[b.dataset.pre]);applyCam()});
let orb=null;const sc=$('#scene');
sc.addEventListener('pointerdown',e=>{if(e.target.closest('.cam-bar,.walkui button'))return;if(W.on&&lockEl()){const d=nearDoor();if(d)toggleDoor(d.id);return}if(W.on&&!lockEl()){lock();return}orb={x:e.clientX,y:e.clientY,r:cam.rot,t:cam.tilt,yw:W.yaw,pt:W.pitch,m:0,el:e.target.closest('[data-id]'),dr:e.target.closest('[data-door]')};sc.setPointerCapture(e.pointerId)});
sc.addEventListener('pointermove',e=>{if(!orb)return;const dx=e.clientX-orb.x,dy=e.clientY-orb.y;orb.m=Math.max(orb.m,Math.abs(dx)+Math.abs(dy));if(orb.m<4)return;
if(W.on){W.yaw=orb.yw+dx*.25;W.pitch=Math.max(-35,Math.min(35,orb.pt-dy*.2));applyWalk();return}cam.rot=Math.round(orb.r-dx*.4);cam.tilt=Math.round(orb.t-dy*.3);applyCam()});
sc.addEventListener('pointerup',()=>{if(orb&&orb.m<4){if(orb.dr)toggleDoor(orb.dr.dataset.door);else if(W.on){}else if(orb.el){select(orb.el.dataset.id);switchTab('sel3')}else select(null)}orb=null});
sc.addEventListener('wheel',e=>{e.preventDefault();if(W.on)return;cam.dist*=e.deltaY<0?1.08:1/1.08;applyCam()},{passive:false});
$('#shot').onclick=()=>toast('View saved to the moodboard');
/* walkthrough */
const W={on:false,x:-150,y:330,yaw:90,pitch:0,keys:{}};
function inZone(x,y){for(const [id,r] of Object.entries(ROOMS))if(vis.has(id)&&x>r.x+22&&x<r.x+r.w-22&&y>r.y+22&&y<r.y+r.l-22)return r.n;for(const d of DOORS)if(doorOpen[d.id]){const z=d.zone;if(x>z[0]&&x<z[1]&&y>z[2]&&y<z[3])return 'Doorway'}if(doorOpen.d2&&x>-340&&x<-176&&y>120&&y<242)return 'Landing';return null}
function applyWalk(){const s=$('#scene'),Pp=Math.round(Math.max(420,s.clientWidth*.5));s.style.perspective=Pp+'px';s.style.perspectiveOrigin='50% 50%';$('#world').style.transform=`translateZ(${Pp}px) rotateX(${90-W.pitch}deg) rotateZ(${-W.yaw}deg) translate3d(${-(W.x-CX)}px,${-(W.y-CY)}px,${-cam.h}px)`;$('#wloc').textContent=inZone(W.x,W.y)||''}
const lockEl=()=>document.pointerLockElement==$('#scene');
function lock(){try{const p=$('#scene').requestPointerLock();p&&p.catch&&p.catch(()=>{})}catch(e){}}
document.addEventListener('pointerlockchange',()=>{document.body.classList.toggle('locked',lockEl());if(!lockEl()&&W.on&&!W.leaving)stopWalk()});
document.addEventListener('mousemove',e=>{if(!W.on||!lockEl())return;W.yaw+=e.movementX*.15;W.pitch=Math.max(-35,Math.min(35,W.pitch-e.movementY*.12));applyWalk()});
function startWalk(){lock();vis=new Set(Object.keys(ROOMS));drawVis();Object.assign(W,{on:true,x:-150,y:330,yaw:90,pitch:0,keys:{}});document.body.classList.add('walk');build3D();requestAnimationFrame(()=>{applyWalk();requestAnimationFrame(loop)})}
function stopWalk(){if(!W.on)return;W.on=false;W.leaving=1;if(lockEl())document.exitPointerLock();W.leaving=0;document.body.classList.remove('walk');$('#scene').style.perspectiveOrigin='';requestAnimationFrame(applyCam)}
let last=0;function loop(t){if(!W.on){last=0;return}const dt=Math.min(.05,(t-(last||t))/1000);last=t;const k=W.keys,f=(k.w||k.arrowup?1:0)-(k.s||k.arrowdown?1:0),st=(k.d?1:0)-(k.a?1:0),tr=(k.arrowright?1:0)-(k.arrowleft?1:0);
if(tr)W.yaw+=tr*80*dt;if(f||st){const sp=150*dt,r=W.yaw*Math.PI/180,dx=(Math.sin(r)*f+Math.cos(r)*st)*sp,dy=(-Math.cos(r)*f+Math.sin(r)*st)*sp;if(inZone(W.x+dx,W.y+dy)){W.x+=dx;W.y+=dy}else if(inZone(W.x+dx,W.y))W.x+=dx;else if(inZone(W.x,W.y+dy))W.y+=dy}
if(tr||f||st)applyWalk();requestAnimationFrame(loop)}
function nearDoor(){let best=null,bd=190;DOORS.forEach(d=>{const r=d.base*Math.PI/180,cx=d.hx+Math.cos(r)*d.w/2,cy=d.hy+Math.sin(r)*d.w/2,dd=Math.hypot(W.x-cx,W.y-cy);if(dd<bd){bd=dd;best=d}});return best}
$('#walk').onclick=startWalk;$('#wexit').onclick=stopWalk;
$('#wdoor').onclick=()=>{const d=nearDoor();d?toggleDoor(d.id):toast('Walk up to a door first')};
$$('#wpad [data-k]').forEach(b=>{const k=b.dataset.k;b.onpointerdown=e=>{e.stopPropagation();W.keys[k]=1};b.onpointerup=b.onpointerleave=()=>W.keys[k]=0});
const FL=[['Oiled oak','repeating-linear-gradient(0deg,rgba(80,50,25,.22) 0 1px,transparent 1px 20px),repeating-linear-gradient(90deg,transparent 0 119px,rgba(80,50,25,.14) 119px 120px),#cfa77a'],['Pale ash','repeating-linear-gradient(0deg,rgba(80,60,35,.14) 0 1px,transparent 1px 18px),#e6d3b3'],['Terracotta','linear-gradient(rgba(90,40,20,.3) 1px,transparent 1px) 0 0/30px 30px,linear-gradient(90deg,rgba(90,40,20,.3) 1px,transparent 1px) 0 0/30px 30px,#c07a55'],['Micro-cement','#cbc3b6']],WL=[['Lime wash','#e9e1d2'],['Warm white','#f5efe4'],['Clay','#d9a88a'],['Sage','#b9bfa3']];
function swatches(id,list,v,lab){const el=$(id);el.innerHTML=list.map((f,i)=>`<button title="${f[0]}" style="background:${f[1]}" class="${i?'':'on'}"></button>`).join('');el.onclick=e=>{const b=e.target.closest('button');if(!b)return;const i=[...el.children].indexOf(b);$$('button',el).forEach(x=>x.classList.toggle('on',x==b));$('#world').style.setProperty(v,list[i][1]);$(lab).textContent=list[i][0]};$('#world').style.setProperty(v,list[0][1])}
swatches('#sw-floor',FL,'--floor','#fl-n');swatches('#sw-wall',WL,'--wallc','#wl-n');
$('#tod').oninput=e=>{const t=+e.target.value,w=Math.min(1,Math.abs(t-13)/8),m=(a,b)=>Math.round(a+(b-a)*w);$('#tod-v').textContent=String(t).padStart(2,'0')+':00';sc.style.setProperty('--sky',`rgb(${m(236,240)},${m(232,208)},${m(222,168)})`)};
/* mode */
function setMode(m){if(m==2)stopWalk();document.body.classList.toggle('m3',m==3);$$('#mode button').forEach(b=>b.classList.toggle('on',b.dataset.m==m));if(m==3){build3D();requestAnimationFrame(applyCam)}else requestAnimationFrame(()=>{view();drawPieces()});showPane()}
$$('#mode button').forEach(b=>b.onclick=()=>setMode(+b.dataset.m));$$('[data-go]').forEach(b=>b.onclick=()=>setMode(3));
document.addEventListener('keyup',e=>{if(W.on)W.keys[e.key.toLowerCase()]=0});
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea'))return;if(W.on){const q=e.key.toLowerCase();if(q=='escape')stopWalk();else if(q=='e'){const d=nearDoor();d?toggleDoor(d.id):toast('Walk up to a door first')}else{W.keys[q]=1;if(q.startsWith('arrow'))e.preventDefault()}return}const k=e.key.toLowerCase(),T={v:'select',h:'pan',w:'wall',r:'room',d:'door',n:'window',p:'pass',j:'rad',k:'socket',m:'measure',i:'dim',l:'label',t:'note'};
if(k=='3')setMode(document.body.classList.contains('m3')?2:3);else if((k=='delete'||k=='backspace')&&sel)act('del');else if(k=='escape')select(null);else if(T[k]&&!document.body.classList.contains('m3'))setTool(T[k])});
addEventListener('resize',()=>{view();W.on?applyWalk():applyCam()});
if(innerWidth<1200)document.body.classList.add('nodrawer');
function setView(v){document.body.classList.toggle('calm',v=='calm');document.body.classList.toggle('quiet',v=='quiet');if(v=='calm'&&document.body.classList.contains('m3'))switchTab('fin');syncSel();drawLayers();requestAnimationFrame(()=>{view();applyCam()})}
$('#moreT').onclick=()=>{const o=document.body.classList.toggle('more');$('#moreT').lastChild.textContent=o?'−':'+';$('#moreT').firstChild.textContent='';$('#moreT').childNodes[0].textContent=o?'Fewer tools':'More tools'};
$('#fineC').onclick=()=>{const o=document.body.classList.toggle('finecam');$('#fineC').childNodes[0].textContent=o?'Hide camera controls':'Fine-tune camera';$('#fineC').lastChild.textContent=o?'−':'+'};
$$('.zfl [data-z]').forEach(b=>b.onclick=()=>b.dataset.z=='fit'?fit():zc(+b.dataset.z));
icons();drawLayers();showPane();requestAnimationFrame(()=>setScope(scope));
try{const v=localStorage.getItem('rp-planner-view2');if(v)setView(v)}catch(e){}
document.fonts&&document.fonts.ready.then(()=>placeFtb());
