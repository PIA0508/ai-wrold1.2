// ===== lorebook.js - 世界词条系统（关键词触发注入） =====
const Lorebook = {
  _entries: [], // { id, keywords:[], content, category, priority, enabled, tokenCount }

  init() { this._entries = []; },

  // 从世界观数据自动生成词条
  buildFromWorld(world, characters) {
    this._entries = [];
    // 世界基础词条
    if (world.name) this.add({
      keywords: [world.name],
      content: `${world.name}：${world.description || ''}`,
      category: 'world', priority: 10
    });
    if (world.rules) this.add({
      keywords: ['规则', '法则', '魔法', '科技', '力量'],
      content: `世界规则：${world.rules}`,
      category: 'rules', priority: 8
    });
    // 势力词条
    (world.factions || []).forEach(f => {
      const name = typeof f === 'string' ? f : f.name;
      if (name) this.add({
        keywords: [name],
        content: `势力「${name}」：${typeof f === 'object' ? f.desc || '' : ''}`,
        category: 'faction', priority: 6
      });
    });
    // 地点词条
    (world.locations || []).forEach(l => {
      if (l.name) this.add({
        keywords: [l.name],
        content: `地点「${l.name}」：${l.desc || ''}（${l.type || ''}）`,
        category: 'location', priority: 5
      });
    });
    // 角色词条
    (characters || []).forEach(c => {
      if (c.name) this.add({
        keywords: [c.name],
        content: `${c.name}：${c.role || ''}。${c.personality || ''}。${(c.background || '').substring(0, 80)}`,
        category: 'character', priority: 7
      });
    });
    // NPC词条（从大纲）
    const outline = GameEngine._plotOutline;
    if (outline?.npcs) {
      outline.npcs.forEach(npc => {
        if (npc.name && !this._entries.find(e => e.keywords.includes(npc.name))) {
          this.add({
            keywords: [npc.name],
            content: `${npc.name}：${npc.role || ''}。动机：${npc.motivation || ''}。与主角：${npc.relation || ''}`,
            category: 'npc', priority: 5
          });
        }
      });
    }
  },

  add(entry) {
    this._entries.push({
      id: 'lb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
      keywords: entry.keywords || [],
      content: entry.content || '',
      category: entry.category || 'misc',
      priority: entry.priority || 5,
      enabled: true,
      tokenCount: Math.ceil((entry.content || '').length * 1.5)
    });
  },

  // ★ 核心：扫描文本，返回应注入的词条内容（按优先级，控制总token）
  scan(text, maxTokens = 800) {
    if (!text || !this._entries.length) return '';
    const triggered = [];
    this._entries.forEach(entry => {
      if (!entry.enabled) return;
      const hit = entry.keywords.some(kw => text.includes(kw));
      if (hit) triggered.push(entry);
    });
    if (!triggered.length) return '';
    // 按优先级排序，控制token预算
    triggered.sort((a, b) => b.priority - a.priority);
    let totalTokens = 0;
    const selected = [];
    for (const entry of triggered) {
      if (totalTokens + entry.tokenCount > maxTokens) continue;
      selected.push(entry);
      totalTokens += entry.tokenCount;
    }
    if (!selected.length) return '';
    return '\n[世界词条]\n' + selected.map(e => e.content).join('\n') + '\n';
  },

  // 获取所有词条（供UI展示）
  getAll() { return [...this._entries]; },

  // 手动开关词条
  toggle(id) {
    const e = this._entries.find(x => x.id === id);
    if (e) e.enabled = !e.enabled;
  },

  // 渲染词条列表HTML
  renderList() {
    if (!this._entries.length) return '<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">暂无词条</p>';
    const cats = { world: '🌍 世界', rules: '📜 规则', faction: '⚔️ 势力', location: '📍 地点', character: '👤 角色', npc: '👥 NPC', misc: '📝 其他' };
    const grouped = {};
    this._entries.forEach(e => {
      const cat = cats[e.category] || cats.misc;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(e);
    });
    let html = '';
    for (const [cat, entries] of Object.entries(grouped)) {
      html += `<div style="font-size:9px;color:var(--ac);padding:4px 0;font-weight:600">${cat}</div>`;
      entries.forEach(e => {
        html += `<div class="lore-entry ${e.enabled ? '' : 'disabled'}" onclick="Lorebook.toggle('${e.id}');UI.renderLorebook()">
          <div class="lore-keywords">${e.keywords.join(', ')}</div>
          <div class="lore-content">${e.content.substring(0, 60)}${e.content.length > 60 ? '...' : ''}</div>
          <span class="lore-toggle">${e.enabled ? '✓' : '✗'}</span>
        </div>`;
      });
    }
    return html;
  }
};