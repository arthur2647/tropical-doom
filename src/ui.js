import { RECIPES } from './crafting.js';
import { ITEM_DEFS } from './items.js';

export class UIManager {
  constructor(game) {
    this.game = game;
    this.messages = [];
    this.damageFlashTimer = 0;
  }

  showHUD(visible) {
    const d = visible ? 'block' : 'none';
    document.getElementById('hud').style.display = visible ? 'flex' : 'none';
    document.getElementById('hud-top-left').style.display = d;
    document.getElementById('hud-top-right').style.display = d;
    document.getElementById('weapon-hud').style.display = d;
    document.getElementById('crosshair').style.display = d;
    document.getElementById('message-log').style.display = d;
  }

  update(dt) {
    const p = this.game.player;

    // Health bar
    const hpPct = (p.hp / p.maxHp * 100).toFixed(0);
    document.getElementById('hp-bar').style.width = hpPct + '%';
    document.getElementById('hp-val').textContent = Math.ceil(p.hp);

    // Stamina bar - changes color when low
    const staPct = (p.stamina / p.maxStamina * 100).toFixed(0);
    const staBar = document.getElementById('sta-bar');
    staBar.style.width = staPct + '%';
    document.getElementById('sta-val').textContent = Math.ceil(p.stamina);
    if (p.stamina < p.maxStamina * 0.1) {
      staBar.style.background = 'linear-gradient(90deg,#aa4400,#ff6633)';
    } else if (p.stamina < p.maxStamina * 0.3) {
      staBar.style.background = 'linear-gradient(90deg,#aaaa00,#ffff33)';
    } else {
      staBar.style.background = '';
    }

    // XP bar
    const xpPct = (p.xp / p.xpToLevel * 100).toFixed(0);
    document.getElementById('xp-bar').style.width = xpPct + '%';
    document.getElementById('xp-val').textContent = `${p.xp}/${p.xpToLevel}`;

    // Damage flash
    if (this.damageFlashTimer > 0) {
      this.damageFlashTimer -= dt;
      document.getElementById('damage-overlay').style.opacity = Math.max(0, this.damageFlashTimer * 2);
    }

    // Clean old messages
    const now = Date.now();
    this.messages = this.messages.filter(m => now - m.time < 5000);
    this.renderMessages();
  }

  flashDamage() {
    this.damageFlashTimer = 0.3;
    document.getElementById('damage-overlay').style.opacity = '0.6';
  }

  addMessage(text, type = 'system') {
    this.messages.push({ text, type, time: Date.now() });
    if (this.messages.length > 6) this.messages.shift();
    this.renderMessages();
  }

  renderMessages() {
    const log = document.getElementById('message-log');
    if (!log) return;
    const now = Date.now();
    log.innerHTML = this.messages.map(m => {
      const age = (now - m.time) / 5000;
      const opacity = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1;
      return `<div class="msg msg-${m.type}" style="opacity:${opacity}">${m.text}</div>`;
    }).join('');
  }

  updateWeaponDisplay() {
    const w = this.game.player.weapon;
    document.getElementById('weapon-name-display').textContent = w.name;
    if (w.durability !== undefined) {
      const pct = Math.floor(w.durability / w.maxDurability * 100);
      document.getElementById('weapon-durability').textContent = `Durability: ${pct}%`;
      document.getElementById('weapon-durability').style.color =
        pct > 50 ? '#aaa' : pct > 20 ? '#ffaa33' : '#ff3333';
    } else {
      document.getElementById('weapon-durability').textContent = '';
    }
  }

  updateQuestTracker() {
    const q = this.game.questManager.getActiveQuest();
    const tracker = document.getElementById('quest-tracker');
    if (!q || q.status === 'completed') {
      // Find next active quest
      const active = Object.values(this.game.questManager.quests).find(
        quest => quest.status === 'active'
      );
      if (active) {
        this.game.questManager.activeQuestId = active.id;
        this.updateQuestTracker();
        return;
      }
      tracker.innerHTML = '';
      return;
    }

    let html = `<div class="qt-title">${q.title}</div>`;
    for (const obj of q.objectives) {
      const progress = this.game.questManager.getObjectiveProgress(obj);
      const done = progress >= obj.required;
      const style = done ? 'color:#558844;text-decoration:line-through' : '';
      html += `<div class="qt-obj" style="${style}">${obj.text} (${progress}/${obj.required})</div>`;
    }
    tracker.innerHTML = html;
  }

  // --- INVENTORY ---
  showInventory(visible) {
    document.getElementById('inventory-screen').style.display = visible ? 'block' : 'none';
    if (visible) this.renderInventory();
  }

