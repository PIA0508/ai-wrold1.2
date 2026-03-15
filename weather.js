// ===== weather.js - 天气系统（修复：特效在游戏界面+实际影响骰子+场景转场） =====
const WeatherSystem={
_current:{type:'clear',intensity:.5,desc:'晴朗',icon:'☀️',effects:[]},_history:[],_pool:['clear','cloudy','rain'],
TYPES:{clear:{icon:'☀️',desc:'晴朗',mood:5,vis:'高'},cloudy:{icon:'☁️',desc:'多云',mood:0,vis:'中'},overcast:{icon:'🌥️',desc:'阴天',mood:-3,vis:'中'},rain:{icon:'🌧️',desc:'下雨',mood:-5,vis:'低',fx:{dex:-1,stealth:1}},storm:{icon:'⛈️',desc:'暴风雨',mood:-10,vis:'极低',fx:{dex:-2,luck:-1,combat:-1}},snow:{icon:'🌨️',desc:'下雪',mood:-3,vis:'低',fx:{dex:-1}},fog:{icon:'🌫️',desc:'大雾',mood:-5,vis:'极低',fx:{stealth:2,investigate:-2}},wind:{icon:'💨',desc:'大风',mood:-2,vis:'中',fx:{dex:-1}},night:{icon:'🌙',desc:'夜晚',mood:-2,vis:'低',fx:{stealth:2}},dawn:{icon:'🌅',desc:'黎明',mood:8,vis:'中'},hot:{icon:'🔥',desc:'酷热',mood:-5,vis:'高',fx:{endure:-1}},cold:{icon:'❄️',desc:'严寒',mood:-5,vis:'中',fx:{endure:-2}}},

init(worldType){const presets={'奇幻':['clear','cloudy','rain','fog','dawn'],'科幻':['clear','overcast','storm','night'],'末日':['overcast','storm','fog','hot','cold'],'恐怖':['fog','night','overcast','storm','rain'],'武侠':['clear','rain','wind','dawn','snow'],'历史':['clear','cloudy','rain','snow'],'悬疑':['fog','night','overcast','rain'],'现实':['clear','cloudy','rain','overcast']};
this._pool=presets[worldType]||['clear','cloudy','rain'];this.setWeather(this._pool[0])},

setWeather(type,intensity){const def=this.TYPES[type];if(!def)return;
this._current={type,intensity:intensity||(0.3+Math.random()*.7),desc:def.desc,icon:def.icon,effects:def.fx||{},mood:def.mood,vis:def.vis};
this._history.push({...this._current,time:Date.now()});if(this._history.length>20)this._history=this._history.slice(-20);
this._renderFx();this._updateIndicator()},

evolve(){if(Math.random()<.4)return;const next=this._pool[Math.floor(Math.random()*this._pool.length)];this.setWeather(next)},
getCurrent(){return{...this._current}},

// ★ 修复：天气实际影响骰子
getDiceMod(checkType){return this._current.effects[checkType]||0},

// ★ 修复：天气mood影响角色心理
getMoodMod(){return this._current.mood||0},

getPromptDesc(){const w=this._current;const fxStr=Object.entries(w.effects).map(([k,v])=>k+(v>0?'+':'')+v).join(',');
return`【天气】${w.icon}${w.desc}（能见度${w.vis}）${fxStr?'影响:'+fxStr:''}`},

// ★ 场景转场动画
async playSceneTransition(locationName,weatherIcon){
  const el=document.getElementById('sceneTransition');if(!el)return;
  const w=this._current;
  el.innerHTML=`<div class="st-icon">${weatherIcon||w.icon}</div><div class="st-text">${locationName||'未知之地'}</div><div class="st-weather">${w.icon} ${w.desc}</div>`;
  el.classList.add('active');
  await new Promise(r=>setTimeout(r,1800));
  el.classList.remove('active')
},

// ★ 修复：天气特效渲染在游戏界面的fx层
_renderFx(){const layer=document.getElementById('weatherFx');if(!layer)return;
layer.className='weather-fx';layer.innerHTML='';
const t=this._current.type;
if(t==='rain'||t==='storm'){const n=t==='storm'?50:25;for(let i=0;i<n;i++){const d=document.createElement('div');d.className='raindrop';d.style.left=Math.random()*100+'%';d.style.animationDuration=(.25+Math.random()*.4)+'s';d.style.animationDelay=Math.random()*2+'s';layer.appendChild(d)}}
else if(t==='snow'){for(let i=0;i<30;i++){const f=document.createElement('div');f.className='snowflake';f.style.left=Math.random()*100+'%';f.style.animationDuration=(2+Math.random()*3)+'s';f.style.animationDelay=Math.random()*3+'s';f.style.fontSize=(6+Math.random()*6)+'px';f.textContent='❄';layer.appendChild(f)}}
else if(t==='fog')layer.classList.add('fog')},

_updateIndicator(){const el=document.getElementById('weatherIndicator');if(el)el.textContent=this._current.icon+this._current.desc}
};