// ===== engine.js v5 - 导演系统+Agent逻辑+懒激活+文风脱水 =====
const GameEngine={
_state:'idle',_world:null,_plotOutline:null,_currentChapter:'危机',_chapterIndex:0,_turnCount:0,
_choicesPending:false,_commentaryEnabled:true,_playerCharacterId:null,
_lastStoryDiv:null,_lastNarrativeText:'',_paused:false,_writingStyle:'literary',_chapterStartTurn:0,

STYLES:{
literary:{name:'文学派',anchor:'冷调克制，短句与长句交替呼吸。通感隐喻，留白多于解释。',paceMap:{action:'150-250字，断句如刀',dialogue:'250-350字，潜台词',explore:'350-500字，五感',emotion:'250-400字，意识流'}},
webnovel:{name:'网文派',anchor:'节奏明快，钩子密集，对话占比高，动作干脆。',paceMap:{action:'200-300字',dialogue:'300-400字',explore:'200-300字',emotion:'200-300字'}},
cinematic:{name:'影视派',anchor:'蒙太奇剪辑，台词精炼，注重画面光影。',paceMap:{action:'200-300字',dialogue:'250-350字',explore:'300-450字',emotion:'200-350字'}},
classical:{name:'古风派',anchor:'半文半白，四字短语与长句交错，古典韵律。',paceMap:{action:'200-300字',dialogue:'250-350字',explore:'350-500字',emotion:'300-400字'}}
},

// ===== API（20s超时+1次重试） =====
async callAI(msgs,opts={}){
const k=Config.get('apiKey'),u=Config.get('apiUrl'),m=Config.get('model');
if(!k){UI.toast('请先配置API Key');UI.showSettings();throw new Error('No API key')}
for(let attempt=0;attempt<=(opts.retries||1);attempt++){
if(attempt>0){UI.showLoading('重试中...');await new Promise(r=>setTimeout(r,600))}
try{const ac=new AbortController();const tm=setTimeout(()=>ac.abort(),opts.timeout||20000);
const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},
body:JSON.stringify({model:m,messages:msgs,max_tokens:opts.maxTokens||2048,temperature:opts.temperature||0.8,stream:false}),signal:ac.signal});
clearTimeout(tm);if(!r.ok)throw new Error('HTTP '+r.status);
const d=await r.json();return d.choices[0].message.content}
catch(e){if(e.name==='AbortError')e.message='超时(20s)';if(attempt>=(opts.retries||1))throw e}}},

async callAIStream(msgs,onChunk,opts={}){
const k=Config.get('apiKey'),u=Config.get('apiUrl'),m=Config.get('model');
if(!k)throw new Error('No key');
const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+k},
body:JSON.stringify({model:m,messages:msgs,max_tokens:opts.maxTokens||2048,temperature:opts.temperature||0.8,stream:true})});
if(!r.ok)throw new Error('HTTP '+r.status);
const reader=r.body.getReader();const dec=new TextDecoder();let full='',buf='';
while(true){const{done,value}=await reader.read();if(done)break;
buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||'';
for(const ln of lines){const t=ln.trim();if(!t||t==='data: [DONE]'||!t.startsWith('data: '))continue;
try{const j=JSON.parse(t.slice(6));const c=j.choices?.[0]?.delta?.content;if(c){full+=c;onChunk(c,full)}}catch(e){}}}
return full},

// ========================================
// ★ 导演系统 Prompt（Director System）
// ========================================
_buildDirectorPrompt(){
const pc=AgentSystem.getAgent(this._playerCharacterId);
const style=this.STYLES[this._writingStyle]||this.STYLES.literary;
const sceneType=this._detectSceneType();
const pace=style.paceMap[sceneType]||style.paceMap.explore;
const focused=AgentSystem.getActiveAgents().filter(a=>a.activation==='focused');
const active=AgentSystem.getActiveAgents().filter(a=>a.activation==='active');
const focusedDescs=focused.map(a=>AgentSystem.getAgentPromptDesc(a.id)).join('\n');
const activeDescs=active.map(a=>AgentSystem.getAgentPromptDesc(a.id)).join('\n');
return`你是「${this._world.name}」的叙事者。用第二人称"你"写故事。「${pc?.name||'主角'}」="你"。

[世界] ${this._world.description?.substring(0,100)||''}
[角色]
${focusedDescs}
${activeDescs}

[风格] ${style.anchor} ${pace}
${EncounterSystem.getPromptDesc()}
[格式] 先写300-500字纯故事（无标记），然后写[META]块：
[META]
PSYCHE:角色名:心理
BOND:A:B:+值:原因
ENCOUNTER:字段:值
[/META]

遭遇ENCOUNTER字段说明：
战斗时：weapon/skill/item/terrain/objective/enemy_pos
辩论时：fact/argument/enemy_pos/objective
博弈时：leverage/objective

[规则] 用"你"称呼主角|不写选项|不出现"玩家"|冷调叙事
${EncounterSystem.isActive()?'★遭遇中剩'+EncounterSystem.getTurnsLeft()+'回合，每回合必须推进局势变化，引入新元素（新敌人/新证据/新筹码），不要重复上回合的内容。':''}
${DiceSystem.getPendingRollsPrompt()}
[大纲] ${this._plotOutline?.premise||''}|当前:${this._currentChapter}`
},

_detectSceneType(){
const t=this._lastNarrativeText||'';
const ch=this._plotOutline?.chapters?.[this._chapterIndex];
const s=(ch?.keyEvents||[]).join(' ')+' '+t.substring(Math.max(0,t.length-200));
if(/战斗|攻击|追|逃|爆炸|冲突|打|杀|刺|射/i.test(s))return'action';
if(/对话|谈|说|问|答|商议|争论|告白|质问/i.test(s))return'dialogue';
if(/感受|回忆|思考|悲|泪|心|痛|爱|恨|孤独/i.test(s))return'emotion';
return'explore'},

// ★ Few-Shot范本（第二人称+冷调）
_getWritingSample(){
const c2=AgentSystem.getAllAgents().find(a=>a.id!==this._playerCharacterId)?.name||'那个人';
return`意识回来时，首先是疼痛。

后脑勺像被钝器敲过。睁眼——陌生天花板，裂缝如干涸河床。空气里有铁锈味。或者是血。

你试着动手指。能动。算好消息。

脚步声由远及近。门被推开，光线涌入。

「醒了？」${c2}的声音从逆光中传来，听不出情绪，「比预想的快。」

（这里是哪？）问题像碎玻璃扎成一团。但直觉说——现在不是问的时候。

你撑墙站起。膝盖在抖，但你没让它表现在脸上。

[META]
PSYCHE:${c2}:审视|试探信任度|Ni判定通过——直觉感知到你的危险性
LOCATION:废弃建筑
[/META]`},

