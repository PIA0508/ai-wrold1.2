// ===== resources.js - 资源与属性成长系统 =====
const ResourceSystem = {
  _resources: { hp: 100, maxHp: 100, gold: 0, reputation: 0, fatigue: 0 },
  _history: [], // 变化历史

  init(startGold) {
    this._resources = { hp: 100, maxHp: 100, gold: startGold || 10, reputation: 0, fatigue: 0 };
    this._history = [];
  },

  get(key) { return this._resources[key] },
  getAll() { return { ...this._resources } },

  // 修改资源，返回变化描述
  modify(changes) {
    const deltas = [];
    for (const [k, v] of Object.entries(changes)) {
      if (this._resources[k] === undefined) continue;
      const old = this._resources[k];
      if (k === 'hp') this._resources[k] = Math.max(0, Math.min(this._resources.maxHp, old + v));
      else if (k === 'fatigue') this._resources[k] = Math.max(0, Math.min(100, old + v));
      else this._resources[k] = old + v;
      const actual = this._resources[k] - old;
      if (actual !== 0) deltas.push({ key: k, delta: actual, now: this._resources[k] });
    }
    if (deltas.length) {
      this._history.push({ deltas, turn: MemorySystem?.getTurnCount() || 0, time: Date.now() });
      if (this._history.length > 50) this._history = this._history.slice(-50);
    }
    return deltas;
  },

  // 从AI文本中提取资源变化 [RES:hp:-10] [RES:gold:+5]
  parseFromText(text) {
    const changes = {};
    const matches = [...text.matchAll(/\[RES:(\w+):([+-]?\d+)\]/g)];
    matches.forEach(m => { changes[m[1]] = parseInt(m[2]) });
    // 也从META块解析
    const metaMatch = text.match(/\[META\]([\s\S]*?)(\[\/META\]|$)/);
    if (metaMatch) {
      const lines = metaMatch[1].split('\n');
      lines.forEach(l => {
        const rm = l.trim().match(/^RES:(\w+):([+-]?\d+)$/);
        if (rm) changes[rm[1]] = parseInt(rm[2]);
      });
    }
    if (Object.keys(changes).length) return this.modify(changes);
    return [];
  },

  // 回合结束时的自然消耗
  turnDecay() {
    const changes = {};
    // 疲劳自然恢复
    if (this._resources.fatigue > 0) changes.fatigue = -5;
    // 高疲劳扣HP
    if (this._resources.fatigue > 70) changes.hp = -3;
    if (Object.keys(changes).length) return this.modify(changes);
    return [];
  },

  // 格式化变化为行内HTML
  formatDeltas(deltas) {
    if (!deltas.length) return '';
    const icons = { hp: '❤️', gold: '💰', reputation: '⭐', fatigue: '😓' };
    const names = { hp: '生命', gold: '金币', reputation: '声望', fatigue: '疲劳' };
    return '<div class="res-change">' + deltas.map(d => {
      const color = d.delta > 0 ? (d.key === 'fatigue' ? 'var(--no)' : 'var(--ok)') : (d.key === 'fatigue' ? 'var(--ok)' : 'var(--no)');
      return `<span class="res-delta" style="color:${color}">${icons[d.key] || ''}${d.delta > 0 ? '+' : ''}${d.delta}</span>`;
    }).join(' ') + '</div>';
  },

  // 顶栏显示
  renderTopbar() {
    const r = this._resources;
    const hpPct = Math.round((r.hp / r.maxHp) * 100);
    const hpColor = hpPct > 60 ? 'var(--ok)' : hpPct > 30 ? 'var(--wn)' : 'var(--no)';
    return `<div class="res-bar">
      <span class="res-item" title="生命${r.hp}/${r.maxHp}"><span class="res-hp-bar"><span class="res-hp-fill" style="width:${hpPct}%;background:${hpColor}"></span></span>❤️${r.hp}</span>
      <span class="res-item" title="金币">💰${r.gold}</span>
      <span class="res-item" title="声望">⭐${r.reputation}</span>
      ${r.fatigue > 30 ? `<span class="res-item" title="疲劳${r.fatigue}%" style="color:var(--wn)">😓${r.fatigue}%</span>` : ''}
    </div>`;
  },

  // prompt描述
  getPromptDesc() {
    const r = this._resources;
    return `[资源] HP:${r.hp}/${r.maxHp} 金币:${r.gold} 声望:${r.reputation} 疲劳:${r.fatigue}%`;
  },

  // 随机事件库
  RANDOM_EVENTS: [
    { trigger: () => Math.random() < 0.15, text: '你在路边发现了几枚散落的硬币。', changes: { gold: 3 }, type: 'lucky' },
    { trigger: () => Math.random() < 0.1, text: '一阵突如其来的头晕让你不得不靠墙休息片刻。', changes: { fatigue: 15 }, type: 'bad' },
    { trigger: (r) => r.fatigue > 60 && Math.random() < 0.2, text: '过度的疲劳让你的身体发出了警告。', changes: { hp: -5, fatigue: -10 }, type: 'bad' },
    { trigger: () => Math.random() < 0.08, text: '一个路过的旅人对你点头致意，似乎认出了你。', changes: { reputation: 2 }, type: 'neutral' },
    { trigger: (r) => r.reputation > 20 && Math.random() < 0.12, text: '你的名声为你赢得了一份意外的馈赠。', changes: { gold: 8 }, type: 'lucky' },
    { trigger: (r) => r.hp < 40 && Math.random() < 0.15, text: '伤口隐隐作痛，你需要尽快找到治疗的办法。', changes: { fatigue: 10 }, type: 'bad' },
    { trigger: () => Math.random() < 0.06, text: '你无意中听到了一段有价值的对话。', changes: { reputation: 1 }, type: 'lucky' },
    { trigger: (r) => r.gold > 30 && Math.random() < 0.08, text: '一个小偷趁你不注意摸走了一些钱。', changes: { gold: -5 }, type: 'bad' },
  ],

  // 检查并触发随机事件
  checkRandomEvent() {
    const r = this._resources;
    const shuffled = [...this.RANDOM_EVENTS].sort(() => Math.random() - 0.5);
    for (const evt of shuffled) {
      if (evt.trigger(r)) {
        const deltas = this.modify(evt.changes);
        return { text: evt.text, deltas, type: evt.type };
      }
    }
    return null;
  }
};