import * as THREE from 'three';

export class QuestManager {
  constructor(game) {
    this.game = game;
    this.quests = {};
    this.activeQuestId = null;
    this.eventCounters = {};
    this.diwataSpawned = false;
  }

  initQuests() {
    const Q = (id, data) => { this.quests[id] = { id, status: 'locked', progress: 0, ...data }; };

    // === ACT 1: THE RESORT ===
    Q('wake_up', {
      title: 'Paradise Lost',
      type: 'MAIN QUEST',
      act: 1,
      desc: 'You wake up on the beach near the ruined resort. Find a weapon and get your bearings.',
      objectives: [
        { text: 'Find a weapon', event: 'pickup_weapon', required: 1 },
        { text: 'Kill 3 Infected', event: 'kill_infected', required: 3 },
      ],
      rewards: { xp: 50, gold: 20 },
      nextQuest: 'find_survivors',
    });

    Q('find_survivors', {
      title: 'Not Alone',
      type: 'MAIN QUEST',
      act: 1,
      desc: 'A note at the resort mentions survivors at the village. Find them.',
      objectives: [
        { text: 'Read the note at the resort', event: 'found_note', required: 1 },
        { text: 'Reach the Village', event: 'enter_the_village', required: 1 },
        { text: 'Talk to Maria', event: 'talk_maria', required: 1 },
      ],
      rewards: { xp: 100, gold: 30, item: 'bolo' },
      nextQuest: 'village_defense',
    });

    Q('village_defense', {
      title: 'Hold the Line',
      type: 'MAIN QUEST',
      act: 1,
      desc: 'Maria says the village is attacked every night. Help defend it.',
      objectives: [
        { text: 'Kill 10 enemies near the village', event: 'kill_village_enemy', required: 10 },
        { text: 'Survive until dawn', event: 'survive_dawn', required: 1 },
      ],
      rewards: { xp: 200, gold: 50 },
      nextQuest: 'curse_origin',
    });

    // === ACT 2: THE CURSE ===
    Q('curse_origin', {
      title: 'The Ancient Curse',
      type: 'MAIN QUEST',
      act: 2,
      desc: 'Maria tells you the creatures came from the old temple. Investigate.',
      objectives: [
        { text: 'Find the Temple Ruins', event: 'enter_the_temple_ruins', required: 1 },
        { text: 'Read the temple inscription', event: 'read_inscription', required: 1 },
      ],
      rewards: { xp: 150, gold: 40 },
      nextQuest: 'three_relics',
    });

    Q('three_relics', {
      title: 'The Three Sacred Relics',
      type: 'MAIN QUEST',
      act: 2,
      desc: 'The inscription speaks of three relics needed to seal the darkness.',
      objectives: [
        { text: 'Find the Sacred Amulet (Jungle Cave)', event: 'found_amulet', required: 1 },
        { text: 'Find the Sacred Shell (Fisherman\'s Cove)', event: 'found_shell', required: 1 },
        { text: 'Find the Sacred Flame (Mangrove Swamp)', event: 'found_flame', required: 1 },
      ],
      rewards: { xp: 300, gold: 100 },
      nextQuest: 'final_stand',
    });

    // === ACT 3: THE FINALE ===
    Q('final_stand', {
      title: 'The Diwata\'s Wrath',
      type: 'MAIN QUEST',
      act: 3,
      desc: 'Return to the temple with the three relics and seal the darkness. But the Corrupted Diwata guards the altar...',
      objectives: [
        { text: 'Return to the Temple Altar', event: 'enter_the_temple_ruins', required: 1 },
        { text: 'Defeat the Corrupted Diwata', event: 'kill_boss_diwata', required: 1 },
        { text: 'Place the relics on the altar', event: 'place_relics', required: 1 },
      ],
      rewards: { xp: 1000 },
      nextQuest: null,
      onComplete: 'victory',
    });

    // === SIDE QUESTS ===
    Q('herbalist', {
      title: 'Jungle Medicine',
      type: 'SIDE QUEST',
      desc: 'Old Tomas needs medicinal herbs from the jungle to treat the wounded.',
      objectives: [
        { text: 'Collect 5 herbs', event: 'collect_herbs', required: 5 },
        { text: 'Return to Tomas', event: 'talk_tomas_herbs', required: 1 },
      ],
      rewards: { xp: 80, gold: 25, item: 'antidote' },
    });

    Q('fisher_problem', {
      title: 'Something in the Water',
      type: 'SIDE QUEST',
      desc: 'Pedro the fisherman says creatures have infested the cove. Clear them out.',
      objectives: [
        { text: 'Kill 5 enemies at the Cove', event: 'kill_cove_enemy', required: 5 },
        { text: 'Report to Pedro', event: 'talk_pedro_done', required: 1 },
      ],
      rewards: { xp: 100, gold: 30, item: 'sumpak' },
    });

    Q('kapre_hunt', {
      title: 'The Tree Giant',
      type: 'SIDE QUEST',
      desc: 'A massive Kapre has been spotted in the deep jungle. It\'s terrorizing the area.',
      objectives: [
        { text: 'Find and kill the Kapre', event: 'kill_boss_kapre', required: 1 },
      ],
      rewards: { xp: 250, gold: 80, item: 'enchanted_bolo' },
    });

    Q('scavenger', {
      title: 'Resort Scavenger',
      type: 'SIDE QUEST',
      desc: 'Search the ruined resort for useful supplies.',
      objectives: [
        { text: 'Find 3 scrap metal', event: 'collect_scrap_metal', required: 3 },
        { text: 'Find 2 cloth rags', event: 'collect_cloth_rag', required: 2 },
      ],
      rewards: { xp: 60, gold: 15 },
    });

    Q('night_slayer', {
      title: 'Night Slayer',
      type: 'SIDE QUEST',
      desc: 'Kill 15 enemies during nighttime.',
      objectives: [
        { text: 'Kill 15 enemies at night', event: 'kill_night', required: 15 },
      ],
      rewards: { xp: 200, gold: 60 },
    });
  }