// Author's Note（注入上下文深度3-4）
_getAuthorsNote(){
const style=this.STYLES[this._writingStyle]||this.STYLES.literary;
const pc=AgentSystem.getAgent(this._playerCharacterId);
return`[提醒] 用"你"称呼${pc?.name||'主角'}。${style.anchor.substring(0,30)}。冷调叙事，不代替抒情。纯叙事在前，[META]在最后。`},
// ===== 世界创建 =====
_worldSchema:`必须生成恰好3个角色和3个地点。返回JSON：{"world":{"name":"名","type":"类型","description":"100字","rules":"规则","tone":"基调","locations":[{"name":"地点","desc":"短描述","type":"city"}]},"characters":[{"name":"名","avatar":"emoji","gender":"性别","age":25,"role":"职业","personality":"性格","background":"50字","abilities":"能力","mbti":"XXXX","values":["值"],"goals":["目标"],"secrets":["秘密"],"plotRelevance":"protagonist/deuteragonist/supporting","speechPattern":"语气"}]}
characters数组必须恰好3个元素，plotRelevance分别为protagonist、deuteragonist、supporting各一个。`,

async createWorld(){const name=$('#worldName').value.trim(),type=$q('#worldTypeChips .chip.active')?.dataset?.val||'奇幻',desc=$('#worldDesc').value.trim(),conflict=$('#worldConflict').value.trim();
if(!name||!desc){UI.toast('请填写名称和描述');return}UI.showLoading('构建世界...');
try{const res=await this.callAI([{role:'system',content:'只返回JSON'},{role:'user',content:`构建世界观+3角色+3地点。名称:${name} 类型:${type} 描述:${desc} ${conflict?'冲突:'+conflict:''}\n${this._worldSchema}`}],{maxTokens:2000});
const d=this._safeJSON(res);if(!d?.world?.characters&&!d?.characters)throw new Error('重试');
this._world=d.world;this._generatedChars=d.characters;
WorldMap.init();(d.world.locations||[]).forEach(l=>WorldMap.addLocation(l));WeatherSystem.init(d.world.type||type);
UI.hideLoading();UI.goTo('screen-character');UI.renderCharacterCards(d.characters)}catch(e){UI.hideLoading();UI.toast('生成失败:'+e.message)}},

async quickCreateWorld(sel){UI.showLoading('⚡ 快速构建...');
try{const res=await this.callAI([{role:'system',content:'只返回JSON'},{role:'user',content:`${sel.era}的${sel.genre}世界，${sel.tone}基调，${sel.scale}规模，冲突:${sel.conflict}。\n${this._worldSchema}`}],{maxTokens:2000});
const d=this._safeJSON(res);if(!d?.world)throw new Error('重试');
this._world=d.world;this._generatedChars=d.characters;
WorldMap.init();(d.world.locations||[]).forEach(l=>WorldMap.addLocation(l));WeatherSystem.init(d.world.type||sel.genre);
UI.hideLoading();UI.goTo('screen-character');UI.renderCharacterCards(d.characters)}catch(e){UI.hideLoading();UI.toast('生成失败:'+e.message)}},

async usePopularWorld(id){const w=Config.popularWorlds.find(x=>x.id===id);if(!w)return;UI.showLoading(`加载「${w.name}」...`);
try{const res=await this.callAI([{role:'system',content:'只返回JSON'},{role:'user',content:`基于「${w.name}」参考原著，构建世界观+3原创角色+3地点。\n参考:${w.worldDesc}\n冲突:${w.conflict}\n${this._worldSchema}`}],{maxTokens:2000});
const d=this._safeJSON(res);if(!d?.world)throw new Error('重试');
this._world=d.world;this._generatedChars=d.characters;
WorldMap.init();(d.world.locations||[]).forEach(l=>WorldMap.addLocation(l));WeatherSystem.init(d.world.type||w.worldType);
UI.hideLoading();UI.goTo('screen-character');UI.renderCharacterCards(d.characters)}catch(e){UI.hideLoading();UI.toast('生成失败:'+e.message)}},

selectCharacter(i){this._selectedCharIndex=i;document.querySelectorAll('.char-card').forEach((c,j)=>c.classList.toggle('selected',j===i))},

createCustomCharacter(){const name=$('#charName').value.trim();if(!name){UI.toast('请输入角色名');return}
const g=$q('#charGenderChips .chip.active')?.dataset?.val||'未知';
const cc={name,gender:g,age:parseInt($('#charAge').value)||25,role:$('#charRole').value.trim()||'冒险者',background:$('#charBg').value.trim(),abilities:$('#charAbility').value.trim(),personality:$('#charBg').value.trim(),avatar:g==='女'?'👩':g==='男'?'👨':'🧑',plotRelevance:'protagonist',goals:[],secrets:[],values:[],mbti:'',speechPattern:''};
if(this._generatedChars)this._generatedChars[0]=cc;else this._generatedChars=[cc];this._selectedCharIndex=0;
UI.goTo('screen-character');UI.renderCharacterCards(this._generatedChars);$q('.char-card')?.classList.add('selected')},

// ===== 开始游戏（★ 懒激活：只有主角focused，其他dormant） =====
async confirmCharacterAndStart(){if(this._selectedCharIndex===undefined){UI.toast('请选择角色');return}
UI.showLoading('生成剧情...');
try{AgentSystem.init();MemorySystem.init();ButterflySystem.init();ResourceSystem.init(10);
// 创建角色，全部dormant
this._generatedChars.forEach((c,i)=>{const a=AgentSystem.createAgent(c);
TraitSystem.autoAssign(a); // ★ 自动分配特质
if(i===this._selectedCharIndex){a.plotRole='protagonist';this._playerCharacterId=a.id;AgentSystem.activate(a.id,'focused')}});
// 初始化好感度
const all=AgentSystem.getAllAgents();
for(let i=0;i<all.length;i++){for(let j=i+1;j<all.length;j++){
const{fwd,rev}=BondSystem.initAffinityPair(all[i],all[j]);all[i].relationships[all[j].id]=fwd;all[j].relationships[all[i].id]=rev}}
if(WorldMap.getAllLocations().length)WorldMap.setCurrentLocation(WorldMap.getAllLocations()[0].id);
// ★ 大纲生成（带完整容错）
await this._genPlotOutline();
UI.hideLoading();this._state='running';UI.goTo('screen-game');UI.initGameScreen();
await this._startStory()
}catch(e){UI.hideLoading();console.error('启动失败:',e);UI.toast('启动失败:'+e.message)}},

