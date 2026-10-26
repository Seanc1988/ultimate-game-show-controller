(() => {
  'use strict';
  const $=id=>document.getElementById(id),q=new URLSearchParams(location.search);
  const room=(q.get('room')||'').toUpperCase();let sid=q.get('sid')||'';
  let peer=null,conn=null,socket=null,joined=false,avatar='⭐',lastState=null,retry=null,attempt=0,joinTimer=null,peerConnectTimer=null,pendingJoin=null,forcedStop=false;
  const BATTLE_RTC={iceServers:[
    {urls:'stun:stun.relay.metered.ca:80'},
    {urls:'stun:stun.l.google.com:19302'},
    {urls:'stun:stun1.l.google.com:19302'},
    {urls:'turn:global.relay.metered.ca:80',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turn:global.relay.metered.ca:80?transport=tcp',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turn:global.relay.metered.ca:443',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'},
    {urls:'turns:global.relay.metered.ca:443?transport=tcp',username:'ba88079176616565ef57f408',credential:'2sorAbF4hI8eMjGO'}
  ]};
  const THEME_COLORS={classic:['#1640a4','#76115e','#22d9ff','#ffd34c'],hollywood:['#7d1026','#16070b','#f4d35e','#ff4d6d'],halloween:['#8b3b00','#35105a','#ff7b00','#b56cff'],christmas:['#087f3f','#751018','#ec1c24','#f6d55c'],easter:['#9d77d5','#ff8fc7','#8ce6ff','#fff08c'],winter:['#2879a7','#061326','#9de8ff','#fff'],fall:['#8d3c18','#3b1305','#e76f19','#f7c948'],summer:['#0aa56b','#056f9c','#00d9ff','#ffde3b'],beach:['#078f9c','#064a6b','#31e5e0','#ffd166'],patriotic:['#174e9b','#8c1520','#e63946','#f1faee'],vegas:['#7d163e','#22105e','#ffd60a','#ff2f7f']};
  const leet={0:'o',1:'i',2:'z',3:'e',4:'a',5:'s',6:'g',7:'t',8:'b',9:'g'};
  const blocked=['nigger','nigga','kike','spic','wetback','chink','gook','faggot','tranny','coon','raghead','whitepower','heilhitler','killall','rape','rapist','pedophile','childporn','fuckkids'];
  const clean=v=>String(v||'').replace(/[<>\r\n]/g,'').replace(/\s+/g,' ').trim().slice(0,30);
  const norm=v=>clean(v).toLowerCase().split('').map(c=>leet[c]||c).join('').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z]/g,'');
  const token=(()=>{try{let t=localStorage.getItem('stpBattleDeviceToken');if(!t){t=crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();localStorage.setItem('stpBattleDeviceToken',t)}return t}catch(_){return Math.random().toString(36).slice(2)}})();
  function status(v){$('status').textContent=v}
  function connected(){return !!(socket?.connected||conn?.open)}
  function send(data){
    if(socket?.connected){socket.emit('battle:player-message',{room,sessionId:sid,data});return true}
    if(conn?.open){conn.send(data);return true}
    return false;
  }
  function fmt(ms){return Number.isFinite(ms)&&ms>=0?(ms/1000).toFixed(ms<10000?2:1)+'s':'—'}
  function show(id){['join-card','play-card','rank-card','eliminated-card'].forEach(x=>$(x).classList.toggle('hidden',x!==id))}
  function fitPuzzleLines(text,maxCols=14,maxRows=4){const words=String(text||'').trim().split(/\s+/).filter(Boolean);if(words.some(word=>word.length>maxCols))return[];const lines=[];let line='';for(const word of words){if(!line)line=word;else if(`${line} ${word}`.length<=maxCols)line+=` ${word}`;else{lines.push(line);line=word}}if(line)lines.push(line);return lines.slice(0,maxRows)}
  function puzzle(text){const lines=fitPuzzleLines(text),topPad=Math.max(0,Math.floor((4-lines.length)/2));let html='';for(let row=0;row<4;row++){const line=lines[row-topPad]||'',leftPad=Math.max(0,Math.floor((14-line.length)/2));html+='<div class="puzzle-row">';for(let col=0;col<14;col++){const ch=line[col-leftPad]||'';if(!ch||ch===' ')html+='<span class="char inactive"></span>';else if(ch==='_')html+='<span class="char mask"></span>';else if(/[A-Z0-9]/.test(ch))html+=`<span class="char">${safe(ch)}</span>`;else html+=`<span class="char punct">${safe(ch)}</span>`}html+='</div>'}$('puzzle').innerHTML=html}
  function applyTheme(key){const colors=THEME_COLORS[key]||THEME_COLORS.classic;document.documentElement.style.setProperty('--theme-a',colors[0]);document.documentElement.style.setProperty('--theme-b',colors[1]);document.documentElement.style.setProperty('--cyan',colors[2]);document.documentElement.style.setProperty('--gold',colors[3])}
  function stats(s,prefix=''){const pre=prefix?prefix+'-':'';$(pre+'score').textContent=Number(s.score||0).toLocaleString();$(pre+'solved').textContent=s.puzzlesSolved||0;$(pre+'fastest').textContent=fmt(s.fastestMs)}
  function saveProfile(name){try{localStorage.setItem('stpBattleName',name);if(!String(avatar).startsWith('data:'))localStorage.setItem('stpBattleAvatar',avatar)}catch(_){}}
  function armJoinTimer(){clearTimeout(joinTimer);joinTimer=setTimeout(()=>{if(!joined){$('join').disabled=false;status('The host did not answer. Tap Reconnect, then try Join again.');$('reconnect').classList.remove('hidden')}},7000)}
  function render(s){
    lastState=s;if(s.sessionId&&sid&&s.sessionId!==sid)return;
    if(s.eliminated){show('eliminated-card');status('You are now spectating.');return}
    if(s.solved){show('rank-card');$('rank').textContent='#'+s.rank;$('points').textContent='+'+Number(s.points).toLocaleString()+' POINTS';stats(s,'rank');status('Correct answer submitted!');return}
    show('play-card');applyTheme(s.visualTheme);$('category').textContent=s.category||'GET READY';puzzle(s.masked);stats(s);$('solve-form').classList.toggle('hidden',s.phase!=='active'||!s.eligible);
    if(s.phase==='active'&&s.eligible)status('Solve it! Submit as many guesses as you need.');
    else if(s.phase==='active'&&!s.eligible)status('You joined during this puzzle. You can play the next one.');
    else if(s.phase==='results')status('Puzzle complete — check the leaderboard.');
    else if(s.phase==='finished')status('Game complete! Wait for the host to open the next battle.');
    else status(`Puzzle ${s.round||1} of ${s.roundsTotal||''} — waiting for the host.`);
  }
  function resetForJoin(message,newSid){
    clearTimeout(joinTimer);joined=false;pendingJoin=null;forcedStop=false;if(newSid)sid=newSid;
    try{localStorage.removeItem('stpBattleJoinedSession')}catch(_){}
    try{history.replaceState(null,'',`${location.pathname}?room=${encodeURIComponent(room)}&sid=${encodeURIComponent(sid)}`)}catch(_){}
    $('join').disabled=false;show('join-card');status(message||'Enter your name and tap Join.');
  }
  function handle(d){
    if(!d||typeof d!=='object')return;
    if(d.type==='joined'){clearTimeout(joinTimer);joined=true;pendingJoin=null;if(d.sessionId)sid=d.sessionId;try{localStorage.setItem('stpBattleJoinedSession',sid);history.replaceState(null,'',`${location.pathname}?room=${encodeURIComponent(room)}&sid=${encodeURIComponent(sid)}`)}catch(_){}$('join').disabled=false;show('play-card');status(`Welcome, ${d.name}! Waiting for the host.`);send({type:'request-state'});return}
    if(d.type==='state')return render(d);
    if(d.type==='correct'){navigator.vibrate?.([120,60,180]);return}
    if(d.type==='rejected'){$('feedback').textContent=d.reason||'Try again.';if(d.clear){$('answer').value='';$('answer').focus();navigator.vibrate?.(90)}setTimeout(()=>$('feedback').textContent='',1600);return}
    if(d.type==='name-rejected'||d.type==='join-denied'){clearTimeout(joinTimer);joined=false;pendingJoin=null;$('join').disabled=false;show('join-card');status(d.reason||'That name cannot be used.');return}
    if(d.type==='renamed'){try{localStorage.setItem('stpBattleName',d.name);$('name').value=d.name}catch(_){}status(`The host changed your name to ${d.name}.`);return}
    if(d.type==='eliminated'){show('eliminated-card');status('Thanks for playing!');return}
    if(d.type==='removed'){forcedStop=true;show('join-card');$('join').disabled=true;status(d.reason||'Removed by host');return}
    if(d.type==='roster-cleared')return resetForJoin(d.reason,d.sessionId);
    if(d.type==='new-battle')return resetForJoin(d.reason,d.sessionId);
  }
  function sendJoin(){
    const name=clean($('name').value),n=norm(name);
    if(!n){status('Please enter your name.');return}
    if(blocked.some(x=>n.includes(x))){status('That name cannot be used. Please choose another.');return}
    saveProfile(name);pendingJoin={type:'join',token,name,avatar};$('join').disabled=true;
    if(!send(pendingJoin)){status('Connecting to the game… Your join will send automatically.');connect();return}
    status('Joining the battle…');
    armJoinTimer();
  }
  function transportReady(){
    attempt=0;forcedStop=false;$('reconnect').classList.add('hidden');
    const saved=localStorage.getItem('stpBattleName')||'';
    const joinedSession=localStorage.getItem('stpBattleJoinedSession')||'';
    if(pendingJoin){send(pendingJoin);status('Joining the battle…');armJoinTimer()}
    else if((joined||joinedSession===sid)&&saved){joined=true;send({type:'join',token,name:saved,avatar});status('Rejoining your game…')}
    else{show('join-card');$('join').disabled=false;status(saved?'Ready to rejoin. Tap Join Battle Royale.':'Enter your name to join.')}
  }
  function connectLan(){
    if(socket){socket.connect();return}
    socket=window.io({auth:{mode:'battle-player'},transports:['websocket','polling'],reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:700,reconnectionDelayMax:4000});
    socket.on('connect',transportReady);socket.on('battle:host-message',handle);
    socket.on('battle:unavailable',d=>{if(!joined)status(d?.reason||'Waiting for the game host…');$('reconnect').classList.remove('hidden')});
    socket.on('battle:forced-disconnect',d=>{if(forcedStop)return;status(d?.reason||'The host reset the player list. You can join again.');$('join').disabled=false;show('join-card')});
    socket.on('disconnect',()=>{if(!forcedStop){status('Connection interrupted — reconnecting…');$('reconnect').classList.remove('hidden')}});
    socket.on('connect_error',()=>{status('Connecting to the game host…');$('reconnect').classList.remove('hidden')});
  }
  function connectPeer(){
    clearTimeout(retry);clearTimeout(peerConnectTimer);try{peer?.destroy()}catch(_){}$('reconnect').classList.add('hidden');status('Connecting to the host…');
    peer=new Peer(undefined,{debug:0,config:BATTLE_RTC});peer.on('open',()=>{conn=peer.connect('stp-battle-'+room,{reliable:true,serialization:'json'});peerConnectTimer=setTimeout(()=>{if(!conn?.open){try{peer?.destroy()}catch(_){}reconnect()}},12000);conn.on('open',()=>{clearTimeout(peerConnectTimer);transportReady()});conn.on('data',handle);conn.on('close',reconnect);conn.on('error',reconnect)});peer.on('disconnected',reconnect);peer.on('error',reconnect);
  }
  function connect(){
    if(!room){status('Scan the Battle Royale QR code to connect.');return}
    if(typeof window.io==='function')connectLan();else connectPeer();
  }
  function reconnect(){if(forcedStop)return;status('Connection interrupted — reconnecting…');$('reconnect').classList.remove('hidden');clearTimeout(retry);retry=setTimeout(connect,Math.min(9000,1200+attempt++*900))}
  function resizePhoto(file){return new Promise(resolve=>{const r=new FileReader;r.onload=()=>{const im=new Image;im.onload=()=>{const c=document.createElement('canvas'),size=160;c.width=c.height=size;const x=Math.max(0,(im.width-im.height)/2),y=Math.max(0,(im.height-im.width)/2),crop=Math.min(im.width,im.height);c.getContext('2d').drawImage(im,x,y,crop,crop,0,0,size,size);resolve(c.toDataURL('image/jpeg',.7))};im.src=r.result};r.readAsDataURL(file)})}
  $('room').textContent=room||'----';
  try{$('name').value=localStorage.getItem('stpBattleName')||'';avatar=localStorage.getItem('stpBattleAvatar')||'⭐';$('preview').textContent=avatar}catch(_){}
  $('avatars').onclick=e=>{const b=e.target.closest('button');if(!b)return;avatar=b.textContent;document.querySelectorAll('#avatars button').forEach(x=>x.classList.toggle('selected',x===b));$('preview').textContent=avatar};
  $('photo').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;avatar=await resizePhoto(f);$('preview').innerHTML=`<img src="${avatar}" alt="Your photo">`};
  $('join').onclick=sendJoin;
  $('solve-form').onsubmit=e=>{e.preventDefault();const answer=$('answer').value.trim();if(!answer)return;if(!send({type:'submit',answer}))return reconnect();$('feedback').textContent='Checking…'};
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;let recognition=null;
  $('voice-answer').onclick=()=>{if(!SpeechRecognition){$('feedback').textContent='Voice entry is not available in this browser. Tap the microphone on your phone keyboard instead.';setTimeout(()=>$('feedback').textContent='',3500);return}if(recognition){try{recognition.stop()}catch(_){}return}recognition=new SpeechRecognition();recognition.lang='en-US';recognition.interimResults=false;recognition.maxAlternatives=1;$('voice-answer').classList.add('listening');$('feedback').textContent='Listening… say the complete puzzle.';recognition.onresult=event=>{$('answer').value=String(event.results?.[0]?.[0]?.transcript||'').toUpperCase();$('answer').focus();$('feedback').textContent='Voice answer ready — check it, then tap SOLVE.'};recognition.onerror=()=>{$('feedback').textContent='I could not hear that. Try again or use the keyboard microphone.'};recognition.onend=()=>{recognition=null;$('voice-answer').classList.remove('listening');setTimeout(()=>{if($('feedback').textContent.startsWith('Voice answer ready'))return;$('feedback').textContent=''},2500)};try{recognition.start()}catch(_){recognition=null;$('voice-answer').classList.remove('listening')}};
  $('reconnect').onclick=()=>{if(socket){socket.disconnect();socket.connect()}else connectPeer()};
  setInterval(()=>{if(joined)send({type:'ping',ts:Date.now()})},8000);connect();
})();
