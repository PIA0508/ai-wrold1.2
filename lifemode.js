// ===== lifemode.js - 人生模式引擎 =====
const LifeMode = {
  _active: false,
  _age: 0,
  _phase: 'childhood',
  _deathAge: 0,
  _turn: 0,
  _maxTurns: 30,
  _stats: { health: 80, wealth: 30, happiness: 60, fame: 0 },
  _milestones: [],
  _relationships: [], // {name, type, met_age, status}
  _career: '',
  _birthplace: '',
  _talent: '',
  _family: '',

  PHASES: {
    childhood:  { range: [0, 12],  label: '童年', icon: '💒', yearsPerTurn: 3, color: '#5cfcb6' },
    teen:       { range: [13, 18], label: '少年', icon: '🌱', yearsPerTurn: 2, color: '#7c5cfc' },
    youth:      { range: [19, 30], label: '青年', icon: '🔥', yearsPerTurn: 2, color: '#ffc857' },
    prime:      { range: [31, 50], label: '壮年', icon: '⭐', yearsPerTurn: 3, color: '#ff6b9d' },
    middle:     { range: [51, 65], label: '中年', icon: '🍂', yearsPerTurn: 3, color: '#a08cb0' },
    elder:      { range: [66, 99], label: '暮年', icon: '🌅', yearsPerTurn: 2, color: '#68647a' }
  },

  // 人生事件池（按阶段分类）
  EVENTS: {
    childhood: [
      '你在学校交到了一个好朋友','你第一次被老师表扬','你摔断了胳膊','你发现了一个秘密基地',
      '你的宠物走丢了','你在比赛中获奖','你被同学欺负','你搬了一次家','你第一次看到了死亡'
    ],
    teen: [
      '你经历了初恋','你在考试中作弊被发现','你加入了一个社团','你和父母大吵一架',
      '你遇到了改变你一生的老师','你第一次喝醉','你目睹了一场不公','你做了一个重要的承诺'
    ],
    youth: [
      '你找到了第一份工作','你失恋了','你遇到了一生的挚友','你做了一个冒险的投资',
      '你搬到了一座新城市','你收到了一个意想不到的机会','你失去了一个亲人','你结婚了',
      '你被解雇了','你创业了','你出国了','你遇到了你的宿敌'
    ],
    prime: [
      '你的孩子出生了','你升职了','你经历了一场大病','你买了房子',
      '你和伴侣关系出现裂痕','你在行业中崭露头角','你遭遇了背叛','你做了一个改变命运的决定',
      '你帮助了一个陌生人，多年后他回报了你','你的秘密被揭露了'
    ],
    middle: [
      '你的孩子离开了家','你开始反思人生','你的身体发出了警告','你重遇了年少时的朋友',
      '你获得了一项荣誉','你经历了中年危机','你原谅了一个曾经恨过的人','你开始了新的爱好'
    ],
    elder: [
      '你写了一封给后人的信','你回到了出生的地方','你和老友重逢','你的身体越来越差',
      '你把毕生所学传给了年轻人','你终于放下了心中的执念','你看到了自己的影响力','你做了最后的告别'
    ]
  },

  init() {
    this._active = false; this._age = 0; this._turn = 0;
    this._stats = { health: 80, wealth: 30, happiness: 60, fame: 0 };
    this._milestones = []; this._relationships = [];
    this._career = ''; this._phase = 'childhood';
    this._deathAge = 65 + Math.floor(Math.random() * 30); // 65-95随机寿命
  },

  isActive() { return this._active; },

  start(birthplace, family, talent) {
    this.init();
    this._active = true;
    this._birthplace = birthplace || '小镇';
    this._family = family || '普通';
    this._talent = talent || '无';
    // 家境影响初始数值
    const familyMod = { '贫困': { wealth: -20, happiness: -10 }, '普通': {}, '富裕': { wealth: 30, happiness: 10 }, '权贵': { wealth: 50, fame: 20, happiness: -5 } };
    const mod = familyMod[family] || {};
    Object.entries(mod).forEach(([k, v]) => { this._stats[k] = Math.max(0, Math.min(100, this._stats[k] + v)); });
    // 天赋影响
    const talentMod = { '聪慧': { fame: 5 }, '强壮': { health: 15 }, '美貌': { happiness: 10, fame: 5 }, '幸运': { wealth: 10, happiness: 10 }, '艺术': { happiness: 15 }, '领导力': { fame: 15 } };
    const tmod = talentMod[talent] || {};
    Object.entries(tmod).forEach(([k, v]) => { this._stats[k] = Math.max(0, Math.min(100, this._stats[k] + v)); });
  },

  // 获取当前人生阶段
  getPhase() {
    for (const [key, p] of Object.entries(this.PHASES)) {
      if (this._age >= p.range[0] && this._age <= p.range[1]) return { key, ...p };
    }
    return { key: 'elder', ...this.PHASES.elder };
  },

  // 推进一个回合（几年）
  advanceTurn() {
    const phase = this.getPhase();
    this._age += phase.yearsPerTurn;
    this._turn++;
    this._phase = phase.key;
    // 自然衰老
    if (this._age > 40) this._stats.health = Math.max(0, this._stats.health - Math.floor((this._age - 40) / 10) * 3);
    if (this._age > 60) this._stats.health = Math.max(0, this._stats.health - 5);
    // 检查死亡
    if (this._age >= this._deathAge || this._stats.health <= 0) return 'death';
    return phase.key;
  },

  // 获取随机事件
  getRandomEvent() {
    const phase = this.getPhase();
    const pool = this.EVENTS[phase.key] || this.EVENTS.youth;
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // 记录里程碑
  addMilestone(text) {
    this._milestones.push({ age: this._age, phase: this._phase, text, turn: this._turn });
  },

  // 修改数值
  modifyStats(changes) {
    const deltas = [];
    for (const [k, v] of Object.entries(changes)) {
      if (this._stats[k] === undefined) continue;
      const old = this._stats[k];
      this._stats[k] = Math.max(0, Math.min(100, old + v));
      const actual = this._stats[k] - old;
      if (actual !== 0) deltas.push({ key: k, delta: actual });
    }
    return deltas;
  },

  // 生成人生模式的prompt
  buildPrompt() {
    const phase = this.getPhase();
    const pc = AgentSystem.getAgent(GameEngine._playerCharacterId);
    const recentMilestones = this._milestones.slice(-5).map(m => `${m.age}岁:${m.text}`).join('；');
    return `你是人生模拟器的叙事者。用第二人称"你"快节奏讲述一个人的一生。

[主角] ${pc?.name||'主角'}，${this._age}岁，${phase.icon}${phase.label}期
出生:${this._birthplace}|家境:${this._family}|天赋:${this._talent}|职业:${this._career||'未定'}
健康:${this._stats.health} 财富:${this._stats.wealth} 幸福:${this._stats.happiness} 名望:${this._stats.fame}
${this._relationships.length ? '重要关系:' + this._relationships.slice(-5).map(r => r.name + '(' + r.type + ')').join('、') : ''}
${recentMilestones ? '近期:' + recentMilestones : ''}

[世界] ${GameEngine._world?.description?.substring(0, 80) || ''}

[风格] 快进叙事。用"那一年""几个月后""不知不觉"等时间跳跃。
80-150字概括这${phase.yearsPerTurn}年的变化。只在关键时刻（初恋、生死、转折）展开到200字。
语气随年龄变化：童年天真、少年躁动、青年热血、壮年沉稳、中年感慨、暮年平静。

[格式] 先写叙事，然后[META]块：
[META]
STATS:health:+/-值
STATS:wealth:+/-值
STATS:happiness:+/-值
STATS:fame:+/-值
MILESTONE:里程碑事件
RELATIONSHIP:名字:类型(朋友/恋人/对手/家人/导师)
CAREER:职业名
[/META]

[规则] 不出现"玩家"|用"你"|每段必须有时间流逝感|${this._age > 60 ? '暮年叙事要有回顾和释然感' : ''}`
  },

  // 生成人生选项的prompt
  buildChoicePrompt(event) {
    const phase = this.getPhase();
    const pc = AgentSystem.getAgent(GameEngine._playerCharacterId);
    return `${pc?.name}，${this._age}岁，${phase.label}期。
刚发生：${event}
健康${this._stats.health} 财富${this._stats.wealth} 幸福${this._stats.happiness} 名望${this._stats.fame}
${this._career ? '职业:' + this._career : ''}

生成3个人生选择。要求：
- 每个是一个人生决定，不是小动作
- 对应不同的人生态度（进取/保守/另辟蹊径）
- 10-20字，不加解释
- 符合当前年龄段的选择范围
返回JSON：{"choices":["","",""]}`
  },

  // 解析META中的人生数据
  parseMeta(lines) {
    lines.forEach(line => {
      const sm = line.match(/^STATS:(\w+):([+-]?\d+)$/);
      if (sm) { this.modifyStats({ [sm[1]]: parseInt(sm[2]) }); return; }
      const mm = line.match(/^MILESTONE:(.+)$/);
      if (mm) { this.addMilestone(mm[1].trim()); return; }
      const rm = line.match(/^RELATIONSHIP:([^:]+):(.+)$/);
      if (rm) {
        const existing = this._relationships.find(r => r.name === rm[1].trim());
        if (existing) existing.type = rm[2].trim();
        else this._relationships.push({ name: rm[1].trim(), type: rm[2].trim(), met_age: this._age, status: 'active' });
        return;
      }
      const cm = line.match(/^CAREER:(.+)$/);
      if (cm) this._career = cm[1].trim();
    });
  },

  // 生成死亡/结局总结prompt
  buildEpiloguePrompt() {
    const pc = AgentSystem.getAgent(GameEngine._playerCharacterId);
    const milestoneStr = this._milestones.map(m => `${m.age}岁:${m.text}`).join('\n');
    const relStr = this._relationships.map(r => `${r.name}(${r.type},${r.met_age}岁相识)`).join('、');
    return `${pc?.name}的一生结束了。享年${this._age}岁。

人生轨迹：
${milestoneStr || '平淡的一生'}
重要关系：${relStr || '孤独一生'}
职业：${this._career || '无固定职业'}
最终数值：健康${this._stats.health} 财富${this._stats.wealth} 幸福${this._stats.happiness} 名望${this._stats.fame}

请写一段200-300字的人生总结，包含：
1. 用"你"的视角回顾这一生的关键时刻
2. 这个人最终成为了什么样的人
3. 留下了什么，遗憾了什么
4. 最后一句话作为墓志铭（用「」包裹）

语气：温暖而克制，像秋天的最后一缕阳光。`
  },

  // 渲染人生状态栏
  renderStatusBar() {
    const phase = this.getPhase();
    const s = this._stats;
    const lifePct = Math.min(100, Math.round((this._age / this._deathAge) * 100));
    return `<div class="life-status">
      <div class="life-header">
        <span class="life-phase" style="color:${phase.color}">${phase.icon} ${phase.label}</span>
        <span class="life-age">${this._age}岁</span>
        <span class="life-turn">第${this._turn}回合</span>
      </div>
      <div class="life-bar-row"><span class="life-bar-label">⏳人生</span><div class="life-bar"><div class="life-bar-fill" style="width:${lifePct}%;background:linear-gradient(90deg,${phase.color},#68647a)"></div></div></div>
      <div class="life-stats">
        <span class="life-stat" title="健康">❤️${s.health}</span>
        <span class="life-stat" title="财富">💰${s.wealth}</span>
        <span class="life-stat" title="幸福">😊${s.happiness}</span>
        <span class="life-stat" title="名望">⭐${s.fame}</span>
      </div>
      ${this._career ? `<div class="life-career">💼 ${this._career}</div>` : ''}
    </div>`;
  },

  // 渲染人生时间线（里程碑）
  renderTimeline() {
    if (!this._milestones.length) return '<p style="text-align:center;color:var(--tx2);padding:16px;font-size:10px">人生刚刚开始...</p>';
    return '<div class="life-timeline">' + this._milestones.map(m => {
      const p = Object.values(this.PHASES).find(p => m.age >= p.range[0] && m.age <= p.range[1]) || this.PHASES.youth;
      return `<div class="lt-item"><div class="lt-dot" style="background:${p.color}"></div><div class="lt-content"><span class="lt-age">${m.age}岁</span> ${m.text}</div></div>`;
    }).join('') + '</div>';
  }
};