// ===== 大纲生成（★ 跑团式详细故事线，像DM写模组一样） =====
async _genPlotOutline(){
const pc=AgentSystem.getAgent(this._playerCharacterId);const pcName=pc?.name||'主角';
const allChars=AgentSystem.getAllAgents();const names=allChars.map(a=>a.name+'('+a.role+')').join('、');
try{
const res=await this.callAI([{role:'system',content:'你是资深TRPG模组设计师。只返回JSON。'},
{role:'user',content:`为世界「${this._world.name}」设计一个完整的跑团模组。
主角:${pcName}。角色:${names}。世界:${this._world.description?.substring(0,100)||''}

要求：
1. 设计5幕剧情，像TRPG模组一样有明确的场景、事件、NPC和分支可能
2. 第一幕必须是危机导入——可以是战斗、辩论、审判、追逐、谈判或博弈（不一定是战斗）
3. 每幕有2-3个关键场景，每个场景有明确的挑战或抉择
4. 每幕有回合限制（3-6回合），避免拖沓
5. 设计5-8个会在剧情中登场的NPC
6. 每幕必须引入至少1个新元素（新角色/新线索/新势力/新地点）
7. 设计一条主线和2条暗线

返回JSON：
{"premise":"一句话核心悬念","mainPlot":"主线概要50字","subPlots":["暗线1","暗线2"],
"npcs":[{"name":"名","role":"身份","motivation":"动机","relation":"与主角关系","firstAppear":1}],
"chapters":[
{"title":"幕名","summary":"50字概要","turnLimit":5,"newElements":["新角色/线索/地点"],"scenes":[{"desc":"场景描述","challenge":"挑战","type":"combat/debate/gambit/explore","possibleOutcomes":["结果1","结果2"]}],"keyEvents":["事件"],"focusCharacters":["角色名"],"location":"地点","choicePoint":true}
]}`}],
{maxTokens:2000,temperature:.85,timeout:25000});
const p=this._safeJSON(res);
if(p?.chapters?.length){
  this._plotOutline=p;
  // ★ 预创建模组中的NPC（全部dormant，等剧情激活）
  if(p.npcs){p.npcs.forEach(npc=>{
    if(!allChars.find(a=>a.name===npc.name)){
      AgentSystem.createAgent({name:npc.name,role:npc.role||'未知',avatar:'👤',
        background:npc.motivation||'',personality:npc.motivation||'',
        plotRelevance:'minor',speechPattern:''});
    }
  })}
  return;
}
}catch(e){console.warn('大纲API失败:',e.message)}
// 容错默认大纲
const pcN=pc?.name||'主角';
this._plotOutline={premise:`${pcN}在${this._world.name}中的冒险`,mainPlot:'未知的危机正在逼近',subPlots:['隐藏的真相','意想不到的盟友'],
npcs:[],chapters:[
{title:'危机降临',summary:'陷入未知危机',scenes:[{desc:'危险的开场',challenge:'生存',possibleOutcomes:['逃脱','被抓']}],keyEvents:['突发危机','遭遇威胁'],focusCharacters:[pcN],location:'未知',choicePoint:true},
{title:'迷雾初现',summary:'线索浮现',scenes:[{desc:'发现线索',challenge:'调查',possibleOutcomes:['找到真相','误入歧途']}],keyEvents:['关键线索','重要人物'],focusCharacters:[pcN],location:'未知',choicePoint:true},
{title:'暗流涌动',summary:'局势复杂',scenes:[{desc:'势力交锋',challenge:'选择立场',possibleOutcomes:['结盟','树敌']}],keyEvents:['势力介入','信任考验'],focusCharacters:[pcN],location:'未知',choicePoint:true},
{title:'风暴之眼',summary:'矛盾爆发',scenes:[{desc:'正面冲突',challenge:'战斗或谈判',possibleOutcomes:['胜利','惨胜','失败']}],keyEvents:['正面冲突','艰难抉择'],focusCharacters:[pcN],location:'未知',choicePoint:true},
{title:'终局之路',summary:'走向结局',scenes:[{desc:'最终对决',challenge:'命运抉择',possibleOutcomes:['好结局','坏结局','开放结局']}],keyEvents:['最终对决','命运揭晓'],focusCharacters:[pcN],location:'未知',choicePoint:true}]}
},
// ===== 开始故事（★ 显示章节卡片） =====
async _startStory(){const ch=this._plotOutline.chapters[0];this._currentChapter=ch.title;this._chapterIndex=0;
$('#gameChapter').textContent=ch.title;$('#gameWorldName').textContent=this._world.name;
// ★ 显示章节卡片
this._showChapterCard(ch,0);
if(ch.location){WorldMap.discoverLocation(ch.location);const loc=WorldMap.getAllLocations().find(l=>l.name===ch.location);if(loc)WorldMap.setCurrentLocation(loc.id)}
WeatherSystem.evolve();await WeatherSystem.playSceneTransition(ch.location||'???');
MemorySystem.addToHistory('system',this._buildDirectorPrompt());
MemorySystem.addToHistory('assistant',this._getWritingSample());
const pc=AgentSystem.getAgent(this._playerCharacterId);
await this._narrateChapter(ch,`写300-500字开场。"你"(${pc?.name})被卷入一场危机——可以是战斗、辩论、审判、追逐、谈判或博弈中的任何一种。用感官细节。不要解释世界观。事件:${ch.keyEvents.join('、')}`)},

// ===== 预掷骰（★ 降低频率：只在有明确检定事件时掷，不默认掷luck） =====
async _preRollDice(ch){DiceSystem.clearPending();const on=AgentSystem.getActiveAgents();
const events=ch?.keyEvents||[];const types=[];
events.forEach(e=>{if(/战斗|攻击|打|搏斗/i.test(e))types.push('combat');if(/潜行|偷|暗中/i.test(e))types.push('stealth');
if(/说服|谈判|交涉/i.test(e))types.push('persuade');if(/调查|搜索|寻找/i.test(e))types.push('investigate');
if(/躲避|闪避/i.test(e))types.push('dodge');if(/忍耐|承受/i.test(e))types.push('endure')});
// ★ 没有明确检定事件时不掷骰（去掉默认luck）
if(!types.length)return;
on.forEach(a=>{const ct=types[Math.floor(Math.random()*types.length)];
const traitMod=typeof TraitSystem!=='undefined'?TraitSystem.getDiceMod(a,ct):0;
DiceSystem.preRoll(a.name,ct,a,WeatherSystem.getDiceMod(ct)+traitMod,0)});
// ★ 只对主角显示骰子动画
const pcName=AgentSystem.getAgent(this._playerCharacterId)?.name||'';
const pcRoll=DiceSystem.getPendingRoll(pcName,types[0]);
if(pcRoll)await DiceSystem.showDiceAnimation(pcRoll)},

