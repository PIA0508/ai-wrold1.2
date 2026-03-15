// ===== dice.js - 预掷骰系统 + 动画 =====
const DiceSystem={
STATS:['STR','DEX','INT','CHA','LUK','WIL'],
STAT_NAMES:{STR:'力量',DEX:'敏捷',INT:'智力',CHA:'魅力',LUK:'运气',WIL:'意志'},
_pendingRolls:{}, // 预掷骰结果缓存 { "角色名:检定类型": result }

roll(n,m){let t=0;for(let i=0;i<n;i++)t+=Math.floor(Math.random()*m)+1;return t},
d20(){return Math.floor(Math.random()*20)+1},

check(sv,diff=0,bonusMod=0){
  const tgt=Math.max(1,sv-diff+bonusMod);const r=this.d20();
  const crit=r===1;const fumble=r===20;const ok=crit||(!fumble&&r<=tgt);
  return{roll:r,target:tgt,success:ok,critical:crit,fumble,margin:tgt-r,
    desc:crit?'大成功！':fumble?'大失败！':ok?'成功':'失败',
    quality:crit?'crit':ok?'success':'fail'}
},

eventCheck(ch,type,weatherMod=0,bondMod=0){
  const map={combat:'STR',stealth:'DEX',puzzle:'INT',social:'CHA',luck:'LUK',endure:'WIL',persuade:'CHA',investigate:'INT',dodge:'DEX',resist:'WIL'};
  const s=map[type]||'LUK';const sv=ch.stats[s];
  const totalMod=weatherMod+bondMod;
  const r=this.check(sv,0,totalMod);
  r.stat=s;r.statName=this.STAT_NAMES[s];r.weatherMod=weatherMod;r.bondMod=bondMod;
  return r
},

// ★ 核心修复：预掷骰 - 在AI生成前掷好骰子，结果注入prompt
preRoll(charName,checkType,agent,weatherMod=0,bondMod=0){
  const r=this.eventCheck(agent,checkType,weatherMod,bondMod);
  const key=charName+':'+checkType;
  this._pendingRolls[key]=r;
  return r
},

// 获取预掷结果（解析文本时使用）
getPendingRoll(charName,checkType){
  const key=charName.trim()+':'+checkType.trim();
  return this._pendingRolls[key]||null
},

clearPending(){this._pendingRolls={}},

// 生成预掷骰的prompt注入文本
getPendingRollsPrompt(){
  const entries=Object.entries(this._pendingRolls);
  if(!entries.length)return'';
  return'\n【骰子检定结果——必须严格遵守】\n'+
    entries.map(([k,r])=>{
      const margin=Math.abs(r.margin);
      let interp='';
      if(r.critical)interp='★大成功：动作完美执行，产生超预期的惊人效果。描写要让人热血沸腾。';
      else if(r.fumble)interp='✧大失败：动作彻底失败，产生灾难性后果。必须描写具体的惨痛代价。';
      else if(r.success&&margin>=5)interp='轻松成功：动作流畅完成，几乎不费力。';
      else if(r.success&&margin>=0)interp='勉强成功：动作完成但不完美，可能有小代价。';
      else if(!r.success&&margin>=-3)interp='险些成功：差一点就做到了，描写那个"差一点"的遗憾。';
      else interp='明显失败：动作失败，描写具体的失败后果和处境恶化。';
      return`${k}: d20=${r.roll}/目标${r.target} → ${r.desc}\n  解读：${interp}`
    }).join('\n')+
    '\n★每个骰子结果都必须在叙事中体现，成功写成功的效果，失败写失败的后果，不能忽略。\n'
},

// 骰子动画（修复：确保interval必定清除，结算即停）
_animInterval:null,
async showDiceAnimation(result){
  // 先清除上一次可能残留的动画
  if(this._animInterval){clearInterval(this._animInterval);this._animInterval=null}
  const overlay=document.getElementById('diceOverlay');
  const stage=document.getElementById('diceStage');
  if(!overlay||!stage)return;
  return new Promise(resolve=>{
    overlay.classList.add('show');
    stage.innerHTML=`
      <div class="dice-info">${result.statName||''}检定</div>
      <div class="dice-cube"><div class="dice-face rolling ${result.quality}">?</div></div>
      <div class="dice-detail">d20 投掷中...</div>`;
    let count=0;
    this._animInterval=setInterval(()=>{
      const face=stage.querySelector('.dice-face');
      if(face)face.textContent=Math.floor(Math.random()*20)+1;
      count++;
      if(count>=10){
        // ★ 立刻清除interval，不再循环
        clearInterval(this._animInterval);this._animInterval=null;
        // 显示最终结果
        stage.innerHTML=`
          <div class="dice-info">${result.statName||''}检定</div>
          <div class="dice-cube"><div class="dice-face ${result.quality}">${result.roll}</div></div>
          <div class="dice-result-text ${result.quality}">${result.desc}</div>
          <div class="dice-detail">d20=${result.roll} / 目标≤${result.target}${result.weatherMod?' 天气'+result.weatherMod:''}${result.bondMod?' 羁绊'+result.bondMod:''}</div>`;
        // 1秒后关闭
        setTimeout(()=>{overlay.classList.remove('show');resolve()},1000)
      }
    },50)
    // 安全兜底：2秒后无论如何关闭
    setTimeout(()=>{
      if(this._animInterval){clearInterval(this._animInterval);this._animInterval=null}
      overlay.classList.remove('show');resolve()
    },2500)
  })
},

// 格式化骰子结果为行内HTML
formatRollInline(r){
  const ic=r.critical?'✦':r.fumble?'✧':'🎲';
  return`<span class="story-dice-inline" onclick="DiceSystem.showDiceAnimation(${JSON.stringify(r).replace(/"/g,'&quot;')})">${ic}${r.statName||''}:${r.roll}/${r.target}→<span class="dice-result ${r.quality}">${r.desc}</span></span>`
},

generateStats(p){const base={};const tm={prodigy:4,gifted:2,average:0,below:-2};const mod=tm[p.talent||'average']||0;
this.STATS.forEach(s=>{let v=this.roll(3,6)+mod;if(p.roleBonus&&p.roleBonus[s])v+=p.roleBonus[s];if((s==='INT'||s==='CHA')&&p.educated)v+=this.roll(1,4);if(p.experienced&&(s==='STR'||s==='DEX'||s==='WIL'))v+=this.roll(1,3);base[s]=Math.max(1,Math.min(20,v))});base.LUK=Math.max(1,Math.min(20,this.roll(3,6)));return base},

parseOrGenerate(cd){if(cd.stats&&typeof cd.stats==='object'){const s={};this.STATS.forEach(k=>{s[k]=Math.max(1,Math.min(20,parseInt(cd.stats[k])||10))});return s}
const p={talent:'average',roleBonus:{},educated:false,experienced:false};const d=(cd.background||'')+(cd.role||'');
if(/天才|神童|prodigy/i.test(d))p.talent='prodigy';else if(/天赋|gifted|优秀/i.test(d))p.talent='gifted';
if(/学者|教授|博士/i.test(d))p.educated=true;if(/老兵|经验|veteran/i.test(d))p.experienced=true;
if(/战士|武|fighter/i.test(d))p.roleBonus.STR=3;if(/盗贼|刺客|rogue/i.test(d))p.roleBonus.DEX=3;
if(/法师|巫师|mage/i.test(d))p.roleBonus.INT=3;if(/领袖|贵族|leader/i.test(d))p.roleBonus.CHA=3;
return this.generateStats(p)}
};