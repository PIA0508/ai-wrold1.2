// ===== save.js - 自动存档系统 =====
const SaveSystem={
KEY:'IN_save_v2',

save(){
  try{
    const data={
      version:2,timestamp:Date.now(),
      engine:{state:GameEngine._state,world:GameEngine._world,plotOutline:GameEngine._plotOutline,
        currentChapter:GameEngine._currentChapter,chapterIndex:GameEngine._chapterIndex,
        turnCount:GameEngine._turnCount,controlledCharId:GameEngine._controlledCharId,
        commentaryEnabled:GameEngine._commentaryEnabled},
      agents:AgentSystem.getAllAgents().map(a=>({...a,psyche:{...a.psyche,emotions:{...a.psyche.emotions},defenses:{...a.psyche.defenses},needs:JSON.parse(JSON.stringify(a.psyche.needs))},
        relationships:JSON.parse(JSON.stringify(a.relationships))})),
      agentMeta:{activeAgents:AgentSystem._activeAgents,scenePresent:[...AgentSystem._scenePresent]},
      memory:{memories:MemorySystem._memories,context:MemorySystem._context,turnCounter:MemorySystem._turnCounter,structuredData:MemorySystem._structuredData},
      weather:WeatherSystem._current,weatherPool:WeatherSystem._pool,
      map:{locations:WorldMap._locations,currentLocation:WorldMap._currentLocation,visitHistory:WorldMap._visitHistory},
      storyHTML:document.getElementById('storyContent')?.innerHTML||''
    };
    localStorage.setItem(this.KEY,JSON.stringify(data));
    // 显示存档指示
    const ind=document.getElementById('saveIndicator');if(ind){ind.classList.add('show');setTimeout(()=>ind.classList.remove('show'),1500)}
    return true
  }catch(e){console.warn('存档失败:',e);return false}
},

hasSave(){return!!localStorage.getItem(this.KEY)},

loadAndResume(){
  try{
    const raw=localStorage.getItem(this.KEY);if(!raw)return false;
    const d=JSON.parse(raw);if(d.version!==2)return false;

    // 恢复引擎状态
    Object.assign(GameEngine,{_state:d.engine.state,_world:d.engine.world,_plotOutline:d.engine.plotOutline,
      _currentChapter:d.engine.currentChapter,_chapterIndex:d.engine.chapterIndex,
      _turnCount:d.engine.turnCount,_controlledCharId:d.engine.controlledCharId,
      _commentaryEnabled:d.engine.commentaryEnabled,_choicesPending:false});

    // 恢复Agent
    AgentSystem.init();d.agents.forEach(a=>{AgentSystem._agents[a.id]=a});
    AgentSystem._activeAgents=d.agentMeta.activeAgents;AgentSystem._scenePresent=new Set(d.agentMeta.scenePresent);

    // 恢复记忆
    MemorySystem._memories=d.memory.memories;MemorySystem._context=d.memory.context;
    MemorySystem._turnCounter=d.memory.turnCounter;MemorySystem._structuredData=d.memory.structuredData||[];

    // 恢复天气
    if(d.weather)WeatherSystem._current=d.weather;if(d.weatherPool)WeatherSystem._pool=d.weatherPool;
    WeatherSystem._renderFx();WeatherSystem._updateIndicator();

    // 恢复地图
    if(d.map){WorldMap._locations=d.map.locations;WorldMap._currentLocation=d.map.currentLocation;WorldMap._visitHistory=d.map.visitHistory||[]}

    // 恢复UI
    UI.goTo('screen-game');
    document.getElementById('gameWorldName').textContent=d.engine.world?.name||'';
    document.getElementById('gameChapter').textContent=d.engine.currentChapter;
    document.getElementById('storyContent').innerHTML=d.storyHTML||'';
    UI.initGameScreen();UI.scrollToBottom();
    // 显示继续按钮等待操作
    UI.showContinueButton();
    UI.toast('存档已恢复');return true
  }catch(e){console.error('读档失败:',e);UI.toast('读档失败');return false}
},

deleteSave(){localStorage.removeItem(this.KEY)}
};