// ===== 叙事 =====
async _narrateChapter(ch,customMsg){
if(ch.focusCharacters)ch.focusCharacters.forEach(name=>{const a=AgentSystem.getAllAgents().find(x=>x.name===name);if(a)AgentSystem.activate(a.id,'active')});
WeatherSystem.evolve();UI.updateCharacterStatus();
await this._preRollDice(ch);
const w=WeatherSystem.getCurrent();
const msg=customMsg||`继续「${ch.title}」。${w.icon}${w.desc}。事件:${ch.keyEvents.join('、')}`;
MemorySystem.addToHistory('user',msg);UI.showTyping();
try{let full='';const div=document.createElement('div');div.className='story-block';this._lastStoryDiv=div;
$('#storyContent').appendChild(div);
// ★ 直接用非流式调用，确保能拿到内容
full=await this.callAI(MemorySystem.getContext(),{maxTokens:1800});
console.log('叙事返回:',full?.length,'字');
if(full&&full.trim().length>10){div.innerHTML=this._parseText(full);UI.scrollToBottom()}
else{div.innerHTML='<p style="color:var(--tx2)">AI正在思考中，请点击继续重试...</p>';UI.showContinueButton();UI.hideTyping();return}
UI.hideTyping();this._lastNarrativeText=full;await this._processMarkers(full);
// ★ 资源变化+随机事件+属性成长
this._postTurnEffects(full);
MemorySystem.addToHistory('assistant',full,{chapter:ch.title});
this._turnCount++;SaveSystem.save();
// ★ 每次叙事后必出4个选项
await this._presentChoices(ch);
}catch(e){UI.hideTyping();UI.toast('生成失败:'+e.message);UI.showContinueButton()}},

// ===== 解析STORY/META =====
_parseText(text){let story=text,meta='';
const mm=text.match(/\[META\]([\s\S]*?)(\[\/META\]|$)/);
if(mm){story=text.substring(0,text.indexOf('[META]')).trim();meta=mm[1]||''}
// 清理叙事中的残留标记
story=story.replace(/\[(PSYCHE|DICE|BOND|LOCATION|CHOICE|NEW_NPC|META|\/META)[^\]]*\]/g,'');
story=story.replace(/选项[A-Z][:：].*$/gm,'').replace(/^[A-C]\.\s.*$/gm,'');
let h=story;
h=h.replace(/「([^」]+)」/g,'<span class="dialogue-inline">「$1」</span>');
h=h.replace(/（([^）]+)）/g,'<span style="color:var(--tx2);font-style:italic">（$1）</span>');
h=h.split('\n').filter(p=>p.trim()).map(p=>`<p>${p.trim()}</p>`).join('');
if(meta)h+=this._renderMeta(meta,text);return h},

_renderMeta(meta,fullText){let html='';const sit=PsycheSystem.extractSituation(fullText);
meta.split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{
const pm=line.match(/^PSYCHE:([^:]+):(.+)$/);
if(pm){const a=AgentSystem.getAllAgents().find(x=>x.name.includes(pm[1].trim()));
if(a){const an=PsycheSystem.analyze(a.psyche,sit);PsycheSystem.updatePsyche(a.psyche,an);
const id='ps_'+Date.now()+'_'+Math.random().toString(36).substr(2,3);
html+=`<div style="margin:2px 0"><span class="story-psyche-toggle" onclick="document.getElementById('${id}').classList.toggle('show')">🧠${pm[1].trim()}</span><span style="font-size:8px;color:var(--tx2);margin-left:3px">${pm[2].trim()}</span><div id="${id}" class="story-psyche-detail">${PsycheSystem.formatPsycheProcess(an)}</div></div>`}return}
const dm=line.match(/^DICE:([^:]+):(.+)$/);
if(dm){const p=DiceSystem.getPendingRoll(dm[1],dm[2]);if(p)html+=`<div style="margin:2px 0">${DiceSystem.formatRollInline(p)}</div>`;return}
const bm=line.match(/^BOND:([^:]+):([^:]+):([^:]+):(.+)$/);
if(bm){const v=parseInt(bm[3]);html+=`<div class="story-bond-event ${v>0?'positive':'negative'}">${v>0?'💚':'💔'}${bm[1].trim()}与${bm[2].trim()}${v>0?'升温':'降温'}（${bm[4].trim()}）</div>`;return}
const lm=line.match(/^LOCATION:(.+)$/);if(lm){html+=`<div class="story-system">📍 ${lm[1].trim()}</div>`;return}
const nm=line.match(/^NEW_NPC:([^:]+):?(.*)$/);if(nm){html+=`<div class="story-system">⚡「${nm[1].trim()}」登场</div>`}
});return html},
// ===== 处理标记副作用 =====
async _processMarkers(text){const mm=text.match(/\[META\]([\s\S]*?)(\[\/META\]|$)/);const meta=mm?mm[1]:'';
const lines=meta.split('\n').map(l=>l.trim()).filter(Boolean);
// 好感度
lines.filter(l=>/^BOND:/.test(l)).forEach(line=>{const m=line.match(/^BOND:([^:]+):([^:]+):([^:]+):(.+)$/);if(!m)return;
const all=AgentSystem.getAllAgents();const a1=all.find(a=>a.name.includes(m[1].trim())),a2=all.find(a=>a.name.includes(m[2].trim()));const v=parseInt(m[3]);
if(a1&&a2){if(a1.relationships[a2.id])BondSystem.modifyAffinity(a1.relationships[a2.id],v,m[4].trim());
if(a2.relationships[a1.id])BondSystem.modifyAffinity(a2.relationships[a1.id],Math.round(v*0.7),m[4].trim())}});
// 地点
lines.filter(l=>/^LOCATION:/.test(l)).forEach(line=>{const m=line.match(/^LOCATION:(.+)$/);if(m){const id=WorldMap.discoverLocation(m[1].trim());WorldMap.setCurrentLocation(id)}});
// ★ 新NPC自动创建+懒激活
lines.filter(l=>/^NEW_NPC:/.test(l)).forEach(line=>{const m=line.match(/^NEW_NPC:([^:]+):?(.*)$/);if(!m)return;
const name=m[1].trim(),role=m[2]?.trim()||'未知';
if(!AgentSystem.getAllAgents().find(a=>a.name===name)){
const na=AgentSystem.createAgent({name,role,avatar:'👤',background:'新登场',personality:'待观察',plotRelevance:'minor',speechPattern:''});
AgentSystem.getAllAgents().forEach(oa=>{if(oa.id!==na.id){const{fwd,rev}=BondSystem.initAffinityPair(na,oa);na.relationships[oa.id]=fwd;oa.relationships[na.id]=rev}});
AgentSystem.activate(na.id,'active')}});
// ★ 核心：懒激活——根据文本自动升降级所有角色
AgentSystem.updateActivations(text,MemorySystem.getTurnCount());
// 危险氛围
const sit=PsycheSystem.extractSituation(text);this._updateDangerAtmosphere(sit.dangerLevel);
ButterflySystem.detectMajorEvents(text);
// 补充遗漏心理
const psycheNames=new Set(lines.filter(l=>/^PSYCHE:/.test(l)).map(l=>(l.match(/^PSYCHE:([^:]+)/)||[])[1]?.trim()).filter(Boolean));
const missing=AgentSystem.getActiveAgents().filter(a=>!psycheNames.has(a.name));
if(missing.length){const sd=document.createElement('div');sd.className='story-block';
sd.innerHTML=missing.map(a=>{const an=PsycheSystem.analyze(a.psyche,sit);PsycheSystem.updatePsyche(a.psyche,an);
const id='pss_'+Date.now()+'_'+Math.random().toString(36).substr(2,3);
return`<div style="margin:2px 0"><span class="story-psyche-toggle" onclick="document.getElementById('${id}').classList.toggle('show')">🧠${a.name}</span><div id="${id}" class="story-psyche-detail">${PsycheSystem.formatPsycheProcess(an)}</div></div>`}).join('');
$('#storyContent').appendChild(sd)}
UI.updateCharacterStatus();UI.renderRelationships();UI.showRegenerateButton()},

