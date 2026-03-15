// ===== butterfly.js - 蝴蝶效应追溯系统 =====
// 记录每个选择，当重大事件发生时回溯因果链
const ButterflySystem = {
  _choices: [],      // 所有选择记录 { id, turn, text, chapter, context, consequences: [] }
  _chains: [],       // 已确认的因果链 [{ trigger, steps: [{choiceId, desc}], finalEvent }]
  _majorEvents: [],  // 重大事件

  init() { this._choices = []; this._chains = []; this._majorEvents = []; },

  // 记录一次选择
  recordChoice(text, context) {
    const choice = {
      id: 'ch_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3),
      turn: MemorySystem.getTurnCount(),
      text: text.substring(0, 60),
      chapter: GameEngine._currentChapter,
      context: (context || '').substring(0, 80), // 当时的情境摘要
      consequences: [],  // 后续被追溯到的后果
      timestamp: Date.now()
    };
    this._choices.push(choice);
    if (this._choices.length > 50) this._choices = this._choices.slice(-50);
    return choice.id;
  },

  // 记录重大事件（由AI标记或引擎检测）
  recordMajorEvent(eventDesc, relatedChoiceHint) {
    const evt = {
      id: 'evt_' + Date.now(),
      desc: eventDesc.substring(0, 100),
      turn: MemorySystem.getTurnCount(),
      chapter: GameEngine._currentChapter,
      timestamp: Date.now()
    };
    this._majorEvents.push(evt);
    if (this._majorEvents.length > 20) this._majorEvents = this._majorEvents.slice(-20);

    // 尝试自动回溯因果链
    this._traceChain(evt, relatedChoiceHint);
    return evt;
  },

  // 回溯因果链：从重大事件往回找相关选择
  _traceChain(event, hint) {
    if (!this._choices.length) return;

    // 关键词匹配：从事件描述中提取关键词，与过去选择匹配
    const eventWords = this._extractKeywords(event.desc);
    const hintWords = hint ? this._extractKeywords(hint) : [];
    const allWords = [...new Set([...eventWords, ...hintWords])];

    // 按相关度排序过去的选择
    const scored = this._choices.map(ch => {
      const choiceWords = this._extractKeywords(ch.text + ' ' + ch.context);
      const overlap = allWords.filter(w => choiceWords.includes(w)).length;
      // 时间距离越远，蝴蝶效应越戏剧化（加分）
      const timeDist = Math.min(10, event.turn - ch.turn);
      const score = overlap * 3 + (timeDist > 2 ? timeDist * 0.5 : 0);
      return { choice: ch, score };
    }).filter(s => s.score > 1).sort((a, b) => b.score - a.score);

    if (!scored.length) return;

    // 取最相关的1-3个选择构建因果链
    const chainSteps = scored.slice(0, 3).map(s => ({
      choiceId: s.choice.id,
      choiceText: s.choice.text,
      choiceTurn: s.choice.turn,
      chapter: s.choice.chapter
    }));

    const chain = {
      id: 'bf_' + Date.now(),
      trigger: chainSteps[0],
      steps: chainSteps,
      finalEvent: event.desc,
      finalTurn: event.turn,
      timestamp: Date.now()
    };

    this._chains.push(chain);
    if (this._chains.length > 15) this._chains = this._chains.slice(-15);

    // 标记相关选择的后果
    chainSteps.forEach(step => {
      const ch = this._choices.find(c => c.id === step.choiceId);
      if (ch) ch.consequences.push(event.desc);
    });

    // 显示蝴蝶效应动画
    UI.showButterflyEffect(chain);
  },

  _extractKeywords(text) {
    if (!text) return [];
    // 移除标点和常见虚词，提取有意义的词
    const cleaned = text.replace(/[「」（）\[\]，。！？、：；""''…—\s]/g, ' ');
    const stopWords = new Set(['的','了','在','是','和','与','对','向','从','到','把','被','让','给','也','都','就','又','还','很','不','没','有','这','那','他','她','它','我','你','们','着','过','会','能','要','可以','已经','正在']);
    return cleaned.split(/\s+/).filter(w => w.length >= 2 && !stopWords.has(w));
  },

  // 从AI文本中检测重大事件
  detectMajorEvents(text) {
    const patterns = [
      { re: /死亡|牺牲|殒命|阵亡/g, type: '死亡' },
      { re: /背叛|出卖|反水/g, type: '背叛' },
      { re: /结盟|联手|同盟/g, type: '结盟' },
      { re: /发现了?[^，。]{2,8}(?:秘密|真相|线索)/g, type: '发现' },
      { re: /战争|开战|宣战|进攻/g, type: '战争' },
      { re: /逃离|逃脱|逃出/g, type: '逃脱' },
      { re: /觉醒|突破|进化|升级/g, type: '觉醒' },
      { re: /毁灭|崩塌|陷落|沦陷/g, type: '毁灭' }
    ];
    patterns.forEach(p => {
      const matches = text.match(p.re);
      if (matches) {
        matches.forEach(m => {
          // 提取周围上下文
          const idx = text.indexOf(m);
          const ctx = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + m.length + 20));
          this.recordMajorEvent(ctx.replace(/\[.*?\]/g, '').trim(), m);
        });
      }
    });
  },

  // 获取所有因果链（用于章节结算展示）
  getChains() { return [...this._chains]; },
  getChoices() { return [...this._choices]; },

  // 生成蝴蝶效应的prompt提示（让AI意识到过去的选择）
  getPromptHint() {
    if (!this._choices.length) return '';
    const recent = this._choices.slice(-5);
    return '\n【近期关键选择（可能产生蝴蝶效应）】\n' +
      recent.map(c => `回合${c.turn}:「${c.text}」`).join('\n') +
      '\n（如果当前事件与这些选择有因果关系，请在叙事中自然地体现因果联系）\n';
  },

  // 格式化因果链为HTML
  formatChainHTML(chain) {
    let html = '<div class="butterfly-chain">';
    html += '<div class="bf-header">🦋 蝴蝶效应</div>';
    chain.steps.forEach((step, i) => {
      html += `<div class="bf-step">
        <div class="bf-dot ${i === 0 ? 'origin' : ''}"></div>
        <div class="bf-content">
          <div class="bf-turn">回合${step.choiceTurn} · ${step.chapter}</div>
          <div class="bf-text">「${step.choiceText}」</div>
        </div>
      </div>`;
      if (i < chain.steps.length - 1) html += '<div class="bf-arrow">↓</div>';
    });
    html += '<div class="bf-arrow">⟱</div>';
    html += `<div class="bf-result"><div class="bf-dot result"></div><div class="bf-content"><div class="bf-text bf-final">${chain.finalEvent}</div></div></div>`;
    html += '</div>';
    return html;
  }
};