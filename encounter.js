// ===== encounter.js - 遭遇状态栏系统 =====
// 战斗/辩论/博弈时显示详细状态面板
const EncounterSystem = {
  _active: false,
  _type: null, // 'combat' | 'debate' | 'gambit'
  _data: null,
  _turnLimit: 0,
  _turnUsed: 0,

  // 遭遇类型定义
  TYPES: {
    combat: { icon: '⚔️', label: '战斗', color: 'var(--no)' },
    debate: { icon: '🗣️', label: '辩论', color: 'var(--ac)' },
    gambit: { icon: '♟️', label: '博弈', color: 'var(--au)' }
  },

  init() { this._active = false; this._type = null; this._data = null; this._turnLimit = 0; this._turnUsed = 0; },

  // 从叙事文本自动检测遭遇类型
  detectEncounter(text) {
    if (/战斗|攻击|拔剑|冲锋|射击|格挡|闪避|敌人.*袭|武器/i.test(text)) return 'combat';
    if (/辩论|反驳|论点|说服|质问|指控|证据|口供|审判|辩护/i.test(text)) return 'debate';
    if (/博弈|谈判|交易|筹码|条件|威胁|利益|赌|棋/i.test(text)) return 'gambit';
    return null;
  },

  // 开始遭遇
  start(type, data = {}) {
    this._active = true;
    this._type = type;
    this._turnLimit = data.turnLimit || (type === 'combat' ? 6 : type === 'debate' ? 5 : 4);
    this._turnUsed = 0;
    this._data = {
      // 通用
      allies: data.allies || [],
      enemies: data.enemies || [],
      objective: data.objective || '',
      // 战斗专用
      weapons: data.weapons || [],
      skills: data.skills || [],
      items: data.items || [],
      terrain: data.terrain || '',
      // 辩论专用
      knownFacts: data.knownFacts || [],
      arguments: data.arguments || [],
      enemyPosition: data.enemyPosition || '',
      audience: data.audience || '',
      // 博弈专用
      stakes: data.stakes || '',
      leverage: data.leverage || [],
      opponentGoal: data.opponentGoal || ''
    };
    UI.showEncounterBar();
  },

  // 推进遭遇回合
  advanceTurn() {
    if (!this._active) return false;
    this._turnUsed++;
    UI.showEncounterBar();
    if (this._turnUsed >= this._turnLimit) {
      return true; // 回合耗尽，强制推进
    }
    return false;
  },

  // 结束遭遇
  end(result) {
    this._active = false;
    UI.hideEncounterBar();
    return result;
  },

  isActive() { return this._active; },
  getType() { return this._type; },
  getData() { return { ...this._data }; },
  getTurnsLeft() { return Math.max(0, this._turnLimit - this._turnUsed); },

  // 从AI的META块更新遭遇数据
  updateFromMeta(lines) {
    lines.forEach(line => {
      const m = line.match(/^ENCOUNTER:(\w+):(.+)$/);
      if (!m) return;
      const [, field, value] = m;
      if (field === 'weapon') this._data.weapons = [...new Set([...this._data.weapons, value.trim()])];
      if (field === 'skill') this._data.skills = [...new Set([...this._data.skills, value.trim()])];
      if (field === 'item') this._data.items = [...new Set([...this._data.items, value.trim()])];
      if (field === 'fact') this._data.knownFacts = [...new Set([...this._data.knownFacts, value.trim()])];
      if (field === 'argument') this._data.arguments.push(value.trim());
      if (field === 'leverage') this._data.leverage = [...new Set([...this._data.leverage, value.trim()])];
      if (field === 'enemy_pos') this._data.enemyPosition = value.trim();
      if (field === 'objective') this._data.objective = value.trim();
      if (field === 'terrain') this._data.terrain = value.trim();
    });
  },

  // 生成prompt描述
  getPromptDesc() {
    if (!this._active) return '';
    const d = this._data;
    const turnsLeft = this.getTurnsLeft();
    const t = this.TYPES[this._type] || {};

    let desc = `\n[${t.icon}${t.label}遭遇 - 剩余${turnsLeft}回合]\n目标:${d.objective||'未知'}\n`;

    if (this._type === 'combat') {
      desc += `地形:${d.terrain||'未知'}\n`;
      if (d.weapons.length) desc += `武器:${d.weapons.join('、')}\n`;
      if (d.skills.length) desc += `技能:${d.skills.join('、')}\n`;
      if (d.items.length) desc += `物品:${d.items.join('、')}\n`;
      if (d.allies.length) desc += `队友:${d.allies.join('、')}\n`;
      if (d.enemies.length) desc += `敌人:${d.enemies.join('、')}\n`;
      desc += `★剩${turnsLeft}回合，必须在回合内解决战斗。每回合推进战局变化。\n`;
    }
    else if (this._type === 'debate') {
      if (d.knownFacts.length) desc += `已知事实:${d.knownFacts.join('、')}\n`;
      if (d.arguments.length) desc += `已用论据:${d.arguments.slice(-3).join('、')}\n`;
      if (d.enemyPosition) desc += `对方立场:${d.enemyPosition}\n`;
      if (d.audience) desc += `听众:${d.audience}\n`;
      desc += `★剩${turnsLeft}回合辩论机会。每回合必须有新论点或新证据。\n`;
    }
    else if (this._type === 'gambit') {
      if (d.stakes) desc += `赌注:${d.stakes}\n`;
      if (d.leverage.length) desc += `筹码:${d.leverage.join('、')}\n`;
      if (d.opponentGoal) desc += `对方目的:${d.opponentGoal}\n`;
      desc += `★剩${turnsLeft}回合博弈。每回合局势必须变化。\n`;
    }
    return desc;
  },

  // 渲染遭遇状态栏HTML
  renderBar() {
    if (!this._active) return '';
    const d = this._data;
    const t = this.TYPES[this._type] || {};
    const left = this.getTurnsLeft();
    const pct = Math.round((left / this._turnLimit) * 100);
    const barColor = pct > 50 ? 'var(--ok)' : pct > 25 ? 'var(--wn)' : 'var(--no)';

    let html = `<div class="encounter-bar" style="border-color:${t.color}">`;
    html += `<div class="enc-header"><span class="enc-type" style="color:${t.color}">${t.icon} ${t.label}</span>`;
    html += `<span class="enc-turns"><span class="enc-turn-bar"><span class="enc-turn-fill" style="width:${pct}%;background:${barColor}"></span></span>${left}/${this._turnLimit}回合</span></div>`;

    if (d.objective) html += `<div class="enc-objective">🎯 ${d.objective}</div>`;

    if (this._type === 'combat') {
      html += '<div class="enc-grid">';
      if (d.weapons.length) html += `<div class="enc-section"><span class="enc-label">🗡️武器</span>${d.weapons.map(w => `<span class="enc-tag">${w}</span>`).join('')}</div>`;
      if (d.skills.length) html += `<div class="enc-section"><span class="enc-label">✨技能</span>${d.skills.map(s => `<span class="enc-tag">${s}</span>`).join('')}</div>`;
      if (d.items.length) html += `<div class="enc-section"><span class="enc-label">🎒物品</span>${d.items.map(i => `<span class="enc-tag">${i}</span>`).join('')}</div>`;
      if (d.allies.length) html += `<div class="enc-section"><span class="enc-label">🤝队友</span>${d.allies.map(a => `<span class="enc-tag ally">${a}</span>`).join('')}</div>`;
      if (d.enemies.length) html += `<div class="enc-section"><span class="enc-label">💀敌人</span>${d.enemies.map(e => `<span class="enc-tag enemy">${e}</span>`).join('')}</div>`;
      if (d.terrain) html += `<div class="enc-section"><span class="enc-label">🏔️地形</span><span class="enc-tag">${d.terrain}</span></div>`;
      html += '</div>';
    }
    else if (this._type === 'debate') {
      html += '<div class="enc-grid">';
      if (d.knownFacts.length) html += `<div class="enc-section"><span class="enc-label">📋事实</span>${d.knownFacts.map(f => `<span class="enc-tag">${f}</span>`).join('')}</div>`;
      if (d.arguments.length) html += `<div class="enc-section"><span class="enc-label">💬论据</span>${d.arguments.slice(-3).map(a => `<span class="enc-tag">${a}</span>`).join('')}</div>`;
      if (d.enemyPosition) html += `<div class="enc-section"><span class="enc-label">🎭对方</span><span class="enc-tag enemy">${d.enemyPosition}</span></div>`;
      html += '</div>';
    }
    else if (this._type === 'gambit') {
      html += '<div class="enc-grid">';
      if (d.stakes) html += `<div class="enc-section"><span class="enc-label">🎲赌注</span><span class="enc-tag">${d.stakes}</span></div>`;
      if (d.leverage.length) html += `<div class="enc-section"><span class="enc-label">♟️筹码</span>${d.leverage.map(l => `<span class="enc-tag">${l}</span>`).join('')}</div>`;
      if (d.opponentGoal) html += `<div class="enc-section"><span class="enc-label">🎯对方</span><span class="enc-tag enemy">${d.opponentGoal}</span></div>`;
      html += '</div>';
    }
    html += '</div>';
    return html;
  }
};