_updateDangerAtmosphere(level){const v=document.getElementById('dangerVignette');if(!v)return;
if(level==='critical'||level==='high')v.classList.add('active');else v.classList.remove('active')},

// ★ 回合结束后处理：资源变化、随机事件、属性成长
_postTurnEffects(text){
  const storyDiv=document.getElementById('storyContent');
  // 1. 从AI文本提取资源变化
  const aiDeltas=ResourceSystem.parseFromText(text);
  if(aiDeltas.length){const d=document.createElement('div');d.className='story-block';d.innerHTML=ResourceSystem.formatDeltas(aiDeltas);storyDiv.appendChild(d)}
  // 2. 自然消耗
  const decayDeltas=ResourceSystem.turnDecay();
  // 3. 随机事件（每回合15%概率）
  const evt=ResourceSystem.checkRandomEvent();
  if(evt){const ed=document.createElement('div');ed.className='story-block';
  ed.innerHTML=`<div class="random-event ${evt.type}"><span class="re-icon">${evt.type==='lucky'?'🍀':evt.type==='bad'?'⚡':'💬'}</span><span class="re-text">${evt.text}</span>${ResourceSystem.formatDeltas(evt.deltas)}</div>`;
  storyDiv.appendChild(ed)}
  // 4. 属性成长：根据行动类型微调主角stats
  const pc=AgentSystem.getAgent(this._playerCharacterId);
  if(pc){const sit=PsycheSystem.extractSituation(text);
  if(sit.threat>0.5&&Math.random()<0.3){pc.stats.WIL=Math.min(20,pc.stats.WIL+1);this._showStatGrowth('意志','WIL',pc.stats.WIL)}
  if(/说服|谈判|交涉|对话/i.test(text)&&Math.random()<0.2){pc.stats.CHA=Math.min(20,pc.stats.CHA+1);this._showStatGrowth('魅力','CHA',pc.stats.CHA)}
  if(/战斗|攻击|搏斗/i.test(text)&&Math.random()<0.2){pc.stats.STR=Math.min(20,pc.stats.STR+1);this._showStatGrowth('力量','STR',pc.stats.STR)}
  if(/调查|搜索|分析|思考/i.test(text)&&Math.random()<0.2){pc.stats.INT=Math.min(20,pc.stats.INT+1);this._showStatGrowth('智力','INT',pc.stats.INT)}}
  // 5. 更新顶栏
  UI.updateResourceBar();UI.scrollToBottom()
},

_showStatGrowth(name,key,newVal){
  const d=document.createElement('div');d.className='story-block';
  d.innerHTML=`<div class="stat-growth">📈 ${name}提升！（${key} → ${newVal}）</div>`;
  document.getElementById('storyContent').appendChild(d)
},

// ===== 玩家节奏控制 =====
async playerContinue(){UI.hideContinueButton();
// ★ 路由：人生模式
if(LifeMode.isActive()){await this._lifeNextTurn();return}
if(this._state!=='running'||this._paused)return;
const ch=this._plotOutline?.chapters?.[this._chapterIndex];if(!ch)return;
// 检查章节回合限制
const curCh=this._plotOutline?.chapters?.[this._chapterIndex];
const chTurnLimit=curCh?.turnLimit||5;
const chTurnsUsed=this._turnCount - (this._chapterStartTurn||0);
if(chTurnsUsed>=chTurnLimit)await this._advanceChapter();
await this._continueStory()},

// ===== 选项（★ 场景感知，不再固定ABCD模板） =====
async _presentChoices(ch){this._choicesPending=true;UI.hideContinueButton();
const pc=AgentSystem.getAgent(this._playerCharacterId);
const recent=(this._lastNarrativeText||'').replace(/\[.*?\]/g,'').substring(0,250);
const onNames=AgentSystem.getActiveAgents().filter(a=>a.id!==this._playerCharacterId).map(a=>a.name).join('、');
const loc=WorldMap.getCurrentLocation()?.name||'未知';
const currentScene=ch?.scenes?.[0];
const sceneHint=currentScene?`挑战:${currentScene.challenge}`:''
const sit=PsycheSystem.extractSituation(this._lastNarrativeText||'');
// ★ 根据场景类型切换选项风格
const isCombat=sit.dangerLevel==='critical'||sit.dangerLevel==='high'||/战斗|攻击|打|追|逃|刺|射/i.test(recent);
// ★ 检测是否有NPC在和"你"直接对话
const isDialogue=/「[^」]*」[^「]*$/.test(recent)||/对你说|问你|看着你|向你/i.test(recent);
// 提取最后说话的NPC名字
let lastSpeaker='';if(isDialogue){const onAgents=AgentSystem.getActiveAgents().filter(a=>a.id!==this._playerCharacterId);
for(const a of onAgents){const nameIdx=recent.lastIndexOf(a.name);if(nameIdx>recent.length-150){lastSpeaker=a.name;break}}}

const prompt=isCombat?
`[战斗回合] ${loc}。敌人/威胁:${onNames||'未知'}。
刚发生:${recent.substring(0,120)}
${pc?.name}的能力:力量${pc?.stats?.STR||10} 敏捷${pc?.stats?.DEX||10} 智力${pc?.stats?.INT||10}

生成4个战斗行动（DND风格）：
- 具体战术动作（攻击、防御、移动、使用环境）
- 符合当前战场环境
- 10-20字，动词开头
返回：{"choices":["","","",""],"urgent":${sit.dangerLevel==='critical'}}`

: isDialogue?
// ★ 对话模式：有NPC在和你说话时，选项以对话回应为主
`[对话场景] ${loc}。${lastSpeaker?lastSpeaker+'正在和你对话。':'有人在和你说话。'}
在场:${onNames||'无'}。
刚发生:${recent.substring(0,180)}

为"你"(${pc?.name})生成4个回应选项。要求：
- 至少2个是对话回应（用「」包裹你要说的话），语气各不相同：真诚/试探/强硬/回避/幽默/冷淡等
- 1个是动作回应（不说话，用行动回应，如沉默转身、点头、摇头、叹气等）
- 1个是转移话题或关注其他事物
- 对话内容要具体，不要泛泛的"询问情况"，要写出具体说什么
- 15-30字，符合${pc?.name}的性格
返回：{"choices":["","","",""],"urgent":false}`

:
// 探索/一般模式
`[场景] ${loc}。在场:${onNames||'无'}。${sceneHint}
刚发生:${recent.substring(0,150)}

为"你"(${pc?.name})生成4个行动。要求：
- 从刚发生的事自然延伸
- 不用固定模板
${onNames?'- 如果有NPC在场，至少1个涉及与NPC对话或互动（写出具体说什么或做什么）':''}
- 如果场景中提到物品/线索，至少1个涉及它
- 物理合理
- 15-25字，用"你"
返回：{"choices":["","","",""],"urgent":false}`;
try{const res=await this.callAI([{role:'system',content:'TRPG主持人。只返回JSON。'},{role:'user',content:prompt}],{maxTokens:300,temperature:.9});
const d=this._safeJSON(res);
const choices=d?.choices?.slice(0,4);
const isUrgent=d?.urgent===true&&sit.dangerLevel==='critical'&&this._turnCount%4===0;
if(choices?.length===4){UI.showChoices(choices,isUrgent?20:0)}
else{UI.showChoices(this._fallbackChoices(onNames,loc,isCombat),0)}
}catch(e){UI.showChoices(this._fallbackChoices(onNames,loc,false),0)}},

