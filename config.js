const Config={
_d:{apiKey:'',apiUrl:'https://api.deepseek.com/v1/chat/completions',model:'deepseek-chat',maxTokens:2048,temperature:.8},
get(k){
  // ★ 兼容新旧两种localStorage key
  let s=localStorage.getItem('IN_cfg');
  if(!s)s=localStorage.getItem('infiniteNarrative_config');
  const c=s?JSON.parse(s):{};return c[k]!==undefined?c[k]:this._d[k]},
set(k,v){const s=localStorage.getItem('IN_cfg');const c=s?JSON.parse(s):{};c[k]=v;localStorage.setItem('IN_cfg',JSON.stringify(c))},
save(){this.set('apiKey',document.getElementById('apiKeyInput').value.trim());this.set('apiUrl',document.getElementById('apiUrlInput').value.trim());this.set('model',document.getElementById('modelSelect').value);UI.closeModal('modal-settings');UI.checkApiStatus();UI.toast('已保存')},
load(){document.getElementById('apiKeyInput').value=this.get('apiKey')||'';document.getElementById('apiUrlInput').value=this.get('apiUrl');document.getElementById('modelSelect').value=this.get('model')},
popularWorlds:[
{id:'harry_potter',emoji:'⚡',name:'哈利·波特',tag:'魔法',desc:'霍格沃茨魔法学校',worldDesc:'魔法与现实并存。霍格沃茨培养巫师，魔法部管理秩序。',worldType:'奇幻',conflict:'黑暗势力威胁，纯血统冲突。'},
{id:'three_body',emoji:'🌌',name:'三体',tag:'科幻',desc:'三体文明的抉择',worldDesc:'三体人入侵地球，智子锁死科技。面壁计划是最后希望。',worldType:'科幻',conflict:'技术封锁下寻求生存。'},
{id:'erta',emoji:'👑',name:'甄嬛传',tag:'宫斗',desc:'紫禁城权谋',worldDesc:'清雍正年间，后宫嫔妃为宠爱地位明争暗斗。',worldType:'历史',conflict:'后宫权力争斗。'},
{id:'cyberpunk',emoji:'🤖',name:'赛博朋克',tag:'科幻',desc:'夜之城霓虹',worldDesc:'2077年企业控制的反乌托邦。人体改造发达。',worldType:'科幻',conflict:'自由与控制。'},
{id:'got',emoji:'🐉',name:'权力的游戏',tag:'奇幻',desc:'王座争夺',worldDesc:'维斯特洛七大王国争夺铁王座。北方异鬼威胁。',worldType:'奇幻',conflict:'权力与道德。'},
{id:'westworld',emoji:'🎭',name:'西部世界',tag:'科幻',desc:'意识觉醒',worldDesc:'西部主题乐园，AI接待员产生自我意识。',worldType:'科幻',conflict:'觉醒与控制。'}
]};