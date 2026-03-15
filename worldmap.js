// ===== worldmap.js - 世界地图系统 =====
const WorldMap = {
  _locations: {},  // { id: { name, desc, type, visited, current, connections, events } }
  _currentLocation: null,
  _visitHistory: [],

  init() { this._locations = {}; this._currentLocation = null; this._visitHistory = []; },

  addLocation(loc) {
    const id = loc.id || 'loc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 3);
    this._locations[id] = {
      id, name: loc.name, desc: loc.desc || '',
      type: loc.type || 'generic', // city, wilderness, dungeon, building, special
      icon: loc.icon || this._typeIcon(loc.type),
      visited: false, current: false,
      connections: loc.connections || [], // 连接的地点ID
      events: [], // 在此发生的事件
      characters: [], // 当前在此的角色
      discovered: loc.discovered !== false
    };
    return id;
  },

  _typeIcon(type) {
    const icons = { city:'🏙️', village:'🏘️', wilderness:'🌲', dungeon:'🏚️', building:'🏛️',
      castle:'🏰', tavern:'🍺', temple:'⛩️', port:'⚓', mountain:'⛰️', cave:'🕳️',
      forest:'🌳', desert:'🏜️', ocean:'🌊', special:'✨', generic:'📍' };
    return icons[type] || '📍';
  },

  setCurrentLocation(locId) {
    Object.values(this._locations).forEach(l => { l.current = false; });
    const loc = this._locations[locId];
    if (!loc) return;
    loc.current = true;
    loc.visited = true;
    this._currentLocation = locId;
    this._visitHistory.push({ locId, name: loc.name, time: Date.now() });
  },

  // 从文本中检测地点变化
  detectLocationChange(text) {
    const locs = Object.values(this._locations);
    for (const loc of locs) {
      if (text.includes(loc.name)) {
        if (loc.id !== this._currentLocation) {
          this.setCurrentLocation(loc.id);
          return loc;
        }
      }
    }
    return null;
  },

  // 从AI文本中发现新地点
  discoverLocation(name, desc, type) {
    const existing = Object.values(this._locations).find(l => l.name === name);
    if (existing) return existing.id;
    const id = this.addLocation({ name, desc, type, discovered: true });
    // 自动连接到当前位置
    if (this._currentLocation) {
      const cur = this._locations[this._currentLocation];
      if (cur && !cur.connections.includes(id)) {
        cur.connections.push(id);
        this._locations[id].connections.push(this._currentLocation);
      }
    }
    return id;
  },

  getCurrentLocation() {
    return this._currentLocation ? this._locations[this._currentLocation] : null;
  },

  getVisitedLocations() {
    return Object.values(this._locations).filter(l => l.visited);
  },

  getAllLocations() {
    return Object.values(this._locations).filter(l => l.discovered);
  },

  // 地图prompt描述
  getPromptDesc() {
    const cur = this.getCurrentLocation();
    if (!cur) return '';
    const nearby = cur.connections.map(cid => this._locations[cid]?.name).filter(Boolean);
    return `【地点】${cur.icon} ${cur.name}${cur.desc ? '：' + cur.desc : ''}${nearby.length ? '\n附近：' + nearby.join('、') : ''}`;
  },

  // 渲染地图HTML
  renderMap() {
    const visited = this.getVisitedLocations();
    const all = this.getAllLocations();
    if (!all.length) return '<p style="text-align:center;color:var(--tx2);padding:20px">尚未探索任何地点</p>';

    let html = '<div class="map-container">';
    // 当前位置
    const cur = this.getCurrentLocation();
    if (cur) {
      html += `<div class="map-current"><div class="map-loc-icon current">${cur.icon}</div>
        <div class="map-loc-info"><div class="map-loc-name">📍 ${cur.name}</div>
        <div class="map-loc-desc">${cur.desc || ''}</div></div></div>`;
    }
    // 已访问地点
    html += '<div class="map-section-title">已探索地点</div><div class="map-grid">';
    visited.forEach(loc => {
      const isCur = loc.id === this._currentLocation;
      html += `<div class="map-loc ${isCur ? 'is-current' : ''}">
        <span class="map-loc-icon">${loc.icon}</span>
        <span class="map-loc-label">${loc.name}</span>
        ${isCur ? '<span class="map-here">在这里</span>' : ''}
      </div>`;
    });
    html += '</div>';
    // 未访问但已发现
    const undiscovered = all.filter(l => !l.visited);
    if (undiscovered.length) {
      html += '<div class="map-section-title" style="color:var(--tx2)">已发现未探索</div><div class="map-grid">';
      undiscovered.forEach(loc => {
        html += `<div class="map-loc undiscovered"><span class="map-loc-icon">${loc.icon}</span><span class="map-loc-label">${loc.name}</span></div>`;
      });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }
};