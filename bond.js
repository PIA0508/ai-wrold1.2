// ===== bond.js - 好感度与羁绊（修复：深拷贝） =====
const BondSystem={
RELATION_TYPES:{stranger:{label:'陌生',color:'#605c72',icon:'❓',range:[-10,10]},acquaint:{label:'相识',color:'#a09cb0',icon:'👋',range:[10,30]},friendly:{label:'友好',color:'#5cfcb6',icon:'😊',range:[30,55]},close:{label:'亲密',color:'#7c5cfc',icon:'💜',range:[55,75]},bonded:{label:'羁绊',color:'#ffd700',icon:'🔗',range:[75,100]},tense:{label:'紧张',color:'#fcbc4c',icon:'😤',range:[-30,-10]},hostile:{label:'敌对',color:'#fc5c8c',icon:'⚔️',range:[-60,-30]},nemesis:{label:'宿敌',color:'#fc4c4c',icon:'💀',range:[-100,-60]}},
FACTION_MATRIX:{},

initAffinity(a1,a2){
  const pm=this._psycheMatch(a1.psyche,a2.psyche);
  const vm=this._valueMatch(a1.psyche?.values,a2.psyche?.values);
  const fm=this._factionAff(a1,a2);
  const init=Math.round(pm*.4+vm*.35+fm*.25);
  const base=Math.max(-100,Math.min(100,init));
  return{value:base,base,psycheMatch:pm,valueMatch:vm,factionMod:fm,actionMod:0,
    history:[],bondActive:false,bondType:null,bondEffect:null,sharedGoals:[],whispers:[],lastInteraction:null}
},

// ★ 修复：返回独立的深拷贝（反向关系）
initAffinityPair(a1,a2){
  const fwd=this.initAffinity(a1,a2);
  // 深拷贝：独立的history和whispers数组
  const rev={...fwd,history:[],whispers:[],sharedGoals:[...fwd.sharedGoals]};
  return{fwd,rev}
},

_psycheMatch(p1,p2){if(!p1||!p2)return 0;const s1=p1.stack||[],s2=p2.stack||[];let sc=0;
const comp={Te:'Fi',Fi:'Te',Fe:'Ti',Ti:'Fe',Se:'Ni',Ni:'Se',Ne:'Si',Si:'Ne'};
if(s1[0]&&comp[s1[0]]===s2[1])sc+=12;if(s1[1]&&comp[s1[1]]===s2[0])sc+=8;if(s1[0]===s2[0])sc+=5;
if(p1.mbti?.[0]!==p2.mbti?.[0])sc+=4;return Math.max(-30,Math.min(30,sc-5))},

_valueMatch(v1,v2){if(!v1?.length||!v2?.length)return 0;const shared=v1.filter(v=>v2.includes(v));
const conflicts={'自由':'秩序','秩序':'自由','权力':'自由','复仇':'爱','爱':'复仇'};
let cc=0;v1.forEach(v=>{if(conflicts[v]&&v2.includes(conflicts[v]))cc++});return shared.length*12-cc*15},

_factionAff(a1,a2){if(a1.faction&&a2.faction){if(a1.faction===a2.faction)return 20;return this.FACTION_MATRIX[a1.faction]?.[a2.faction]??-10}return 0},

modifyAffinity(rel,delta,reason){rel.actionMod+=delta;rel.value=Math.max(-100,Math.min(100,rel.base+rel.actionMod));
rel.history.push({delta,reason,time:Date.now(),newValue:rel.value});if(rel.history.length>30)rel.history=rel.history.slice(-30);
rel.lastInteraction=Date.now();this._checkBond(rel);return rel},

getRelationType(v){for(const[k,d]of Object.entries(this.RELATION_TYPES)){if(v>=d.range[0]&&v<d.range[1])return{key:k,...d}}
if(v>=75)return{key:'bonded',...this.RELATION_TYPES.bonded};if(v<=-60)return{key:'nemesis',...this.RELATION_TYPES.nemesis};return{key:'stranger',...this.RELATION_TYPES.stranger}},

_checkBond(rel){if(rel.value>=75&&!rel.bondActive){rel.bondActive=true;rel.bondType='trust';rel.bondEffect={diceBonus:2,supportChance:.3,whisperEnabled:true}}
if(rel.value<=-60&&!rel.bondActive){rel.bondActive=true;rel.bondType='rivalry';rel.bondEffect={dicePenalty:-1,confrontChance:.4,whisperEnabled:false}}},

getBondDiceMod(a1Id,a2Id){const agents=AgentSystem?.getAllAgents()||[];const a1=agents.find(a=>a.id===a1Id);if(!a1)return 0;
const rel=a1.relationships?.[a2Id];if(!rel?.bondActive)return 0;
return rel.bondType==='trust'?(rel.bondEffect?.diceBonus||0):rel.bondType==='rivalry'?(rel.bondEffect?.dicePenalty||0):0},

addWhisper(rel,from,content){if(!rel.bondActive||!rel.bondEffect?.whisperEnabled)return false;
rel.whispers.push({from,content,time:Date.now()});if(rel.whispers.length>10)rel.whispers=rel.whispers.slice(-10);return true},

formatAffinityBar(v){const rt=this.getRelationType(v);const pct=(v+100)/2;const bc=v>=0?'var(--ac3)':'var(--no)';
return`<div class="affinity-row"><div class="affinity-bar-bg"><div class="affinity-bar-fill" style="width:${pct}%;background:${bc}"></div><div class="affinity-bar-mid"></div></div><span class="affinity-val" style="color:${rt.color}">${rt.icon}${v>0?'+':''}${v}</span></div>`},

formatRelationCard(a1,a2,rel){const rt=this.getRelationType(rel.value);
const bt=rel.bondActive?`<span class="bond-tag ${rel.bondType}">${rel.bondType==='trust'?'🔗羁绊':'⚔️宿敌'}</span>`:'';
return`<div class="relation-card" onclick="UI.showRelationDetail('${a1.id}','${a2.id}')"><div class="rel-pair"><span class="rel-avatar">${a1.avatar}</span><div class="rel-line" style="border-color:${rt.color}"><span class="rel-type-tag" style="background:${rt.color}">${rt.label}</span></div><span class="rel-avatar">${a2.avatar}</span></div><div class="rel-names">${a1.name}—${a2.name}</div>${this.formatAffinityBar(rel.value)}${bt}</div>`},

getRelPromptDesc(a1,a2,rel){const rt=this.getRelationType(rel.value);let d=`${a1.name}↔${a2.name}:${rt.label}(${rel.value})`;
if(rel.bondActive)d+=rel.bondType==='trust'?'【羁绊:互助,骰子+2】':'【宿敌:冲突,骰子-1】';return d}
};