_fallbackChoices(npcs,loc,combat){
if(combat)return['向最近的敌人发起攻击','翻滚躲避，寻找掩体','利用周围环境制造障碍','后撤拉开距离'];
const npc=(npcs||'').split('、')[0];
if(npc)return[`对${npc}说「你到底想怎样？」`,`对${npc}说「我需要时间想想。」`,`沉默地看着${npc}，不作回应`,`转身观察周围环境`];
return[`在${loc||'这里'}四处搜索`,'安静等待，看会发生什么','沿着来路的反方向走','仔细检查身上的物品']},

onTimedChoiceExpired(){this.makeChoice('犹豫——错失了行动时机')},

async makeChoice(text){
// ★ 路由：人生模式走专用逻辑
if(LifeMode.isActive()){await this._lifeMakeChoice(text);return}
this._choicesPending=false;UI.hideChoices();UI.clearTimer();
const pc=AgentSystem.getAgent(this._playerCharacterId);
ButterflySystem.recordChoice(text,(this._lastNarrativeText||'').replace(/\[.*?\]/g,'').substring(0,60));
// 角色抗拒
if(pc){const r=PsycheSystem.calcResistance(pc,text);
if(r.level>20){const rd=document.createElement('div');rd.className='story-block';
const sev=r.level>75?'heavy':r.level>40?'medium':'light';
rd.innerHTML=`<div class="resistance-block ${sev}"><div class="resistance-text">${r.monologue}</div></div>`;
$('#storyContent').appendChild(rd);
pc.psyche.defenses.stress=Math.min(100,pc.psyche.defenses.stress+r.stressDelta);
if(r.refuses){text=`你内心抗拒，按「${r.conflictValue}」的信念行事`}
else if(r.resists){text+=`（内心抗拒，动作迟疑）`}
await new Promise(rv=>setTimeout(rv,500))}}
const ad=document.createElement('div');ad.className='story-block';
ad.innerHTML=`<div class="story-action">✦ ${text}</div>`;$('#storyContent').appendChild(ad);UI.scrollToBottom();
const ch=this._plotOutline?.chapters?.[this._chapterIndex];if(ch)await this._preRollDice(ch);
MemorySystem.addToHistory('user',`写300-500字描述结果。你的行动：${text}`);UI.showTyping();
try{let full='';const div=document.createElement('div');div.className='story-block';this._lastStoryDiv=div;$('#storyContent').appendChild(div);
full=await this.callAI(MemorySystem.getContext(),{maxTokens:1800});
if(full&&full.trim().length>10){div.innerHTML=this._parseText(full);UI.scrollToBottom()}
else{div.innerHTML='<p style="color:var(--tx2)">请点击继续重试</p>';UI.showContinueButton();UI.hideTyping();return}
UI.hideTyping();this._lastNarrativeText=full;await this._processMarkers(full);
this._postTurnEffects(full);
MemorySystem.addToHistory('assistant',full,{chapter:this._currentChapter});this._turnCount++;SaveSystem.save();
const ch2=this._plotOutline?.chapters?.[this._chapterIndex];
await this._presentChoices(ch2||{})}catch(e){UI.hideTyping();UI.toast('失败:'+e.message);UI.showContinueButton()}},

// ===== 章节推进 =====
async _advanceChapter(){if(!this._plotOutline?.chapters)return;
if(EncounterSystem.isActive())EncounterSystem.end('chapter_end');
if(this._commentaryEnabled)await this._genCommentary();
this._chapterIndex++;if(this._chapterIndex<this._plotOutline.chapters.length){
const ch=this._plotOutline.chapters[this._chapterIndex];this._currentChapter=ch.title;$('#gameChapter').textContent=ch.title;
this._chapterStartTurn=this._turnCount; // ★ 记录章节起始回合
WeatherSystem.evolve();if(ch.location)await WeatherSystem.playSceneTransition(ch.location);
// ★ 显示章节卡片
this._showChapterCard(ch,this._chapterIndex);
SaveSystem.save()}},

// ★ 章节卡片：让玩家清楚知道每个单元的主题
_showChapterCard(ch,index){
const scenes=(ch.scenes||[]).map(s=>s.desc||s.challenge||'').filter(Boolean);
const chars=(ch.focusCharacters||[]).join('、');
const storyContent=$('#storyContent');
const card=document.createElement('div');card.className='story-block';
card.innerHTML=`<div class="chapter-card">
<div class="ch-header"><span class="ch-number">${index===0?'序幕':'第'+(index)+'章'}</span><span class="ch-title">${ch.title}</span></div>
<div class="ch-summary">${ch.summary||''}</div>
<div class="ch-details">
${ch.location?'<span class="ch-tag">📍'+ch.location+'</span>':''}
${chars?'<span class="ch-tag">👥'+chars+'</span>':''}
${scenes.length?'<span class="ch-tag">⚔️'+scenes[0]+'</span>':''}
</div>
</div>`;
storyContent.appendChild(card);UI.scrollToBottom()},