  renderInventory() {
    const p = this.game.player;

    // Weapons
    const weaponsEl = document.getElementById('inv-weapons');
    weaponsEl.innerHTML = p.weapons.map((w, i) => {
      const equipped = i === p.currentWeaponIdx ? ' equipped' : '';
      const durPct = w.durability !== undefined ? Math.floor(w.durability / w.maxDurability * 100) : 100;
      return `<div class="inv-slot${equipped}" data-type="weapon" data-idx="${i}">
        <div class="slot-icon">${w.icon || '\u2694\uFE0F'}</div>
        <div class="slot-name">${w.name}</div>
        <div class="slot-count">${durPct}%</div>
      </div>`;
    }).join('');

    // Consumables
    const consEl = document.getElementById('inv-consumables');
    consEl.innerHTML = Object.entries(p.consumables).map(([id, count]) => {
      const def = ITEM_DEFS[id];
      return `<div class="inv-slot" data-type="consumable" data-id="${id}">
        <div class="slot-icon">${def?.icon || '?'}</div>
        <div class="slot-name">${def?.name || id}</div>
        <div class="slot-count">${count}</div>
      </div>`;
    }).join('') || '<div style="color:#555;font-size:12px;padding:8px">No consumables</div>';

    // Materials
    const matsEl = document.getElementById('inv-materials');
    matsEl.innerHTML = Object.entries(p.materials).map(([id, count]) => {
      const def = ITEM_DEFS[id];
      return `<div class="inv-slot" data-type="material" data-id="${id}">
        <div class="slot-icon">${def?.icon || '?'}</div>
        <div class="slot-name">${def?.name || id}</div>
        <div class="slot-count">${count}</div>
      </div>`;
    }).join('') || '<div style="color:#555;font-size:12px;padding:8px">No materials</div>';

    // Gold display
    const detailsEl = document.getElementById('inv-details');
    detailsEl.innerHTML = `<h4>Gold: ${p.gold}</h4><p>Level ${p.level} | ATK: ${(p.attackPower * 100).toFixed(0)}% | DEF: ${p.defense}</p>`;

    // Click handlers
    weaponsEl.querySelectorAll('.inv-slot').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        p.switchWeapon(idx);
        this.renderInventory();
      });
    });

    consEl.querySelectorAll('.inv-slot').forEach(el => {
      el.addEventListener('click', () => {
        p.useConsumable(el.dataset.id);
        this.renderInventory();
      });
    });
  }

  // --- QUEST LOG ---
  showQuestLog(visible) {
    document.getElementById('quest-screen').style.display = visible ? 'block' : 'none';
    if (visible) this.renderQuestLog();
  }

  renderQuestLog() {
    const qm = this.game.questManager;
    const listEl = document.getElementById('quest-list');

    const sorted = Object.values(qm.quests)
      .filter(q => q.status !== 'locked')
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return 0;
      });

    listEl.innerHTML = sorted.map(q => {
      const active = q.id === qm.activeQuestId ? ' active' : '';
      const completed = q.status === 'completed' ? ' completed' : '';
      let html = `<div class="quest-entry${active}${completed}" data-qid="${q.id}">
        <div class="qe-type">${q.type}${q.act ? ' - ACT ' + q.act : ''}</div>
        <div class="qe-title">${q.title}</div>
        <div class="qe-desc">${q.desc}</div>`;

      if (q.status === 'active') {
        for (const obj of q.objectives) {
          const progress = qm.getObjectiveProgress(obj);
          const done = progress >= obj.required;
          const style = done ? 'color:#558844;text-decoration:line-through' : '';
          html += `<div class="qe-obj" style="${style}">${obj.text} (${progress}/${obj.required})</div>`;
        }
      }
      html += '</div>';
      return html;
    }).join('') || '<div style="color:#555;padding:20px;text-align:center">No quests yet</div>';

    // Click to track
    listEl.querySelectorAll('.quest-entry').forEach(el => {
      el.addEventListener('click', () => {
        const qid = el.dataset.qid;
        if (qm.quests[qid].status === 'active') {
          qm.activeQuestId = qid;
          this.renderQuestLog();
          this.updateQuestTracker();
        }
      });
    });
  }

  // --- CRAFTING ---
  showCrafting(visible) {
    document.getElementById('craft-screen').style.display = visible ? 'block' : 'none';
    if (visible) this.renderCrafting();
  }

  renderCrafting() {
    const cs = this.game.craftingSystem;
    const listEl = document.getElementById('craft-list');

    listEl.innerHTML = RECIPES.map(r => {
      const canCraft = cs.canCraft(r);
      const unavailable = canCraft ? '' : ' unavailable';

      const matList = Object.entries(r.materials).map(([id, count]) => {
        const def = ITEM_DEFS[id];
        const have = (this.game.player.consumables[id] || 0) + (this.game.player.materials[id] || 0);
        const color = have >= count ? '#558844' : '#884444';
        return `<span style="color:${color}">${def?.name || id} ${have}/${count}</span>`;
      }).join(', ');

      return `<div class="craft-recipe${unavailable}" data-rid="${r.id}">
        <div class="craft-icon">${r.icon}</div>
        <div class="craft-info">
          <div class="ci-name">${r.name}</div>
          <div class="ci-desc">${r.desc}</div>
          <div class="ci-mats">${matList}</div>
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.craft-recipe:not(.unavailable)').forEach(el => {
      el.addEventListener('click', () => {
        const recipe = RECIPES.find(r => r.id === el.dataset.rid);
        if (recipe && cs.craft(recipe)) {
          this.renderCrafting();
        }
      });
    });
  }
}
