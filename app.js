(function(){'use strict';document.addEventListener('DOMContentLoaded',()=>{
UI.initChips();UI.initParticles();UI.checkApiStatus();UI.renderPopularWorlds();Config.load();
// 检查存档
if(SaveSystem.hasSave()){document.getElementById('btnLoadSave').style.display='inline-block'}
document.getElementById('playerInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();GameEngine.sendPlayerAction()}});
document.querySelectorAll('.modal').forEach(m=>{m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')})});
document.body.addEventListener('touchmove',e=>{if(!e.target.closest('.screen-body,.story-flow,.sidebar-body,.modal-body,.choice-body'))e.preventDefault()},{passive:false});
console.log('✅ 无限叙事 v3.0 - 全修复版')});
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);UI.hideLoading();UI.hideTyping();UI.showContinueButton()})})();