async _genCommentary(){const on=AgentSystem.getActiveAgents();const rm=MemorySystem.getMemories().slice(-3).map(m=>m.summary).join(' ');
try{const res=await this.callAI([{role:'system',content:'犀利剧评人'},{role:'user',
content:`对「${this._currentChapter}」写锐评120字。角色:${on.map(a=>a.name).join('、')}。概要:${rm}。风格随机。直接输出。`}],{maxTokens:300,temperature:1});
const cd=document.createElement('div');cd.className='story-block';
cd.innerHTML=`<div class="commentary-block"><div class="commentary-header">🎙️ 锐评·${this._currentChapter}</div><div class="commentary-body">${res.trim().split('\n').filter(p=>p.trim()).map(p=>'<p>'+p+'</p>').join('')}</div></div>`;
$('#storyContent').appendChild(cd)}catch(e){}},

// ===== 继续故事 =====
async _continueStory(){if(this._state!=='running'||this._choicesPending||this._paused)return;
const ch=this._plotOutline?.chapters?.[this._chapterIndex];if(!ch)return;
if(ch.choicePoint&&this._turnCount%2===0){await this._presentChoices(ch);return}
await this._preRollDice(ch);for(const[k,r]of Object.entries(DiceSystem._pendingRolls)){await DiceSystem.showDiceAnimation(r)}
const on=AgentSystem.getActiveAgents();const w=WeatherSystem.getCurrent();
MemorySystem.addToHistory('user',`写300-500字继续故事。${w.icon}${w.desc}。在场:${on.map(a=>a.name).join('、')}。用"你"视角。`);
UI.showTyping();
try{let full='';const div=document.createElement('div');div.className='story-block';this._lastStoryDiv=div;$('#storyContent').appendChild(div);
full=await this.callAI(MemorySystem.getContext(),{maxTokens:1500});
if(full&&full.trim().length>10){div.innerHTML=this._parseText(full);UI.scrollToBottom()}
else{div.innerHTML='<p style="color:var(--tx2)">请点击继续重试</p>';UI.showContinueButton();UI.hideTyping();return}
UI.hideTyping();this._lastNarrativeText=full;await this._processMarkers(full);
this._postTurnEffects(full);
MemorySystem.addToHistory('assistant',full,{chapter:this._currentChapter});this._turnCount++;SaveSystem.save();
if(full.includes('CHOICE'))await this._presentChoices(ch);else UI.showContinueButton()
}catch(e){UI.hideTyping();UI.toast('失败:'+e.message);UI.showContinueButton()}},

togglePause(){this._paused=!this._paused;$('#btnPause').textContent=this._paused?'▶':'⏸';
if(this._paused)UI.toast('已暂停');else{UI.toast('继续');if(!this._choicesPending)UI.showContinueButton()}},

async sendPlayerAction(){const inp=$('#playerInput');const text=inp.value.trim();if(!text)return;inp.value='';
ButterflySystem.recordChoice(text,'');
const ad=document.createElement('div');ad.className='story-block';ad.innerHTML=`<div class="story-action">✦ ${text}</div>`;
$('#storyContent').appendChild(ad);UI.scrollToBottom();
MemorySystem.addToHistory('user',`写300-500字描述结果。你的行动：${text}`);UI.showTyping();
try{let full='';const div=document.createElement('div');div.className='story-block';this._lastStoryDiv=div;$('#storyContent').appendChild(div);
await this.callAIStream(MemorySystem.getContext(),(c,f)=>{full=f;div.innerHTML=this._parseText(f);UI.scrollToBottom()});
UI.hideTyping();this._lastNarrativeText=full;await this._processMarkers(full);
MemorySystem.addToHistory('assistant',full,{chapter:this._currentChapter});this._turnCount++;SaveSystem.save();
const ch3=this._plotOutline?.chapters?.[this._chapterIndex];await this._presentChoices(ch3||{})}
catch(e){UI.hideTyping();UI.toast('失败:'+e.message);UI.showContinueButton()}},

async regenerateLast(){if(!this._lastStoryDiv)return;this._lastStoryDiv.remove();
const ctx=MemorySystem._context;if(ctx.length&&ctx[ctx.length-1].role==='assistant')ctx.pop();
MemorySystem._turnCounter=Math.max(0,MemorySystem._turnCounter-1);this._turnCount=Math.max(0,this._turnCount-1);
UI.hideRegenerateButton();UI.showTyping();
try{let full='';const div=document.createElement('div');div.className='story-block';this._lastStoryDiv=div;$('#storyContent').appendChild(div);
await this.callAIStream(MemorySystem.getContext(),(c,f)=>{full=f;div.innerHTML=this._parseText(f);UI.scrollToBottom()},{maxTokens:1800});
UI.hideTyping();this._lastNarrativeText=full;await this._processMarkers(full);
MemorySystem.addToHistory('assistant',full,{chapter:this._currentChapter});this._turnCount++;SaveSystem.save();
UI.showContinueButton()}catch(e){UI.hideTyping();UI.toast('重新生成失败');UI.showContinueButton()}},

// ===== JSON解析（5层容错） =====
// ===== 人生模式 =====
_lifeAfterWorld:false, // 自定义世界后跳回人生模式

LIFE_WORLDS:{
medieval:{name:'铁与火之国',type:'奇幻',description:'中世纪封建王国，骑士与领主统治大地。魔法稀少但被敬畏。平民挣扎求存，贵族争权夺利。',rules:'封建等级制度',tone:'厚重'},
modern:{name:'霓虹都市',type:'现实',description:'21世纪现代都市，机会与压力并存。科技改变生活，人际关系复杂。金钱是最大的力量。',rules:'法治社会',tone:'写实'},
scifi:{name:'星联纪元',type:'科幻',description:'人类殖民银河系的时代，星际旅行是日常。AI与人类共存，基因改造普及。',rules:'联邦法律',tone:'宏大'},
xianxia:{name:'九天大陆',type:'奇幻',description:'修仙者追求长生的世界。灵气遍布天地，宗门林立，强者为尊。凡人如蝼蚁。',rules:'修炼境界决定地位',tone:'飘逸'},
postapoc:{name:'灰烬纪',type:'末日',description:'大灾变后的荒芜世界。资源稀缺，幸存者结成聚落。旧世界的遗迹中藏着危险和希望。',rules:'丛林法则',tone:'苍凉'}
},

