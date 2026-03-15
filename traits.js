// ===== traits.js - 人物特质系统 =====
// 特质影响骰子、选项、NPC反应、随机事件
const TraitSystem = {
  // 特质库：分正面/负面/中性，每个有具体的机制效果
  TRAITS: {
    // 正面特质
    brave:     {name:'勇敢',icon:'🦁',type:'positive',desc:'面对危险时不退缩',effects:{combat:1,endure:1,flee:-1},eventMod:'danger_bonus'},
    clever:    {name:'机敏',icon:'🦊',type:'positive',desc:'善于发现隐藏的线索',effects:{investigate:2,puzzle:1},eventMod:'clue_bonus'},
    charming:  {name:'魅力四射',icon:'✨',type:'positive',desc:'天生讨人喜欢',effects:{persuade:2,social:1},eventMod:'social_bonus'},
    lucky:     {name:'幸运儿',icon:'🍀',type:'positive',desc:'总能逢凶化吉',effects:{luck:3},eventMod:'lucky_bonus'},
    tough:     {name:'坚韧',icon:'🪨',type:'positive',desc:'能承受常人无法忍受的痛苦',effects:{endure:2,resist:1},hpBonus:20},
    stealthy:  {name:'隐匿者',icon:'🌑',type:'positive',desc:'擅长不被发现',effects:{stealth:3},eventMod:'stealth_bonus'},
    healer:    {name:'医者',icon:'💊',type:'positive',desc:'懂得基本的治疗术',effects:{},hpRegen:3},
    scholar:   {name:'博学',icon:'📚',type:'positive',desc:'拥有广博的知识',effects:{investigate:1,puzzle:2},eventMod:'knowledge_bonus'},
    leader:    {name:'领袖气质',icon:'👑',type:'positive',desc:'天生的指挥者',effects:{persuade:1,social:2},repBonus:1},
    quickdraw: {name:'快手',icon:'⚡',type:'positive',desc:'反应速度极快',effects:{dodge:2,combat:1},eventMod:'speed_bonus'},

    // 负面特质
    coward:    {name:'胆小',icon:'😰',type:'negative',desc:'容易在压力下崩溃',effects:{combat:-1,endure:-1},eventMod:'fear_penalty'},
    greedy:    {name:'贪婪',icon:'💎',type:'negative',desc:'难以抵抗财富的诱惑',effects:{},eventMod:'greed_trap'},
    reckless:  {name:'鲁莽',icon:'💥',type:'negative',desc:'行动前不考虑后果',effects:{dodge:-2},eventMod:'reckless_penalty'},
    paranoid:  {name:'多疑',icon:'👁️',type:'negative',desc:'难以信任任何人',effects:{social:-2,persuade:-1},eventMod:'trust_penalty'},
    frail:     {name:'体弱',icon:'🩹',type:'negative',desc:'身体素质较差',effects:{endure:-2,combat:-1},hpBonus:-15},
    cursed:    {name:'被诅咒',icon:'💀',type:'negative',desc:'厄运似乎总是如影随形',effects:{luck:-3},eventMod:'curse_penalty'},
    hothead:   {name:'暴躁',icon:'🔥',type:'negative',desc:'容易被激怒失去理智',effects:{social:-1},eventMod:'anger_trigger'},
    wanted:    {name:'被通缉',icon:'📜',type:'negative',desc:'有人在追捕你',effects:{stealth:-1},eventMod:'wanted_event'},

    // 中性特质
    loner:     {name:'独行者',icon:'🐺',type:'neutral',desc:'习惯独自行动',effects:{stealth:1,social:-1}},
    dreamer:   {name:'空想家',icon:'💭',type:'neutral',desc:'经常沉浸在幻想中',effects:{investigate:-1,puzzle:1}},
    merchant:  {name:'商人嗅觉',icon:'🏪',type:'neutral',desc:'对交易有天生的直觉',effects:{},goldBonus:2},
    noble:     {name:'贵族血统',icon:'🏰',type:'neutral',desc:'出身高贵但也引人注目',effects:{social:1,stealth:-1},repBonus:2},
    scarred:   {name:'伤痕累累',icon:'⚔️',type:'neutral',desc:'过去的战斗留下了印记',effects:{combat:1,charming:-1}},
    mystic:    {name:'通灵体质',icon:'🔮',type:'neutral',desc:'能感知到常人感知不到的事物',effects:{investigate:1},eventMod:'mystic_sense'},
  },

  // 获取角色的所有特质
  getTraits(agent) {
    return (agent._traits || []).map(id => ({id, ...this.TRAITS[id]})).filter(t => t.name);
  },

  // 初始化角色特质（根据背景自动分配1正面+1中性，可能1负面）
  autoAssign(agent) {
    const bg = `${agent.background||''} ${agent.personality||''} ${agent.role||''}`.toLowerCase();
    const traits = [];

    // 根据关键词匹配
    const matches = {
      brave: /勇|brave|无畏|战士|骑士/i, clever: /聪|clever|机敏|侦探|学者/i,
      charming: /魅|charm|美|迷人|贵族/i, lucky: /幸运|lucky|福星/i,
      tough: /坚|tough|强壮|铁|耐/i, stealthy: /隐|stealth|暗|盗贼|刺客/i,
      healer: /医|heal|治|药/i, scholar: /学|scholar|博|知识/i,
      leader: /领|leader|王|将|统帅/i, quickdraw: /快|quick|敏捷|闪/i,
      coward: /胆小|coward|懦/i, greedy: /贪|greed|财/i,
      reckless: /鲁莽|reckless|冲动/i, paranoid: /疑|paranoid|不信任/i,
      frail: /弱|frail|病/i, loner: /独|lone|孤/i,
      merchant: /商|merchant|交易/i, noble: /贵族|noble|皇|王子|公主/i,
      scarred: /伤|scar|老兵|战痕/i, mystic: /灵|mystic|魔|巫|通灵/i,
    };

    for (const [id, re] of Object.entries(matches)) {
      if (re.test(bg)) traits.push(id);
    }

    // 确保至少1正面+1中性/负面
    if (!traits.length) {
      const positives = Object.keys(this.TRAITS).filter(k => this.TRAITS[k].type === 'positive');
      traits.push(positives[Math.floor(Math.random() * positives.length)]);
    }
    const hasNeg = traits.some(t => this.TRAITS[t]?.type === 'negative');
    if (!hasNeg && Math.random() < 0.4) {
      const negatives = Object.keys(this.TRAITS).filter(k => this.TRAITS[k].type === 'negative');
      traits.push(negatives[Math.floor(Math.random() * negatives.length)]);
    }

    // 最多3个特质
    agent._traits = [...new Set(traits)].slice(0, 3);
    // 应用HP加成
    agent._traits.forEach(id => {
      const t = this.TRAITS[id];
      if (t?.hpBonus) { agent.status.hp += t.hpBonus; ResourceSystem?.modify({ hp: t.hpBonus }); }
    });
    return agent._traits;
  },

  // 获取特质对骰子的总加成
  getDiceMod(agent, checkType) {
    let mod = 0;
    (agent._traits || []).forEach(id => {
      const t = this.TRAITS[id];
      if (t?.effects?.[checkType]) mod += t.effects[checkType];
    });
    return mod;
  },

  // 获取特质的prompt描述
  getPromptDesc(agent) {
    const traits = this.getTraits(agent);
    if (!traits.length) return '';
    return '特质:' + traits.map(t => `${t.icon}${t.name}(${t.desc})`).join('、');
  },

  // 渲染特质标签HTML
  renderTags(agent) {
    const traits = this.getTraits(agent);
    if (!traits.length) return '';
    return '<div class="trait-tags">' + traits.map(t => {
      const cls = t.type === 'positive' ? 'trait-pos' : t.type === 'negative' ? 'trait-neg' : 'trait-neu';
      return `<span class="trait-tag ${cls}" title="${t.desc}">${t.icon}${t.name}</span>`;
    }).join('') + '</div>';
  }
};