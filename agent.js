// ===== agent.js v5 - 懒激活Agent =====
// dormant(0)→aware(5)→active(15)→focused(30)
const AgentSystem={
_agents:{},_activeAgents:[],_scenePresent:new Set(),
ACTIVATION:{dormant:{w:0,label:'休眠',think:false},aware:{w:5,label:'感知',think:false},active:{w:15,label:'活跃',think:true},focused:{w:30,label:'聚焦',think:true}},

init(){this._agents={};this._activeAgents=[];this._scenePresent=new Set()},

createAgent(cd){const id=cd.id||'a_'+Date.now()+'_'+Math.random().toString(36).substr(2,4);
this._agents[id]={id,name:cd.name,role:cd.role||'未知',avatar:cd.avatar||'👤',
background:cd.background||'',personality:cd.personality||'',gender:cd.gender||'未知',age:cd.age||'未知',abilities:cd.abilities||'',
stats:DiceSystem.parseOrGenerate(cd),psyche:PsycheSystem.createPsyche(cd),
activation:'dormant',weight:0,mentionCount:0,lastMentionTurn:0,consecutiveMentions:0,
status:{hp:100,mood:'正常',location:'未知',activity:'待命',conditions:[],alive:true},
relationships:{},playerControlled:false,plotRole:cd.plotRelevance||'supporting',introduced:false,
actionHistory:[],goals:cd.goals||[],secrets:cd.secrets||[],speechPattern:cd.speechPattern||''};
return this._agents[id]},

// ★ 核心：根据叙事文本自动升降级
updateActivations(text,turn){
const all=Object.values(this._agents).filter(a=>a.status.alive);
const mentioned=new Set();
all.forEach(a=>{if(text.includes(a.name)){mentioned.add(a.name);a.mentionCount++;
a.consecutiveMentions=(a.lastMentionTurn===turn-1)?a.consecutiveMentions+1:1;a.lastMentionTurn=turn}
else{if(a.lastMentionTurn<turn-1)a.consecutiveMentions=0}});
all.forEach(a=>{if(a.playerControlled){this._setLvl(a,'focused');return}
const m=mentioned.has(a.name);const gap=turn-a.lastMentionTurn;
if(m){if(a.activation==='dormant'||a.activation==='aware')this._setLvl(a,'active');
if(a.consecutiveMentions>=3&&a.activation==='active')this._setLvl(a,'focused')}
else{if(gap>=4&&a.activation==='focused')this._setLvl(a,'active');
if(gap>=6&&a.activation==='active')this._setLvl(a,'aware');
if(gap>=10&&a.activation==='aware')this._setLvl(a,'dormant')}});
this._rebuild()},

_setLvl(a,lvl){a.activation=lvl;a.weight=this.ACTIVATION[lvl].w;
if(lvl==='active'||lvl==='focused'){this._scenePresent.add(a.id);a.introduced=true}
if(lvl==='dormant')this._scenePresent.delete(a.id)},

_rebuild(){const t=Object.values(this._agents).filter(a=>a.status.alive&&this.ACTIVATION[a.activation]?.think).sort((a,b)=>b.weight-a.weight);
this._activeAgents=t.map(a=>a.id);
const total=t.reduce((s,a)=>s+a.weight,0);
if(total>0)t.forEach(a=>{a.weight=Math.max(1,Math.round((a.weight/total)*100))})},

activate(id,lvl='active'){const a=this._agents[id];if(a){this._setLvl(a,lvl);this._rebuild()}},
bringOnline(id){this.activate(id,'active')},
bringOffline(id){const a=this._agents[id];if(a)this._setLvl(a,'dormant');this._rebuild()},
updateScenePresence(){},
detectPresent(text){return Object.values(this._agents).filter(a=>a.status.alive&&text.includes(a.name)).map(a=>a.name)},

getAgent(id){return this._agents[id]},
getAllAgents(){return Object.values(this._agents)},
getActiveAgents(){return this._activeAgents.map(id=>this._agents[id]).filter(Boolean)},
getAwareAgents(){return Object.values(this._agents).filter(a=>a.status.alive&&a.activation!=='dormant')},
getDormantAgents(){return Object.values(this._agents).filter(a=>a.status.alive&&a.activation==='dormant')},

adjustPlotRole(id,r){const a=this._agents[id];if(a)a.plotRole=r},
updateStatus(id,u){const a=this._agents[id];if(!a)return;Object.assign(a.status,u);if(a.status.hp<=0){a.status.alive=false;this._setLvl(a,'dormant');this._rebuild()}},
recordAction(id,act){const a=this._agents[id];if(!a)return;a.actionHistory.push({action:act,timestamp:Date.now()});if(a.actionHistory.length>20)a.actionHistory=a.actionHistory.slice(-20)},
setRelationship(id1,id2,rel){const a1=this._agents[id1],a2=this._agents[id2];if(a1)a1.relationships[id2]=rel;if(a2)a2.relationships[id1]={...rel}},
togglePlayerControl(id){const a=this._agents[id];if(!a)return false;Object.values(this._agents).forEach(x=>{x.playerControlled=false});a.playerControlled=true;this._setLvl(a,'focused');this._rebuild();return true},
getPlayerAgent(){return Object.values(this._agents).find(a=>a.playerControlled)||null},

getAgentPromptDesc(id){const a=this._agents[id];if(!a)return'';
if(a.activation==='dormant')return'';
if(a.activation==='aware')return`[感知]${a.name}(${a.role})`;
const ss=DiceSystem.STATS.map(s=>DiceSystem.STAT_NAMES[s]+':'+a.stats[s]).join(',');
const v=a.speechPattern?'|语气:'+a.speechPattern:'';
const tag=a.playerControlled?'★你★':a.activation==='focused'?'焦点':'活跃';
const traits=typeof TraitSystem!=='undefined'?TraitSystem.getPromptDesc(a):'';
let d=`[${tag}]${a.name}|${a.role}|${a.psyche.mbti}|${a.psyche.values.slice(0,2).join('、')}|${ss}${v}${traits?'|'+traits:''}`;
if(a.activation==='focused'){if(a.goals.length)d+='|目标:'+a.goals.join('、');if(a.secrets.length)d+='|秘密:'+a.secrets.join('、')}
return d},

getTokenAllocation(total){const ag=this.getActiveAgents();const tw=ag.reduce((s,a)=>s+a.weight,0)||1;
const r={};ag.forEach(a=>{r[a.id]={name:a.name,tokens:Math.round((a.weight/tw)*total),weight:a.weight,activation:a.activation}});return r},

formatStatusCard(a){const lvl=this.ACTIVATION[a.activation]||this.ACTIVATION.dormant;
const colors={dormant:'var(--tx2)',aware:'var(--wn)',active:'var(--ac)',focused:'var(--ac2)'};
const op=a.activation==='dormant'?'0.35':a.activation==='aware'?'0.55':'1';
const show=a.activation==='active'||a.activation==='focused';
const sb=show?DiceSystem.STATS.map(s=>`<div class="stat-row"><span class="stat-label">${DiceSystem.STAT_NAMES[s]}</span><div class="stat-bar"><div class="stat-fill ${s.toLowerCase()}" style="width:${(a.stats[s]/20)*100}%"></div></div><span class="stat-val">${a.stats[s]}</span></div>`).join(''):'';
return`<div class="status-card" style="opacity:${op}" onclick="UI.showCharacterDetail('${a.id}')"><div class="status-header"><div class="status-avatar">${a.avatar}</div><div><div class="status-name">${a.name}</div><div class="status-role">${a.role}</div></div><span class="status-weight" style="background:${colors[a.activation]}">${lvl.label}${a.weight?'·'+a.weight:''}</span></div>${show?`<div class="stat-bars">${sb}</div>${typeof TraitSystem!=='undefined'?TraitSystem.renderTags(a):''}<button class="psyche-btn" onclick="event.stopPropagation();UI.showPsyche('${a.id}')">🧠${a.psyche.mbti}</button>`:''}</div>`}
};