async startLifeMode(){
const get=id=>{const el=document.querySelector('#'+id+' .chip.active');return el?el.dataset.val:null};
const worldKey=get('lifeWorld');const birth=get('lifeBirth');const family=get('lifeFamily');const talent=get('lifeTalent');
const name=document.getElementById('lifeName')?.value?.trim();
if(!worldKey){UI.toast('请选择世界');return}
if(!birth){UI.toast('请选择出生地');return}
if(!family){UI.toast('请选择家境');return}
if(!talent){UI.toast('请选择天赋');return}
if(!name){UI.toast('请输入角色名');return}

UI.showLoading('构建你的人生...');
try{
// 设置世界（预设或自定义）
if(worldKey==='custom'&&this._world){/* 使用已创建的自定义世界 */}
else if(this.LIFE_WORLDS[worldKey]){this._world=this.LIFE_WORLDS[worldKey]}
else{UI.hideLoading();UI.toast('请先选择世界');return}

// 创建主角
AgentSystem.init();MemorySystem.init();
const pc=AgentSystem.createAgent({name,gender:'未知',age:0,role:'新生儿',personality:'',background:`出生于${birth}的${family}家庭，天赋：${talent}`,abilities:talent,plotRelevance:'protagonist',speechPattern:''});
this._playerCharacterId=pc.id;AgentSystem.activate(pc.id,'focused');
TraitSystem.autoAssign(pc);

// 初始化人生模式
LifeMode.start(birth,family,talent);
ResourceSystem.init(family==='富裕'?50:family==='权贵'?80:family==='贫困'?0:10);
WeatherSystem.init(this._world.type||'现实');WorldMap.init();

// 直接开始，不需要大纲
this._plotOutline={premise:`${name}在${this._world.name}中的一生`,chapters:[]};
this._state='running';
UI.hideLoading();UI.goTo('screen-game');
document.getElementById('gameWorldName').textContent=this._world.name;
document.getElementById('gameChapter').textContent='⏳ 童年';
UI.initGameScreen();

// 开始第一回合
await this._lifeNextTurn()
}catch(e){UI.hideLoading();console.error(e);UI.toast('启动失败:'+e.message)}},

async _lifeNextTurn(){
if(!LifeMode.isActive())return;
const phaseResult=LifeMode.advanceTurn();
const phase=LifeMode.getPhase();
const event=LifeMode.getRandomEvent();

// 更新UI
document.getElementById('gameChapter').textContent=`${phase.icon} ${phase.label} · ${LifeMode._age}岁`;
const resBar=document.getElementById('resBar');
if(resBar)resBar.innerHTML=LifeMode.renderStatusBar();

// 检查死亡
if(phaseResult==='death'){await this._lifeEnding();return}

// 生成叙事
const prompt=LifeMode.buildPrompt()+`\n\n[本回合] ${LifeMode._age}岁。发生了：${event}\n请围绕这个事件写80-150字。`;
MemorySystem.addToHistory('system',prompt);
MemorySystem.addToHistory('user',`${LifeMode._age}岁。${event}`);

UI.showTyping();
try{
const full=await this.callAI(MemorySystem.getContext(),{maxTokens:800});
const div=document.createElement('div');div.className='story-block';
// 阶段标记
div.innerHTML=`<div class="life-turn-header" style="color:${phase.color}">${phase.icon} ${LifeMode._age}岁 · ${phase.label}</div>`+this._parseText(full);
document.getElementById('storyContent').appendChild(div);
UI.hideTyping();UI.scrollToBottom();

// 解析META
const mm=full.match(/\[META\]([\s\S]*?)(\[\/META\]|$)/);
if(mm){const lines=mm[1].split('\n').map(l=>l.trim()).filter(Boolean);LifeMode.parseMeta(lines)}

MemorySystem.addToHistory('assistant',full);
// 更新状态栏
if(resBar)resBar.innerHTML=LifeMode.renderStatusBar();

// 生成选择
await this._lifeChoices(event)
}catch(e){UI.hideTyping();UI.toast('生成失败:'+e.message);UI.showContinueButton()}},

async _lifeChoices(event){
this._choicesPending=true;
try{
const res=await this.callAI([{role:'system',content:'只返回JSON'},{role:'user',content:LifeMode.buildChoicePrompt(event)}],{maxTokens:200,temperature:.9});
const d=this._safeJSON(res);
if(d?.choices?.length>=3){UI.showChoices(d.choices.slice(0,3),0)}
else{UI.showChoices(['顺其自然，接受命运','努力改变现状','走一条完全不同的路'],0)}
}catch(e){UI.showChoices(['顺其自然','努力改变','另辟蹊径'],0)}},

async _lifeMakeChoice(text){
this._choicesPending=false;UI.hideChoices();
LifeMode.addMilestone(text);
MemorySystem.addToHistory('user',`你选择了：${text}`);

UI.showTyping();
try{
const full=await this.callAI(MemorySystem.getContext(),{maxTokens:600});
const div=document.createElement('div');div.className='story-block';
div.innerHTML=this._parseText(full);
document.getElementById('storyContent').appendChild(div);
UI.hideTyping();UI.scrollToBottom();

const mm=full.match(/\[META\]([\s\S]*?)(\[\/META\]|$)/);
if(mm){const lines=mm[1].split('\n').map(l=>l.trim()).filter(Boolean);LifeMode.parseMeta(lines)}
MemorySystem.addToHistory('assistant',full);

// 更新状态
const resBar=document.getElementById('resBar');
if(resBar)resBar.innerHTML=LifeMode.renderStatusBar();

// 继续下一回合
UI.showContinueButton()
}catch(e){UI.hideTyping();UI.toast('失败');UI.showContinueButton()}},

async _lifeEnding(){
UI.showTyping();
try{
const full=await this.callAI([{role:'system',content:'温暖克制的叙事者'},{role:'user',content:LifeMode.buildEpiloguePrompt()}],{maxTokens:1000});
const div=document.createElement('div');div.className='story-block';
div.innerHTML=`<div class="life-ending"><div class="le-header">🕯️ 终章</div><div class="le-body">${full.split('\n').filter(p=>p.trim()).map(p=>'<p>'+p.trim()+'</p>').join('')}</div><div class="le-timeline-title">📜 人生轨迹</div>${LifeMode.renderTimeline()}</div>`;
document.getElementById('storyContent').appendChild(div);
UI.hideTyping();UI.scrollToBottom();
this._state='ended';LifeMode._active=false;
}catch(e){UI.hideTyping();UI.toast('结局生成失败')}},

_safeJSON(raw){if(!raw)return null;
try{return JSON.parse(raw)}catch(e){}
try{return JSON.parse(raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim())}catch(e){}
try{const m=raw.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0])}catch(e){}
try{const s=raw.indexOf('{'),e=raw.lastIndexOf('}');if(s!==-1&&e>s)return JSON.parse(raw.substring(s,e+1))}catch(e){}
console.error('JSON解析失败:',raw.substring(0,150));return null}
};
function $(s){return document.getElementById(s.replace('#',''))}
function $q(s){return document.querySelector(s)}