  activateQuest(id) {
    const q = this.quests[id];
    if (!q || q.status === 'completed') return;
    q.status = 'active';
    this.activeQuestId = id;
    this.game.ui.addMessage(`New Quest: ${q.title}`, 'quest');
    this.game.ui.updateQuestTracker();
  }

  triggerEvent(event) {
    this.eventCounters[event] = (this.eventCounters[event] || 0) + 1;

    // Spawn Diwata boss when entering temple with all 3 relics
    if (event === 'enter_the_temple_ruins') {
      const q = this.quests['final_stand'];
      if (q && q.status === 'active' && !this.diwataSpawned) {
        const hasRelics = (this.eventCounters['found_amulet'] || 0) >= 1 &&
                          (this.eventCounters['found_shell'] || 0) >= 1 &&
                          (this.eventCounters['found_flame'] || 0) >= 1;
        if (hasRelics) {
          this.diwataSpawned = true;
          this.game.ui.addMessage('The ground trembles... The Corrupted Diwata awakens!', 'story');
          this.game.enemyManager.spawn('diwata', new THREE.Vector3(-60, 0, -60));
        }
      }
    }

    // Auto-place relics after killing diwata
    if (event === 'kill_boss_diwata') {
      this.triggerEvent('place_relics');
    }

    // Check all active quests
    for (const q of Object.values(this.quests)) {
      if (q.status !== 'active') continue;
      let allDone = true;
      for (const obj of q.objectives) {
        const count = this.eventCounters[obj.event] || 0;
        if (count < obj.required) allDone = false;
      }
      if (allDone) this.completeQuest(q.id);
    }

    this.game.ui.updateQuestTracker();
  }

