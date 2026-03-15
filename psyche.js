// ===== psyche.js - 修复：上下文感知的威胁/机会评估 =====
const PsycheSystem={
CF:{Se:{n:'外倾感觉'},Si:{n:'内倾感觉'},Ne:{n:'外倾直觉'},Ni:{n:'内倾直觉'},Te:{n:'外倾思维'},Ti:{n:'内倾思维'},Fe:{n:'外倾情感'},Fi:{n:'内倾情感'}},
STACKS:{INTJ:['Ni','Te','Fi','Se'],INTP:['Ti','Ne','Si','Fe'],ENTJ:['Te','Ni','Se','Fi'],ENTP:['Ne','Ti','Fe','Si'],INFJ:['Ni','Fe','Ti','Se'],INFP:['Fi','Ne','Si','Te'],ENFJ:['Fe','Ni','Se','Ti'],ENFP:['Ne','Fi','Te','Si'],ISTJ:['Si','Te','Fi','Ne'],ISFJ:['Si','Fe','Ti','Ne'],ESTJ:['Te','Si','Ne','Fi'],ESFJ:['Fe','Si','Ne','Ti'],ISTP:['Ti','Se','Ni','Fe'],ISFP:['Fi','Se','Ni','Te'],ESTP:['Se','Ti','Fe','Ni'],ESFP:['Se','Fi','Te','Ni']},
NEEDS:{survival:{n:'生存',w:10},belonging:{n:'归属',w:7},esteem:{n:'尊严',w:6},autonomy:{n:'自主',w:5},meaning:{n:'意义',w:4},desire:{n:'欲望',w:3}},

createPsyche(cd){const mbti=cd.mbti||this.inferMBTI(cd);const stack=this.STACKS[mbti]||this.STACKS.INTJ;
const fns={};Object.keys(this.CF).forEach(f=>{fns[f]=15});if(stack[0])fns[stack[0]]=100;if(stack[1])fns[stack[1]]=75;if(stack[2])fns[stack[2]]=50;if(stack[3])fns[stack[3]]=25;
const needs={};Object.keys(this.NEEDS).forEach(n=>{needs[n]={level:50+Math.floor(Math.random()*30)-15,priority:this.NEEDS[n].w}});
return{mbti,stack,functions:fns,needs,values:cd.values||this.inferValues(cd),emotions:{valence:0,arousal:30,dominant:'neutral'},defenses:{primary:cd.defense||'rationalization',threshold:30,stress:0},shadow:{traits:cd.shadowTraits||[],triggerThreshold:70}}},

inferMBTI(cd){const d=`${cd.background||''} ${cd.personality||''} ${cd.role||''}`.toLowerCase();let ei=0,sn=0,tf=0,jp=0;
if(/外向|社交|热情|领导/i.test(d))ei++;if(/内向|独处|沉默|思考/i.test(d))ei--;if(/实际|传统|经验/i.test(d))sn--;if(/直觉|想象|创新/i.test(d))sn++;
if(/逻辑|理性|分析/i.test(d))tf--;if(/情感|同理|善良/i.test(d))tf++;if(/计划|秩序|规则/i.test(d))jp--;if(/自由|随性|灵活/i.test(d))jp++;
return(ei>=0?'E':'I')+(sn>=0?'N':'S')+(tf>=0?'F':'T')+(jp>=0?'P':'J')},

inferValues(cd){const d=`${cd.background||''} ${cd.personality||''}`;const vals=[];
const m={'正义':/正义|公正/i,'自由':/自由|freedom/i,'权力':/权力|power/i,'知识':/知识|学问/i,'荣誉':/荣誉|honor/i,'爱':/爱|love/i,'生存':/生存|surviv/i,'忠诚':/忠诚|loyal/i};
for(const[v,re]of Object.entries(m)){if(re.test(d))vals.push(v)}return vals.length>=2?vals.slice(0,4):['正义','自由','生存']},

// ★ 核心修复：从叙事文本中提取情境威胁/机会值
extractSituation(text){
  let threat=0,opportunity=0;
  // 威胁关键词
  const threatWords=/死|杀|血|伤|危险|恐惧|逃|追|攻击|战斗|毒|陷阱|敌|暗杀|爆炸|崩塌|绝望|末日|入侵|围攻|背叛|威胁/g;
  const tMatches=(text.match(threatWords)||[]).length;
  threat=Math.min(1,tMatches*0.15);
  // 机会关键词
  const oppWords=/发现|宝|线索|盟友|机会|希望|突破|秘密|钥匙|力量|觉醒|升级|奖励|信任|合作|胜利/g;
  const oMatches=(text.match(oppWords)||[]).length;
  opportunity=Math.min(1,oMatches*0.12);
  // 危险等级（用于氛围系统）
  const dangerLevel=threat>0.7?'critical':threat>0.4?'high':threat>0.2?'medium':'low';
  return{threat,opportunity,dangerLevel}
},

analyze(psy,sit){const steps=[];const dom=psy.stack[0];
const percs={Se:'敏锐捕捉环境变化',Si:'与过往经历对比',Ne:'联想多种可能',Ni:'洞察深层含义',Te:'评估逻辑和资源',Ti:'构建内心模型',Fe:'感知众人情绪',Fi:'产生价值判断'};
steps.push({label:'感知',content:percs[dom]||'感知环境'});
const t=sit.threat||0,o=sit.opportunity||0;
// ★ 修复：天气mood也影响情绪
const weatherMood=(typeof WeatherSystem!=='undefined'?WeatherSystem.getMoodMod():0)/20;
let vs=o*10-t*15+weatherMood;
const nv=Math.max(-100,Math.min(100,psy.emotions.valence+vs));const na=Math.max(0,Math.min(100,psy.emotions.arousal+(t+o)*8));
let em='neutral';if(nv>30)em=na>60?'兴奋':'满足';else if(nv<-30)em=na>60?'恐惧':'悲伤';else if(na>60)em='紧张';
steps.push({label:'情绪',content:`${em}（效价${nv>0?'+':''}${Math.round(nv)}）`});
let maxN=null,maxS=-Infinity;for(const[n,s]of Object.entries(psy.needs)){const u=(100-s.level)*s.priority;if(u>maxS){maxS=u;maxN=n}}
steps.push({label:'需求',content:`→「${this.NEEDS[maxN]?.n||'?'}」（${psy.needs[maxN]?.level||50}%）`});
const pv=psy.values[0]||'本能';steps.push({label:'价值观',content:`以「${pv}」判断`});
const ns=psy.defenses.stress+t*10;
if(ns>psy.defenses.threshold){const dd={rationalization:'合理化',projection:'投射',denial:'否认',sublimation:'升华',displacement:'置换',repression:'压抑'};steps.push({label:'防御',content:dd[psy.defenses.primary]||'激活'})}
if(ns>psy.shadow.triggerThreshold&&psy.shadow.traits?.length)steps.push({label:'阴影',content:`「${psy.shadow.traits[0]}」浮现`});
const rational=(psy.functions.Te||15)+(psy.functions.Ti||15)>(psy.functions.Fe||15)+(psy.functions.Fi||15);
let conf=60;if(ns>psy.defenses.threshold)conf-=15;if(em==='恐惧')conf-=10;conf=Math.max(10,Math.min(100,conf));
steps.push({label:'决策',content:`${rational?'理性':'感性'}导向（信心${conf}%）`});
return{steps,confidence:conf,emotionShift:{valence:vs,arousal:(t+o)*8},stressChange:t*10,dangerLevel:sit.dangerLevel||'low'}},

updatePsyche(psy,ev){if(ev.emotionShift){psy.emotions.valence=Math.max(-100,Math.min(100,psy.emotions.valence+ev.emotionShift.valence));psy.emotions.arousal=Math.max(0,Math.min(100,psy.emotions.arousal+ev.emotionShift.arousal))}
if(ev.stressChange)psy.defenses.stress=Math.max(0,Math.min(100,psy.defenses.stress+ev.stressChange));return psy},

formatPsycheProcess(a){return'<div class="psyche-thought">'+a.steps.map(s=>`<div class="thought-step"><span class="t-label">【${s.label}】</span>${s.content}</div>`).join('')+'</div>'},

// ★ 新增：角色内心抗拒系统
// 检测行动是否违背角色价值观，返回抗拒等级和内心独白
calcResistance(agent, actionText) {
  const psy = agent.psyche;
  if (!psy || !psy.values?.length) return { level: 0, resists: false, monologue: '' };

  const values = psy.values;
  const willpower = agent.stats?.WIL || 10;

  // 行动与价值观的冲突检测
  const conflictMap = {
    '正义': /欺骗|偷|背叛|杀害无辜|陷害|栽赃|撒谎|隐瞒真相/i,
    '自由': /服从|跪|臣服|投降|放弃|屈服|听从命令/i,
    '权力': /退让|示弱|求饶|放弃权力|让步|妥协/i,
    '知识': /销毁|焚书|隐瞒知识|愚弄|无视线索/i,
    '荣誉': /逃跑|背后偷袭|卑鄙|下毒|暗算|不光彩/i,
    '爱': /抛弃|伤害.*(?:爱人|朋友|家人)|冷漠|无视求助/i,
    '生存': /自杀|送死|牺牲自己|以命换|赴死/i,
    '忠诚': /背叛|出卖|告密|反水|叛变/i
  };

  let maxConflict = 0;
  let conflictValue = '';
  values.forEach(v => {
    const re = conflictMap[v];
    if (re && re.test(actionText)) {
      const strength = values.indexOf(v) === 0 ? 1.0 : 0.6; // 核心价值观冲突更强
      if (strength > maxConflict) { maxConflict = strength; conflictValue = v; }
    }
  });

  if (maxConflict === 0) return { level: 0, resists: false, monologue: '', conflictValue: '' };

  // 抗拒等级 = 冲突强度 × 意志力修正 (0-100)
  const resistLevel = Math.round(maxConflict * (willpower / 20) * 80);
  // 意志力高的角色抗拒更强
  const resists = resistLevel > 40; // 超过40才产生实际抗拒
  const refuses = resistLevel > 75; // 超过75可能拒绝行动

  // 生成内心独白
  const monologues = {
    light: [ // 20-40: 轻微不适
      `（……总觉得哪里不对。）`,
      `（这样做真的好吗？）`,
      `（心里有些不安。）`
    ],
    medium: [ // 40-75: 明显抗拒
      `（不……这违背了我所相信的「${conflictValue}」。）`,
      `（每一根神经都在抗拒这个决定。）`,
      `（如果这么做了，我还是我吗？）`,
      `（手在发抖。这不是我会做的事。）`
    ],
    heavy: [ // 75+: 强烈拒绝
      `（绝不。就算天塌下来，我也不会背弃「${conflictValue}」。）`,
      `（身体像被钉在原地。无论如何都做不到。）`,
      `（宁死也不会这样做。这是底线。）`
    ]
  };

  let pool = monologues.light;
  if (resistLevel > 75) pool = monologues.heavy;
  else if (resistLevel > 40) pool = monologues.medium;
  const monologue = pool[Math.floor(Math.random() * pool.length)];

  return {
    level: resistLevel,
    resists,
    refuses,
    conflictValue,
    monologue,
    stressDelta: Math.round(resistLevel * 0.3), // 抗拒会增加压力
    dicePenalty: resists ? -Math.ceil(resistLevel / 30) : 0 // 抗拒时骰子惩罚
  };
},

formatPsycheDetail(psy){const labels=['主导','辅助','第三','劣势'];
let h=`<div class="psyche-section"><h4>${psy.mbti}</h4><div class="psyche-grid">${psy.stack.map((f,i)=>`<div class="psyche-item"><div class="p-label">${labels[i]}</div><div class="p-value">${f} ${this.CF[f]?.n||''}</div></div>`).join('')}</div></div>`;
h+=`<div class="psyche-section"><h4>价值观</h4><p style="font-size:11px;color:var(--tx1)">${psy.values.join('·')}</p></div>`;
h+=`<div class="psyche-section"><h4>情绪</h4><div class="psyche-grid"><div class="psyche-item"><div class="p-label">效价</div><div class="p-value">${psy.emotions.valence>0?'+':''}${psy.emotions.valence}</div></div><div class="psyche-item"><div class="p-label">唤醒</div><div class="p-value">${psy.emotions.arousal}</div></div><div class="psyche-item"><div class="p-label">主导</div><div class="p-value">${psy.emotions.dominant}</div></div><div class="psyche-item"><div class="p-label">压力</div><div class="p-value">${psy.defenses.stress}</div></div></div></div>`;
h+='<div class="psyche-section"><h4>需求</h4>';for(const[n,s]of Object.entries(psy.needs)){h+=`<div style="margin-bottom:2px;display:flex;align-items:center;gap:4px"><span style="font-size:9px;color:var(--tx2);width:32px">${this.NEEDS[n]?.n||n}</span><div class="stat-bar" style="flex:1"><div class="stat-fill" style="width:${s.level}%;background:var(--ac)"></div></div><span style="font-size:8px;color:var(--tx2)">${s.level}%</span></div>`}h+='</div>';return h}
};