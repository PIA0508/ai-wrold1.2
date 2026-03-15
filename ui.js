// ===== ui.js v5 =====
const UI={
goTo(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id)?.classList.add('active')},
switchTab(btn,tid){btn.parentElement.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');const p=btn.closest('.screen-body')||btn.closest('.screen');p.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));document.getElementById(tid)?.classList.add('active')},
initChips(){document.querySelectorAll('.chip-group').forEach(g=>{g.querySelectorAll('.chip').forEach(c=>{c.addEventListener('click',()=>{g.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));c.classList.add('active')})})})},
toggleSidebar(side){const sb=document.getElementById(side==='left'?'sidebar-left':'sidebar-right');const ov=document.getElementById('sidebarOverlay');const open=sb.classList.contains('open');this.closeSidebars();if(!open){sb.classList.add('open');ov.classList.add('show')}},
closeSidebars(){document.querySelectorAll('.sidebar').forEach(s=>s.classList.remove('open'));document.getElementById('sidebarOverlay')?.classList.remove('show')},
showModal(id){document.getElementById(id)?.classList.add('show');if(id==='modal-map')document.getElementById('modalMapBody').innerHTML=WorldMap.renderMap();if(id==='modal-butterfly')this._renderButterflyPanel()},
closeModal(id){document.getElementById(id)?.classList.remove('show')},
showSettings(){Config.load();this.showModal('modal-settings')},
showLoading(t){document.getElementById('loadingText').textContent=t||'生成中...';document.getElementById('loading-overlay').style.display='flex'},
hideLoading(){document.getElementById('loading-overlay').style.display='none'},
cancelLoading(){this.hideLoading();this.toast('已取消');GameEngine._state='idle'},
showTyping(){document.getElementById('typingIndicator').style.display='flex'},
hideTyping(){document.getElementById('typingIndicator').style.display='none'},
toast(msg,dur=2000){const ex=document.querySelector('.toast-msg');if(ex)ex.remove();const el=document.createElement('div');el.className='toast-msg';el.textContent=msg;el.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);padding:8px 18px;border-radius:16px;background:rgba(20,20,40,.92);color:#fff;font-size:11px;z-index:500;border:1px solid var(--bd);max-width:75%';document.body.appendChild(el);setTimeout(()=>el.remove(),dur)},
scrollToBottom(){const f=document.getElementById('storyFlow');if(f)requestAnimationFrame(()=>{f.scrollTop=f.scrollHeight})},
checkApiStatus(){const s=document.getElementById('apiStatus');if(Config.get('apiKey')){s.textContent='● 已配置';s.classList.add('connected')}else{s.textContent='○ 未配置';s.classList.remove('connected')}},
renderPopularWorlds(){const c=document.getElementById('popularWorlds');if(!c)return;c.innerHTML=Config.popularWorlds.map(w=>`<div class="popular-card" onclick="GameEngine.usePopularWorld('${w.id}')"><div class="tag">${w.tag}</div><div class="card-emoji">${w.emoji}</div><h4>${w.name}</h4><p>${w.desc}</p></div>`).join('')},
showContinueButton(){document.getElementById('continueBar').style.display='block';this.scrollToBottom()},
hideContinueButton(){document.getElementById('continueBar').style.display='none'},
initReadProgress(){const flow=document.getElementById('storyFlow');const bar=document.getElementById('readProgressBar');if(!flow||!bar)return;flow.addEventListener('scroll',()=>{const pct=flow.scrollHeight<=flow.clientHeight?100:Math.round((flow.scrollTop/(flow.scrollHeight-flow.clientHeight))*100);bar.style.width=pct+'%'})},
switchSideTab(btn,tid){btn.parentElement.querySelectorAll('.stab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');const body=btn.closest('.sidebar')?.querySelector('.sidebar-body');if(!body)return;body.querySelectorAll('.stab-content').forEach(t=>t.classList.remove('active'));body.querySelector('#'+tid)?.classList.add('active')},
renderCharacterCards(chars){const c=document.getElementById('characterCards');if(!c)return;this._previewChars=chars;
c.innerHTML=chars.map((ch,i)=>`<div class="char-card" onclick="UI.previewCharacter(${i})"><div class="char-avatar">${ch.avatar||'👤'}</div><div class="char-info"><h4>${ch.name}</h4><div class="char-role">${ch.role}·${ch.gender}·${ch.age}岁</div><div class="char-desc">${ch.background||''}</div><div class="char-tap-hint">点击查看→</div></div><button class="char-select-btn" onclick="event.stopPropagation();GameEngine.selectCharacter(${i})">选择</button></div>`).join('');
const tg=document.createElement('div');tg.className='commentary-toggle';tg.innerHTML=`<div class="toggle-row" onclick="UI.toggleCommentary()"><div class="toggle-info"><span class="toggle-icon">🎙️</span><div><div class="toggle-label">单元锐评</div></div></div><div class="toggle-switch ${GameEngine._commentaryEnabled?'on':''}" id="commentarySwitch"><div class="toggle-knob"></div></div></div>`;c.appendChild(tg);
const sd=document.createElement('div');sd.className='form-section';sd.style.marginTop='8px';sd.innerHTML=`<label style="font-size:10px">✍️ 叙事风格</label><div class="chip-group" id="styleChips">${Object.entries(GameEngine.STYLES).map(([k,v])=>`<button class="chip ${k===GameEngine._writingStyle?'active':''}" data-val="${k}" onclick="UI.selectStyle('${k}')">${v.name}</button>`).join('')}</div>`;c.appendChild(sd);
const btn=document.createElement('button');btn.className='btn-primary btn-full';btn.style.marginTop='10px';btn.innerHTML='🚀 确认并开始';btn.onclick=()=>GameEngine.confirmCharacterAndStart();c.appendChild(btn)},
toggleCommentary(){GameEngine._commentaryEnabled=!GameEngine._commentaryEnabled;document.getElementById('commentarySwitch')?.classList.toggle('on',GameEngine._commentaryEnabled)},
selectStyle(key){GameEngine._writingStyle=key;document.querySelectorAll('#styleChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.val===key))},
submitQuickCreate(){const get=id=>{const el=document.querySelector('#'+id+' .chip.active');return el?el.dataset.val:null};const g=get('qGenre'),e=get('qEra'),t=get('qTone'),co=get('qConflict'),s=get('qScale');if(!g)return this.toast('选择世界类型');if(!e)return this.toast('选择时代');if(!t)return this.toast('选择基调');if(!co)return this.toast('选择冲突');if(!s)return this.toast('选择规模');GameEngine.quickCreateWorld({genre:g,era:e,tone:t,conflict:co,scale:s})},
previewCharacter(i){const c=this._previewChars?.[i];if(!c)return;const stats=DiceSystem.parseOrGenerate(c);const mbti=c.mbti||PsycheSystem.inferMBTI(c);const vals=c.values||PsycheSystem.inferValues(c);const sb=DiceSystem.STATS.map(s=>`<div class="stat-row"><span class="stat-label">${DiceSystem.STAT_NAMES[s]}</span><div class="stat-bar"><div class="stat-fill ${s.toLowerCase()}" style="width:${(stats[s]/20)*100}%"></div></div><span class="stat-val">${stats[s]}</span></div>`).join('');document.getElementById('modalCharName').textContent=c.name;document.getElementById('modalCharBody').innerHTML=`<div class="char-detail-header"><div class="char-detail-avatar">${c.avatar||'👤'}</div><div class="char-detail-info"><h4>${c.name}</h4><p>${c.role||'?'}·${c.gender||'?'}·${c.age||'?'}岁</p><p style="color:var(--ac);font-size:9px">MBTI:${mbti}</p></div></div><div class="detail-section"><h5>📖 背景</h5><p>${c.background||'暂无'}</p></div><div class="detail-section"><h5>📊 能力</h5><div class="stat-bars">${sb}</div></div><div class="detail-section"><h5>💎 价值观</h5><p>${vals.join('·')}</p></div><button class="btn-primary btn-full" style="margin-top:10px" onclick="UI.closeModal('modal-character');GameEngine.selectCharacter(${i})">✅ 选择</button>`;this.showModal('modal-character')},
initGameScreen(){this.updateCharacterStatus();this.renderMemoryList();this.renderRelationships();this.initReadProgress();this.updateResourceBar();this.updateTokenBudget()},

updateResourceBar(){const el=document.getElementById('resBar');
if(el)el.innerHTML=ResourceSystem.renderTopbar();
else{const bar=document.createElement('div');bar.id='resBar';
const topbar=document.querySelector('.game-topbar');if(topbar)topbar.insertAdjacentElement('afterend',bar)}
this.updateTokenBudget()},
// ★ 修复：状态按激活等级分组，显示完整信息
updateCharacterStatus(){const c=document.getElementById('characterStatusList');if(!c)return;const all=AgentSystem.getAllAgents().filter(a=>a.status.alive);const g={focused:[],active:[],aware:[],dormant:[]};all.forEach(a=>(g[a.activation]||g.dormant).push(a));let h='';const rg=(l,ic,arr)=>{if(!arr.length)return'';return`<div style="font-size:9px;color:var(--tx2);padding:3px 0">${ic} ${l} (${arr.length})</div>`+arr.map(a=>AgentSystem.formatStatusCard(a)).join('')};h+=rg('聚焦','🔴',g.focused);h+=rg('活跃','🟢',g.active);h+=rg('感知','🟡',g.aware);h+=rg('休眠','⚫',g.dormant);c.innerHTML=h||'<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">暂无</p>'},
// ★ 修复：记忆按章节分组+蝴蝶效应入口
renderMemoryList(){const c=document.getElementById('memoryList');if(!c)return;const ms=MemorySystem.getMemories();if(!ms.length){c.innerHTML='<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">故事尚未开始</p>';return}const chs={};ms.forEach(m=>{const ch=m.chapter||'未知';if(!chs[ch])chs[ch]=[];chs[ch].push(m)});let h='';const chains=ButterflySystem.getChains();if(chains.length)h+=`<div class="memory-item" style="border-left-color:var(--ac2);cursor:pointer" onclick="UI.showModal('modal-butterfly')"><div class="mem-chapter" style="color:var(--ac2)">🦋 蝴蝶效应 (${chains.length})</div><div class="mem-summary">查看选择如何改变故事</div></div>`;Object.entries(chs).reverse().forEach(([ch,items])=>{h+=`<div style="font-size:9px;color:var(--ac);padding:3px 0;font-weight:600">${ch}</div>`;items.slice(-5).forEach(m=>{h+=`<div class="memory-item ${m.isDigest?'is-digest':''}"><div class="mem-chapter">${m.isDigest?'📋':''}回合${m.turn||'?'}</div><div class="mem-summary">${m.summary}</div></div>`})});c.innerHTML=h},
// ★ 修复：关系图只显示玩家相关+主要角色间的关系
renderRelationships(){const c=document.getElementById('relationshipList');if(!c)return;
const all=AgentSystem.getAllAgents().filter(a=>a.status.alive);
const pcId=GameEngine._playerCharacterId;
const pc=AgentSystem.getAgent(pcId);
if(!pc){c.innerHTML='<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">暂无</p>';return}

// 1. 玩家与所有认识的角色的关系（aware以上）
const pcPairs=[];
all.forEach(a=>{if(a.id===pcId)return;if(a.activation==='dormant')return;
const rel=pc.relationships[a.id];if(rel)pcPairs.push({a1:pc,a2:a,rel})});
pcPairs.sort((a,b)=>Math.abs(b.rel.value)-Math.abs(a.rel.value));

// 2. 主要角色之间的关系（仅focused/active之间，且不含玩家）
const majorPairs=[];const seen=new Set();
const majors=all.filter(a=>a.id!==pcId&&(a.activation==='focused'||a.activation==='active'));
for(let i=0;i<majors.length;i++){for(let j=i+1;j<majors.length;j++){
const key=[majors[i].id,majors[j].id].sort().join('_');if(seen.has(key))continue;seen.add(key);
const rel=majors[i].relationships[majors[j].id];if(rel&&Math.abs(rel.value)>15)majorPairs.push({a1:majors[i],a2:majors[j],rel})}}
majorPairs.sort((a,b)=>Math.abs(b.rel.value)-Math.abs(a.rel.value));

let h='';
if(pcPairs.length){h+=`<div style="font-size:9px;color:var(--ac);padding:3px 0;font-weight:600">★ 你的关系</div>`;
h+=pcPairs.map(p=>BondSystem.formatRelationCard(p.a1,p.a2,p.rel)).join('')}
if(majorPairs.length){h+=`<div style="font-size:9px;color:var(--tx2);padding:6px 0 3px;border-top:1px solid var(--bd)">👥 角色间</div>`;
h+=majorPairs.slice(0,5).map(p=>BondSystem.formatRelationCard(p.a1,p.a2,p.rel)).join('')}
c.innerHTML=h||'<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">暂无关系</p>'},
// ★ 新增：蝴蝶效应面板
_renderButterflyPanel(){const body=document.getElementById('modalButterflyBody');if(!body)return;const chains=ButterflySystem.getChains();const choices=ButterflySystem.getChoices();if(!chains.length&&!choices.length){body.innerHTML='<p style="text-align:center;color:var(--tx2);padding:20px">还没有蝴蝶效应</p>';return}let h='';if(chains.length){h+='<div style="font-size:11px;color:var(--ac);margin-bottom:6px;font-weight:600">🦋 因果链 ('+chains.length+')</div>';chains.slice().reverse().forEach(ch=>h+=ButterflySystem.formatChainHTML(ch))}if(choices.length){h+='<div style="font-size:11px;color:var(--tx1);margin:10px 0 4px;font-weight:600">📝 选择记录</div>';choices.slice(-15).reverse().forEach(ch=>{h+=`<div style="padding:3px 0;border-bottom:1px solid var(--bd);font-size:10px"><span style="color:var(--tx2)">回合${ch.turn}</span> 「${ch.text}」${ch.consequences.length?'<span style="color:var(--ac2)"> →'+ch.consequences[0]+'</span>':''}</div>`})}body.innerHTML=h},
showCharacterDetail(id){const a=AgentSystem.getAgent(id);if(!a)return;const sb=DiceSystem.STATS.map(s=>`<div class="stat-row"><span class="stat-label">${DiceSystem.STAT_NAMES[s]}</span><div class="stat-bar"><div class="stat-fill ${s.toLowerCase()}" style="width:${(a.stats[s]/20)*100}%"></div></div><span class="stat-val">${a.stats[s]}</span></div>`).join('');const isPC=a.id===GameEngine._playerCharacterId;const lvl=AgentSystem.ACTIVATION[a.activation]||{label:'?'};document.getElementById('modalCharName').textContent=a.name;document.getElementById('modalCharBody').innerHTML=`<div class="char-detail-header"><div class="char-detail-avatar">${a.avatar}</div><div class="char-detail-info"><h4>${isPC?'★ ':''}${a.name}</h4><p>${a.role}·${a.gender}·${a.age}岁</p><p style="color:var(--ac);font-size:9px">${a.psyche.mbti}|${lvl.label}|权重${a.weight}${isPC?' |你':''}</p></div></div><div class="detail-section"><h5>📊 能力</h5><div class="stat-bars">${sb}</div></div><div class="detail-section"><h5>📝 背景</h5><p>${a.background||'未知'}</p></div><div class="detail-section"><h5>🎯 目标</h5><p>${a.goals.join('、')||'暂无'}</p></div>${a.speechPattern?`<div class="detail-section"><h5>🗣️ 语气</h5><p>${a.speechPattern}</p></div>`:''}<div class="detail-section"><h5>📋 状态</h5><p>HP:${a.status.hp}|${a.status.mood}|${a.status.location}</p><p style="font-size:9px;color:var(--tx2)">提及${a.mentionCount}次|连续${a.consecutiveMentions}</p></div>`;this.showModal('modal-character')},
showPsyche(id){const a=AgentSystem.getAgent(id);if(!a)return;document.getElementById('modalPsycheBody').innerHTML=PsycheSystem.formatPsycheDetail(a.psyche);this.showModal('modal-psyche')},
showRelationDetail(id1,id2){const a1=AgentSystem.getAgent(id1),a2=AgentSystem.getAgent(id2);if(!a1||!a2)return;const rel=a1.relationships[id2];if(!rel)return;const rt=BondSystem.getRelationType(rel.value);let h=`<div style="text-align:center;margin-bottom:8px"><div style="font-size:20px">${a1.avatar} ↔ ${a2.avatar}</div><div style="font-size:11px">${a1.name}—${a2.name}</div><div style="font-size:12px;color:${rt.color};font-weight:600">${rt.icon} ${rt.label}</div></div>`;h+=BondSystem.formatAffinityBar(rel.value);h+=`<div class="detail-section" style="margin-top:6px"><h5>构成</h5><p>心理:${rel.psycheMatch>0?'+':''}${rel.psycheMatch}|价值观:${rel.valueMatch>0?'+':''}${rel.valueMatch}|行为:${rel.actionMod>0?'+':''}${rel.actionMod}</p></div>`;if(rel.bondActive)h+=`<div class="detail-section"><h5>${rel.bondType==='trust'?'🔗 羁绊':'⚔️ 宿敌'}</h5><p>${rel.bondType==='trust'?'骰子+2':'骰子-1'}</p></div>`;if(rel.history.length){h+='<div class="detail-section"><h5>变化</h5>';rel.history.slice(-6).forEach(e=>{h+=`<p style="font-size:9px;color:var(--tx2)">${e.delta>0?'💚+':'💔'}${e.delta} ${e.reason}→${e.newValue}</p>`});h+='</div>'}document.getElementById('modalRelTitle').textContent=a1.name+'↔'+a2.name;document.getElementById('modalRelBody').innerHTML=h;this.showModal('modal-relation')},
showRegenerateButton(){const ex=document.getElementById('regenBtn');if(ex)ex.remove();const btn=document.createElement('div');btn.id='regenBtn';btn.style.cssText='text-align:center;padding:3px';btn.innerHTML='<button onclick="GameEngine.regenerateLast();this.parentElement.remove()" style="background:none;border:1px solid var(--bd);border-radius:10px;color:var(--tx2);font-size:9px;padding:2px 10px;cursor:pointer">🔄 重新生成</button>';document.getElementById('storyContent')?.appendChild(btn);this.scrollToBottom()},
hideRegenerateButton(){document.getElementById('regenBtn')?.remove()},
_timerInterval:null,
showChoices(choices,timer=0){const area=document.getElementById('choiceArea');if(!choices?.length){area.innerHTML='';return}const keys='ABCD';
// ★ 先渲染选项，不启动计时
area.innerHTML=`<div class="choice-handle open" onclick="UI.toggleChoicePanel()"><span class="handle-icon">▲</span><span class="handle-text">行动</span><span class="handle-count">${choices.length}</span></div><div class="choice-body open" id="choiceBody"><div class="choice-list">${choices.slice(0,4).map((c,i)=>`<button class="choice-btn" onclick="GameEngine.makeChoice('${c.replace(/'/g,"\\'")}')"><span class="choice-key">${keys[i]}</span><span class="choice-text">${c}</span></button>`).join('')}</div></div>`;
// ★ 选项渲染完成后再插入计时器并启动
if(timer>0){const timerDiv=document.createElement('div');timerDiv.className='choice-timer';timerDiv.innerHTML=`<div class="timer-ring" id="timerRing">${timer}</div><span class="timer-text" id="timerText">限时决断！</span>`;area.insertBefore(timerDiv,area.firstChild);this._startTimer(timer)}},
_startTimer(s){this.clearTimer();this._timerSeconds=s;const ring=document.getElementById('timerRing');const text=document.getElementById('timerText');this._timerInterval=setInterval(()=>{this._timerSeconds--;if(ring)ring.textContent=this._timerSeconds;if(this._timerSeconds<=3&&text)text.classList.add('urgent');if(this._timerSeconds<=0){this.clearTimer();GameEngine.onTimedChoiceExpired()}},1000)},
clearTimer(){if(this._timerInterval){clearInterval(this._timerInterval);this._timerInterval=null}},
toggleChoicePanel(){const b=document.getElementById('choiceBody');const h=document.querySelector('.choice-handle');if(!b)return;b.classList.toggle('open');h?.classList.toggle('open')},
hideChoices(){this.clearTimer();document.getElementById('choiceArea').innerHTML=''},
showButterflyEffect(chain){const el=document.createElement('div');el.className='bf-toast';el.innerHTML=ButterflySystem.formatChainHTML(chain);document.body.appendChild(el);el.addEventListener('click',()=>el.remove());setTimeout(()=>{if(el.parentNode)el.remove()},6000)},

// ★ Token预算显示
updateTokenBudget(){const el=document.getElementById('tokenBudget');if(!el)return;
const used=MemorySystem.estimateTokens();const max=8000;const pct=Math.min(100,Math.round((used/max)*100));
const color=pct>85?'var(--no)':pct>60?'var(--wn)':'var(--ac)';
el.innerHTML=`<div class="token-bar"><div class="token-fill" style="width:${pct}%;background:${color}"></div></div><span class="token-text" style="color:${color}">${pct}%</span>`},

// ★ 重新生成
showRegenerateButton(){const ex=document.getElementById('regenBar');if(ex)ex.remove();
const bar=document.createElement('div');bar.id='regenBar';bar.style.cssText='display:flex;justify-content:center;gap:8px;padding:3px;';
bar.innerHTML='<button onclick="GameEngine.regenerateLast()" style="background:none;border:1px solid var(--bd);border-radius:10px;color:var(--tx2);font-size:9px;padding:2px 10px;cursor:pointer">🔄 换一个版本</button>';
document.getElementById('storyContent')?.appendChild(bar);this.scrollToBottom()},
hideRegenerateButton(){document.getElementById('regenBar')?.remove()},

// ★ Swipe控制
showSwipeControls(idx,total){let bar=document.getElementById('swipeBar');
if(!bar){bar=document.createElement('div');bar.id='swipeBar';bar.style.cssText='display:flex;align-items:center;justify-content:center;gap:10px;padding:4px;font-size:10px;color:var(--tx1)';
document.getElementById('storyContent')?.appendChild(bar)}
bar.innerHTML=`<button onclick="GameEngine.swipeTo(-1)" style="background:none;border:none;color:${idx>0?'var(--ac)':'var(--tx2)'};font-size:14px;cursor:pointer" ${idx<=0?'disabled':''}>←</button><span>${idx+1}/${total}</span><button onclick="GameEngine.swipeTo(1)" style="background:none;border:none;color:${idx<total-1?'var(--ac)':'var(--tx2)'};font-size:14px;cursor:pointer" ${idx>=total-1?'disabled':''}>→</button><button onclick="GameEngine.clearSwipe()" style="background:none;border:1px solid var(--bd);border-radius:8px;color:var(--ok);font-size:9px;padding:1px 8px;cursor:pointer">✓</button>`;
this.scrollToBottom()},
hideSwipeControls(){document.getElementById('swipeBar')?.remove()},

// ★ Lorebook
renderLorebook(){const body=document.getElementById('modalLorebookBody');if(body)body.innerHTML=Lorebook.renderList()},

// ★ 遭遇状态栏
showEncounterBar(){const c=document.getElementById('encounterBarContainer');if(c)c.innerHTML=EncounterSystem.renderBar()},
hideEncounterBar(){const c=document.getElementById('encounterBarContainer');if(c)c.innerHTML=''},

initParticles(){const f=document.getElementById('particles');if(!f)return;for(let i=0;i<20;i++){const p=document.createElement('div');p.className='p';const sz=Math.random()*3+1;p.style.width=sz+'px';p.style.height=sz+'px';p.style.left=Math.random()*100+'%';p.style.animationDuration=(Math.random()*8+4)+'s';p.style.animationDelay=(Math.random()*5)+'s';f.appendChild(p)}}
};