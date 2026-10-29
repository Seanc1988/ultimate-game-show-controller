(()=>{
  'use strict';
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search),room=(q.get('room')||'').toUpperCase();
  const safe=value=>String(value??'').replace(/[<>&"']/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[char]));
  const RTC={iceServers:[
    {urls:'stun:stun.relay.metered.ca:80'},{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:global.relay.metered.ca:80',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turn:global.relay.metered.ca:80?transport=tcp',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turn:global.relay.metered.ca:443',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turns:global.relay.metered.ca:443?transport=tcp',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'}
  ]};
  const THEMES={classic:['#1640a4','#76115e','#22d9ff','#ffd34c','#058b57'],hollywood:['#7d1026','#16070b','#f4d35e','#ff4d6d','#5e0b1d'],halloween:['#8b3b00','#35105a','#ff7b00','#b56cff','#59310a'],christmas:['#087f3f','#751018','#ec1c24','#f6d55c','#087f3f'],easter:['#9d77d5','#ff8fc7','#8ce6ff','#fff08c','#62b58f'],winter:['#2879a7','#061326','#9de8ff','#fff','#176789'],fall:['#8d3c18','#3b1305','#e76f19','#f7c948','#8d3c18'],summer:['#0aa56b','#056f9c','#00d9ff','#ffde3b','#07864d'],beach:['#078f9c','#064a6b','#31e5e0','#ffd166','#168d70'],patriotic:['#174e9b','#8c1520','#e63946','#f1faee','#174e9b'],vegas:['#7d163e','#22105e','#ffd60a','#ff2f7f','#076b45']};
  let peer=null,conn=null,retry=null,attempt=0,state=null;
  function theme(key){const colors=THEMES[key]||THEMES.classic;['--a','--b','--cyan','--gold','--cover'].forEach((name,index)=>document.documentElement.style.setProperty(name,colors[index]))}
  function board(cells){if(!Array.isArray(cells))return;$('board').innerHTML=cells.map(row=>'<div class="row">'+row.map(cell=>`<span class="tile ${safe(cell.kind||'inactive')}">${cell.kind==='revealed'||cell.kind==='punct'?safe(cell.ch):''}</span>`).join('')+'</div>').join('')}
  function qr(url){if(!url||$('qr').dataset.url===url)return;try{const code=window.qrcode(0,'M');code.addData(url);code.make();$('qr').innerHTML=code.createSvgTag({cellSize:5,margin:1,scalable:true});$('lobby-qr').innerHTML=code.createSvgTag({cellSize:5,margin:2,scalable:true});$('qr').dataset.url=url}catch(_){}}
  function rows(list){return (list||[]).slice(0,10).map(p=>`<div class="leader-row"><b>#${p.rank}</b><span>${safe(p.name)}</span><strong>${Number(p.score||0).toLocaleString()}</strong></div>`).join('')}
  function clock(){if(!state)return;const seconds=state.autoDeadline?Math.max(0,Math.ceil((state.autoDeadline-Date.now())/1000)):0;$('countdown-number').textContent=seconds||'';$('countdown-label').textContent=state.autoLabel||'NEXT PUZZLE STARTS IN';$('lobby-clock').textContent=state.phase==='intermission'&&seconds?`${state.autoLabel||'NEXT GAME STARTS IN'} ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:''}
  function render(s){
    state=s;theme(s.visualTheme);board(s.board);qr(s.joinUrl);$('round').textContent=s.round?`PUZZLE ${s.round} / ${s.roundsTotal}`:'WAITING';$('category').textContent=s.category||'GET READY';$('active').textContent=s.activeCount||0;$('solved').textContent=s.solves?.length||0;$('left').textContent=(s.masked?.match(/_/g)||[]).length;$('join').classList.toggle('hidden',!s.registrationOpen);$('finishers').textContent=s.phase==='grace'?'FINAL ANSWERS — 7 SECONDS!':s.solves?.length?`${s.solves.length} PLAYERS HAVE SOLVED`:'SOLVE THE PUZZLE ON YOUR PHONE!';
    $('results').classList.toggle('show',s.phase==='results');$('winner').classList.toggle('show',s.phase==='finished');$('countdown').classList.toggle('show',s.phase==='countdown');$('lobby').classList.toggle('show',['lobby','intermission'].includes(s.phase));
    $('lobby-room').textContent=s.roomCode||room;$('lobby-message').textContent=s.phase==='intermission'?'INTERMISSION — NEW PLAYERS CAN JOIN':'SCAN TO JOIN THE GAME';
    if(s.phase==='results'){$('answer').textContent=s.answer||'PUZZLE COMPLETE';$('game').innerHTML=rows(s.current);$('alltime').innerHTML=rows(s.allTime)}
    if(s.phase==='finished'){const winner=(s.current||[]).find(p=>!p.eliminated)||(s.current||[])[0];$('winner-name').childNodes[0].nodeValue=(winner?.name||'WINNER')+' ';$('winner-score').textContent=winner?`${Number(winner.score).toLocaleString()} POINTS`:''}
    $('status').hidden=true;clock();
  }
  function connect(){clearTimeout(retry);try{peer?.destroy()}catch(_){}if(!room){$('status').textContent='Missing room code';return}peer=new Peer(undefined,{debug:0,config:RTC});peer.on('open',()=>{conn=peer.connect('stp-battle-'+room,{reliable:true,serialization:'json'});conn.on('open',()=>{attempt=0;conn.send({type:'audience-join'})});conn.on('data',data=>data?.type==='battle-state'&&render(data));conn.on('close',reconnect);conn.on('error',reconnect)});peer.on('disconnected',reconnect);peer.on('error',reconnect)}
  function reconnect(){$('status').hidden=false;$('status').textContent='Reconnecting to the host…';clearTimeout(retry);retry=setTimeout(connect,Math.min(9000,1200+attempt++*900))}
  $('full').onclick=async()=>{try{await document.documentElement.requestFullscreen();$('full').hidden=true}catch(_){}};
  setInterval(clock,250);connect();
})();
