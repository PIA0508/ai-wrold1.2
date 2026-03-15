// ===== memory.js - 修复：压缩时保留结构化数据，token预算控制 =====
const MemorySystem={
_memories:[],_context:[],_fullHistory:[],_turnCounter:0,_structuredData:[],
PRECISE_WINDOW:20,DIGEST_INTERVAL:5,MAX_CONTEXT_TOKENS:6000,

init(){this._memories=[];this._context=[];this._fullHistory=[];this._turnCounter=0;this._structuredData=[]},

addToHistory(role,content,meta={}){
  const entry={role,content,timestamp:Date.now(),turn:this._turnCounter,chapter:meta.chapter||'',characters:meta.characters||[]};
  this._fullHistory.push(entry);this._context.push({role,content});
  if(role==='assistant'){
    this._turnCounter++;
    // ★ 修复：提取并保留结构化数据
    this._extractStructuredData(content);
    this._manageContext();
    this._autoMemory(entry)
  }
},

// ★ 新增：从文本中提取结构化数据单独保存（不会被压缩丢失）
_extractStructuredData(text){
  const data=[];
  // 好感度变化
  const bonds=[...text.matchAll(/\[BOND:([^:]+):([^:]+):([^:]+):([^\]]+)\]/g)];
  bonds.forEach(m=>data.push({type:'bond',a:m[1],b:m[2],val:parseInt(m[3]),reason:m[4],turn:this._turnCounter}));
  // 地点
  const locs=[...text.matchAll(/\[LOCATION:([^:\]]+)/g)];
  locs.forEach(m=>data.push({type:'location',name:m[1].trim(),turn:this._turnCounter}));
  // 骰子结果
  const dice=[...text.matchAll(/\[DICE:([^:]+):([^\]]+)\]/g)];
  dice.forEach(m=>data.push({type:'dice',char:m[1],check:m[2],turn:this._turnCounter}));
  if(data.length)this._structuredData.push(...data);
  if(this._structuredData.length>100)this._structuredData=this._structuredData.slice(-100)
},

_manageContext(){
  const sys=this._context.filter(m=>m.role==='system');
  const non=this._context.filter(m=>m.role!=='system');
  const maxMsgs=this.PRECISE_WINDOW*2;
  if(non.length<=maxMsgs)return;

  const digestCount=this.DIGEST_INTERVAL*2;
  const toDigest=non.slice(0,digestCount);
  const toKeep=non.slice(digestCount);

  // ★ AI驱动的智能摘要（替代粗暴截断）
  const summary=toDigest.map(m=>{
    const prefix=m.role==='assistant'?'':'[行动]';
    const clean=m.content.replace(/\[(PSYCHE|META|\/META)[^\]]*\]/g,'').substring(0,100);
    return prefix+clean
  }).join('\n');

  // 尝试用AI生成高质量摘要（异步，不阻塞）
  this._aiSummarize(summary,turnRange).catch(()=>{});

  // 附加该时段的结构化数据摘要
  const turnRange=[this._turnCounter-this.PRECISE_WINDOW-this.DIGEST_INTERVAL,this._turnCounter-this.PRECISE_WINDOW];
  const periodData=this._structuredData.filter(d=>d.turn>=turnRange[0]&&d.turn<turnRange[1]);
  const dataStr=periodData.length?'\n关键事件:'+periodData.map(d=>{
    if(d.type==='bond')return`${d.a}↔${d.b}好感${d.val>0?'+':''}${d.val}`;
    if(d.type==='location')return`到达${d.name}`;
    if(d.type==='dice')return`${d.char}${d.check}检定`;return''
  }).filter(Boolean).join(';'):'';

  const digestMsg={role:'system',content:`【回合${turnRange[0]}-${turnRange[1]}记忆概括】\n${summary.substring(0,400)}${dataStr}\n（压缩记忆，后续为精确记忆）`};

  this.addMemory({chapter:'记忆概括',summary:'回合'+turnRange[0]+'-'+turnRange[1]+'：'+summary.substring(0,120).replace(/\n/g,' ')+'...',isDigest:true,important:true});
  this._context=[...sys,digestMsg,...toKeep]
},

_autoMemory(entry){if(entry.role!=='assistant')return;
const clean=entry.content.replace(/\[.*?\]/g,'').replace(/[「」（）]/g,'');
this.addMemory({chapter:entry.chapter||'',summary:clean.substring(0,100)+(clean.length>100?'...':''),characters:entry.characters,turn:entry.turn})},

addMemory(mem){this._memories.push({id:Date.now(),chapter:mem.chapter||'',summary:mem.summary||'',characters:mem.characters||[],timestamp:Date.now(),important:mem.important||false,isDigest:mem.isDigest||false,turn:mem.turn!==undefined?mem.turn:this._turnCounter});
if(typeof UI!=='undefined')UI.renderMemoryList()},

// ★ Author's Note深度注入：在倒数第3-4条位置插入写作提醒
// ★ AI驱动摘要（异步替换粗糙摘要）
async _aiSummarize(rawSummary,turnRange){
  try{
    const res=await GameEngine.callAI([
      {role:'system',content:'用2-3句话概括以下剧情片段，保留关键人物、事件、地点、选择及其后果。不超过80字。'},
      {role:'user',content:rawSummary.substring(0,500)}
    ],{maxTokens:150,temperature:0.3,timeout:10000,retries:0});
    if(res&&res.length>10){
      // 替换context中的粗糙摘要
      const sysIdx=this._context.findIndex(m=>m.role==='system'&&m.content.includes('记忆概括'));
      if(sysIdx>=0)this._context[sysIdx].content=`【回合${turnRange[0]}-${turnRange[1]}AI摘要】${res.trim()}`;
      // 更新记忆条目
      const memIdx=this._memories.findIndex(m=>m.isDigest&&m.summary.includes('回合'+turnRange[0]));
      if(memIdx>=0)this._memories[memIdx].summary=res.trim();
    }
  }catch(e){/* 静默失败，保留粗糙摘要 */}
},

getContext(){
  const ctx=[...this._context];
  // 获取Author's Note（如果GameEngine已初始化）
  if(typeof GameEngine!=='undefined'&&GameEngine._getAuthorsNote){
    const note=GameEngine._getAuthorsNote();
    if(note&&ctx.length>4){
      // 插入到倒数第4条位置
      const insertIdx=Math.max(1,ctx.length-4);
      ctx.splice(insertIdx,0,{role:'system',content:note});
    }
  }
  return ctx
},
getMemories(){return[...this._memories]},
getStructuredData(){return[...this._structuredData]},

getContextSummary(){if(!this._memories.length)return'';
return'【近期回顾】\n'+this._memories.slice(-4).map(m=>`[${m.chapter}]${m.summary}`).join('\n')},

// ★ 新增：估算当前上下文token数（粗略：1中文字≈2token）
estimateTokens(){return this._context.reduce((s,m)=>s+Math.ceil(m.content.length*1.5),0)},

getTurnCount(){return this._turnCounter},
clear(){this._memories=[];this._context=[];this._fullHistory=[];this._turnCounter=0;this._structuredData=[]}
};