  completeQuest(id) {
    const q = this.quests[id];
    if (!q || q.status === 'completed') return;
    q.status = 'completed';
    this.game.ui.addMessage(`Quest Complete: ${q.title}!`, 'quest');

    // Give rewards
    if (q.rewards) {
      if (q.rewards.xp) this.game.player.addXP(q.rewards.xp);
      if (q.rewards.gold) {
        this.game.player.gold += q.rewards.gold;
        this.game.ui.addMessage(`+${q.rewards.gold} gold`, 'loot');
      }
      if (q.rewards.item) {
        this.giveQuestReward(q.rewards.item);
      }
    }

    // Unlock next
    if (q.nextQuest) {
      setTimeout(() => this.activateQuest(q.nextQuest), 2000);
    }

    // Victory condition
    if (q.onComplete === 'victory') {
      this.game.ui.addMessage('THE DARKNESS RECEDES. THE ISLAND IS SAVED.', 'story');
      setTimeout(() => this.showVictoryScreen(), 3000);
    }

    this.game.ui.updateQuestTracker();
  }

  giveQuestReward(itemId) {
    const weaponRewards = {
      bolo: {
        id: 'bolo', name: 'Bolo Machete', icon: '\u{1FA93}',
        damage: 18, speed: 0.45, range: 2.8, durability: 120, maxDurability: 120,
        type: 'melee', heavy: 30, desc: 'A sharp bolo machete. The weapon of choice in the tropics.',
        staminaCost: 10, heavyStaminaCost: 22
      },
      sumpak: {
        id: 'sumpak', name: 'Sumpak', icon: '\u{1F52B}',
        damage: 35, speed: 1.0, range: 15, durability: 60, maxDurability: 60,
        type: 'ranged', heavy: 50, desc: 'An improvised shotgun. Devastating at close range.',
        staminaCost: 5, heavyStaminaCost: 15
      },
      enchanted_bolo: {
        id: 'enchanted_bolo', name: 'Enchanted Bolo', icon: '\u2694\uFE0F',
        damage: 35, speed: 0.35, range: 3, durability: 200, maxDurability: 200,
        type: 'melee', heavy: 55, desc: 'Blessed by ancient spirits. Glows with ethereal light.',
        staminaCost: 8, heavyStaminaCost: 18
      },
    };
    if (weaponRewards[itemId]) {
      this.game.player.addWeapon({ ...weaponRewards[itemId] });
    } else {
      this.game.player.addItem(itemId, 3);
      this.game.ui.addMessage(`Received ${itemId.replace(/_/g, ' ')} x3`, 'loot');
    }
  }

  showVictoryScreen() {
    this.game.state = 8; // DEAD state to stop updates
    if (!this.game.touch.enabled) this.game.controls.unlock();
    const mins = Math.floor(this.game.totalTime / 60);
    const secs = Math.floor(this.game.totalTime % 60);
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      transition:background 2s;`;
    overlay.innerHTML = `
      <div style="text-align:center;opacity:0;transition:opacity 2s" id="victory-content">
        <div style="font-size:16px;color:#44aa88;letter-spacing:6px;margin-bottom:16px">SIGAW: LAGIM SA TROPIKO</div>
        <div style="font-size:48px;color:#ffcc44;margin-bottom:24px;letter-spacing:4px">VICTORY</div>
        <div style="color:#aaaaaa;font-size:16px;margin-bottom:8px">The seal is restored. The island is safe once more.</div>
        <div style="color:#887766;font-size:14px;margin-bottom:32px">
          Survived ${mins}m ${secs}s &bull; ${this.game.kills} kills &bull; Level ${this.game.player.level}
        </div>
        <div style="color:#558855;font-size:13px;margin-bottom:8px">Quests completed: ${
          Object.values(this.quests).filter(q => q.status === 'completed').length
        }/${Object.keys(this.quests).length}</div>
        <div style="margin-top:32px">
          <button onclick="location.reload()" style="padding:12px 32px;font-size:16px;
            background:none;border:1px solid #ff8833;color:#ff8833;cursor:pointer;
            letter-spacing:2px">PLAY AGAIN</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.style.background = 'rgba(0,0,0,0.95)';
      document.getElementById('victory-content').style.opacity = '1';
    }, 100);
  }

  getActiveQuest() {
    return this.activeQuestId ? this.quests[this.activeQuestId] : null;
  }

  getObjectiveProgress(obj) {
    return Math.min(this.eventCounters[obj.event] || 0, obj.required);
  }
}
