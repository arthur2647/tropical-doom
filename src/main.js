import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { createWorld, REGIONS, updateMinimap, updateEnvironment } from './world.js';
import { Player } from './player.js';
import { EnemyManager } from './enemies.js';
import { QuestManager } from './quests.js';
import { NPCManager } from './npcs.js';
import { ItemManager } from './items.js';
import { UIManager } from './ui.js';
import { CraftingSystem } from './crafting.js';
import { AudioManager } from './audio.js';
import { WeatherSystem } from './weather.js';
import { TouchControls } from './touch.js';

// --- Game State ---
const GameState = {
  TITLE: 0, LOADING: 1, PLAYING: 2, PAUSED: 3, INVENTORY: 4,
  QUEST_LOG: 5, CRAFTING: 6, DIALOGUE: 7, DEAD: 8
};

class Game {
  constructor() {
    this.state = GameState.TITLE;
    this.clock = new THREE.Clock();
    this.totalTime = 0;
    this.kills = 0;
    this.dayTime = 0.35; // Start mid-morning
    this.daySpeed = 0.008; // Full cycle ~125 seconds for demo
    this.isNight = false;

    // Three.js
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.prepend(this.renderer.domElement);

    // Controls
    this.controls = new PointerLockControls(this.camera, document.body);
    this.keys = {};
    this.mouseDown = { left: false, right: false };
    this.attackCooldown = 0;

    // Raycaster for interactions
    this.interactRay = new THREE.Raycaster();
    this.interactRay.far = 4;

    // Systems
    this.player = new Player(this);
    this.ui = new UIManager(this);
    this.enemyManager = new EnemyManager(this);
    this.questManager = new QuestManager(this);
    this.npcManager = new NPCManager(this);
    this.itemManager = new ItemManager(this);
    this.craftingSystem = new CraftingSystem(this);
    this.audioManager = new AudioManager(this);
    this.weather = new WeatherSystem(this);
    this.touch = new TouchControls(this);

    this.interactables = [];

    this.setupEvents();
    this.animate = this.animate.bind(this);
  }

  setupEvents() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('death-restart').addEventListener('click', () => location.reload());
    document.getElementById('pause-resume').addEventListener('click', () => this.resume());
    document.getElementById('pause-restart').addEventListener('click', () => location.reload());

    // Pointer lock
    this.controls.addEventListener('lock', () => {
      if (this.state === GameState.PLAYING) this.ui.showHUD(true);
    });
    // On mobile the HUD is always shown when playing (no pointer lock event)
    this.controls.addEventListener('unlock', () => {
      // Only auto-pause if we're actively playing on desktop (not mobile, not in a menu)
      if (this.state === GameState.PLAYING && !this.touch.enabled) {
        this.pause();
      }
    });

    // Keyboard
    window.addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (this.state === GameState.PLAYING) {
        if (e.code === 'Escape') { e.preventDefault(); this.pause(); }
        if (e.code === 'Tab') { e.preventDefault(); this.openInventory(); }
        if (e.code === 'KeyJ') this.openQuestLog();
        if (e.code === 'KeyC') this.openCrafting();
        if (e.code === 'KeyE') this.interact();
        if (e.code === 'Digit1') this.player.switchWeapon(0);
        if (e.code === 'Digit2') this.player.switchWeapon(1);
        if (e.code === 'Digit3') this.player.switchWeapon(2);
        if (e.code === 'Digit4') this.player.switchWeapon(3);
        if (e.code === 'Digit5') this.player.switchWeapon(4);
      } else if (this.state === GameState.INVENTORY || this.state === GameState.QUEST_LOG || this.state === GameState.CRAFTING) {
        if (e.code === 'Escape' || e.code === 'Tab' || e.code === 'KeyJ' || e.code === 'KeyC') {
          e.preventDefault();
          this.closeMenus();
        }
      } else if (this.state === GameState.DIALOGUE) {
        if (e.code === 'KeyE' || e.code === 'Space') this.npcManager.advanceDialogue();
      } else if (this.state === GameState.PAUSED) {
        if (e.code === 'Escape') this.resume();
      }
    });
    window.addEventListener('keyup', e => this.keys[e.code] = false);

    // Mouse
    window.addEventListener('mousedown', e => {
      if (this.state === GameState.PLAYING) {
        if (e.button === 0) { this.mouseDown.left = true; this.player.attack(false); }
        if (e.button === 2) { this.mouseDown.right = true; this.player.attack(true); }
      }
      if (this.state === GameState.DIALOGUE) this.npcManager.advanceDialogue();
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) this.mouseDown.left = false;
      if (e.button === 2) this.mouseDown.right = false;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());

    // Resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  async startGame() {
    this.state = GameState.LOADING;
    document.getElementById('title-screen').style.display = 'none';
    const loadScreen = document.getElementById('loading-screen');
    loadScreen.style.display = 'flex';
    const loadBar = document.getElementById('load-bar');

    const tips = [
      'The Aswang hunts at night. Listen for the clicking sound...',
      'Craft modified weapons at workbenches scattered around the island.',
      'Some NPCs will trade supplies for favors. Talk to everyone.',
      'The Tikbalang is strongest in the jungle. Lure it to open ground.',
      'Coconuts restore thirst. Look for them near palm trees.',
      'The ancient temple holds the key to everything...',
      'Manananggal can attack from range. Close the distance fast.',
      'Night brings stronger enemies, but better loot.',
    ];
    document.getElementById('load-tip').textContent = tips[Math.floor(Math.random() * tips.length)];

    // Build the world
    loadBar.style.width = '10%';
    await this.sleep(100);

    createWorld(this);
    loadBar.style.width = '40%';
    await this.sleep(100);

    this.npcManager.spawnNPCs();
    loadBar.style.width = '55%';
    await this.sleep(100);

    this.itemManager.scatterItems();
    loadBar.style.width = '70%';
    await this.sleep(100);

    this.questManager.initQuests();
    loadBar.style.width = '80%';
    await this.sleep(100);

    this.enemyManager.spawnInitial();
    loadBar.style.width = '90%';
    await this.sleep(100);

    this.weather.init();
    this.audioManager.init();

    // Position player on the beach near the resort - clear of all colliders
    this.camera.position.set(5, 1.7, 12);
    loadBar.style.width = '100%';
    await this.sleep(300);

    loadScreen.style.display = 'none';

    // Show a click-to-play prompt (browsers require user gesture for pointer lock)
    await this.showClickToPlay();

    this.state = GameState.PLAYING;
    // Brief spawn invincibility so player can orient
    this.player.invincible = 5;

    this.ui.showHUD(true);
    this.ui.addMessage('You wake up on the beach. The resort is in ruins...', 'story');
    this.ui.addMessage('WASD to move, Mouse to look around, Left Click to attack', 'system');

    setTimeout(() => this.ui.addMessage('Look for Lena at the resort (green dot on minimap, top-right).', 'system'), 4000);
    setTimeout(() => this.ui.addMessage('Press TAB for inventory, J for quests, C for crafting', 'system'), 8000);
    setTimeout(() => this.ui.addMessage('Pick up glowing items with E. Red dots on minimap = enemies.', 'system'), 12000);

    this.questManager.activateQuest('wake_up');

    requestAnimationFrame(this.animate);
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  showClickToPlay() {
    return new Promise(resolve => {
      const isMobile = this.touch.isTouchDevice;
      const overlay = document.createElement('div');
      overlay.style.cssText = `position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0.85);
        display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer`;

      const controlsText = isMobile
        ? `Left stick — Move &nbsp;&bull;&nbsp; Swipe right side — Look<br>
           ATK — Attack &nbsp;&bull;&nbsp; HVY — Heavy Attack<br>
           USE — Interact with items/NPCs<br>
           Push stick fully to sprint`
        : `WASD — Move &nbsp;&bull;&nbsp; Mouse — Look Around<br>
           Left Click — Attack &nbsp;&bull;&nbsp; Right Click — Heavy Attack<br>
           E — Interact with items/NPCs &nbsp;&bull;&nbsp; TAB — Inventory<br>
           J — Quest Log &nbsp;&bull;&nbsp; C — Crafting &nbsp;&bull;&nbsp; SHIFT — Sprint`;

      overlay.innerHTML = `
        <div style="font-size:24px;color:#ff8833;letter-spacing:4px;margin-bottom:16px">READY</div>
        <div style="font-size:${isMobile ? 32 : 48}px;color:#fff;margin-bottom:24px;animation:pulse 1.5s infinite">
          ${isMobile ? 'TAP TO PLAY' : 'CLICK TO PLAY'}
        </div>
        <div style="color:#887766;font-size:${isMobile ? 13 : 14}px;max-width:500px;text-align:center;line-height:1.8;padding:0 20px">
          ${controlsText}
        </div>`;
      document.body.appendChild(overlay);

      const onActivate = () => {
        overlay.removeEventListener('click', onActivate);
        overlay.removeEventListener('touchstart', onActivate);
        overlay.remove();
        if (isMobile) {
          // On mobile, don't use pointer lock — use touch controls instead
          this.touch.init();
        } else {
          this.controls.lock();
        }
        resolve();
      };
      overlay.addEventListener('click', onActivate);
      overlay.addEventListener('touchstart', onActivate, { passive: false });
    });
  }

  animate() {
    requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state === GameState.PLAYING) {
      this.totalTime += dt;
      this.touch.applyToPlayer(this.player, this.camera, dt);
      this.updateDayNight(dt);
      this.player.update(dt);
      this.enemyManager.update(dt);
      this.npcManager.update(dt);
      this.itemManager.update(dt);
      this.weather.update(dt);
      updateEnvironment(this, dt);
      this.checkInteractables();
      this.ui.update(dt);
      updateMinimap(this);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateDayNight(dt) {
    this.dayTime = (this.dayTime + this.daySpeed * dt) % 1;
    const wasNight = this.isNight;
    this.isNight = this.dayTime > 0.75 || this.dayTime < 0.2;

    // Sun position
    const sunAngle = this.dayTime * Math.PI * 2 - Math.PI / 2;
    const sunY = Math.sin(sunAngle);
    const sunX = Math.cos(sunAngle);

    if (this.sunLight) {
      this.sunLight.position.set(sunX * 100, Math.max(sunY * 100, 5), 50);
      this.sunLight.intensity = Math.max(0, sunY) * 2.5;
    }

    // Sky color with richer sunrise/sunset transitions
    const dayCol = new THREE.Color(0.4, 0.7, 1.0);
    const sunsetCol = new THREE.Color(1.0, 0.4, 0.15);
    const dawnCol = new THREE.Color(0.9, 0.55, 0.35);
    const twilightCol = new THREE.Color(0.15, 0.1, 0.3);
    const nightCol = new THREE.Color(0.02, 0.02, 0.06);

    let skyColor;
    if (sunY > 0.3) {
      skyColor = dayCol;
    } else if (sunY > 0.1) {
      // Late afternoon / early morning - blend day to warm
      const t = (sunY - 0.1) / 0.2;
      skyColor = dawnCol.clone().lerp(dayCol, t);
    } else if (sunY > -0.05) {
      // Sunset/sunrise band - warmest colors
      const t = (sunY + 0.05) / 0.15;
      skyColor = twilightCol.clone().lerp(sunsetCol, t);
    } else if (sunY > -0.2) {
      // Twilight - purple/dark blue
      const t = (sunY + 0.2) / 0.15;
      skyColor = nightCol.clone().lerp(twilightCol, t);
    } else {
      skyColor = nightCol;
    }
    this.scene.background = skyColor;
    this.scene.fog.color.copy(skyColor);

    // Sun light color shifts with angle
    if (this.sunLight) {
      if (sunY > 0 && sunY < 0.3) {
        this.sunLight.color.setRGB(1.0, 0.8 + sunY, 0.6 + sunY);
      } else {
        this.sunLight.color.setHex(0xfff0d0);
      }
    }

    if (this.ambientLight) {
      const nightAmt = this.isNight ? 1 : Math.max(0, 1 - sunY * 5);
      this.ambientLight.intensity = THREE.MathUtils.lerp(0.6, 0.15, nightAmt);
      const dayAmb = new THREE.Color(1, 0.95, 0.8);
      const nightAmb = new THREE.Color(0.2, 0.2, 0.5);
      this.ambientLight.color.copy(dayAmb.lerp(nightAmb, nightAmt));
    }

    this.renderer.toneMappingExposure = this.isNight ? 0.5 : 1.2;

    if (!wasNight && this.isNight) {
      this.ui.addMessage('Night falls... the creatures grow stronger.', 'story');
      this.enemyManager.onNightfall();
      // Activate night slayer quest on first nightfall
      const nsQuest = this.questManager.quests['night_slayer'];
      if (nsQuest && nsQuest.status === 'locked') {
        this.questManager.activateQuest('night_slayer');
      }
    }
    if (wasNight && !this.isNight) {
      this.ui.addMessage('Dawn breaks. You survived the night.', 'story');
      this.questManager.triggerEvent('survive_dawn');
    }
  }

  checkInteractables() {
    this.interactRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hits = this.interactRay.intersectObjects(this.interactables, true);
    const prompt = document.getElementById('interact-prompt');
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj && !obj.userData.interactable) obj = obj.parent;
      if (obj && obj.userData.interactable) {
        this.currentInteractable = obj;
        document.getElementById('interact-text').textContent = obj.userData.promptText || 'Press E to interact';
        prompt.style.display = 'block';
        return;
      }
    }
    this.currentInteractable = null;
    prompt.style.display = 'none';
  }

  interact() {
    if (this.currentInteractable) {
      const data = this.currentInteractable.userData;
      if (data.type === 'npc') this.npcManager.talkTo(data.npcId);
      else if (data.type === 'item') this.itemManager.pickup(this.currentInteractable);
      else if (data.type === 'workbench') this.openCrafting();
      else if (data.type === 'bed') this.startSleep();
      else if (data.type === 'lore') {
        this.ui.addMessage(data.text, 'story');
        if (data.questTrigger) this.questManager.triggerEvent(data.questTrigger);
      }
    }
  }

  async startSleep() {
    // Can't sleep during combat (enemies nearby)
    const playerPos = this.camera.position;
    const nearbyEnemy = this.enemyManager.enemies.some(e => {
      if (e.state === 'dead') return false;
      const dx = e.model.position.x - playerPos.x;
      const dz = e.model.position.z - playerPos.z;
      return Math.sqrt(dx * dx + dz * dz) < 15;
    });
    if (nearbyEnemy) {
      this.ui.addMessage('You can\'t sleep - there are enemies nearby!', 'system');
      return;
    }

    this.state = GameState.PAUSED; // Prevent updates during sleep
    this.controls.unlock();

    // Create sleep overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:999;background:rgba(0,0,0,0);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      transition:background 1.5s;pointer-events:none`;
    overlay.innerHTML = `<div id="sleep-text" style="color:#aaaacc;font-size:20px;opacity:0;
      transition:opacity 1s;letter-spacing:4px;text-transform:uppercase"></div>`;
    document.body.appendChild(overlay);
    const sleepText = document.getElementById('sleep-text');

    // Phase 1: Fade to black
    await this.sleep(100);
    overlay.style.background = 'rgba(0,0,0,0.97)';
    await this.sleep(1500);

    // Phase 2: Show sleeping text
    sleepText.textContent = 'Sleeping...';
    sleepText.style.opacity = '1';
    await this.sleep(1500);

    // Advance time to morning (dayTime 0.3 = mid-morning)
    this.dayTime = 0.3;
    this.isNight = false;

    // Heal player
    const healAmount = Math.floor(this.player.maxHp * 0.6);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
    this.player.stamina = this.player.maxStamina;

    // Also heal NPCs
    for (const npc of Object.values(this.npcManager.npcs)) {
      if (npc.combatState === 'downed') {
        npc.combatState = 'idle';
        npc.hp = npc.maxHp;
        npc.model.rotation.x = 0;
        const gy = npc.homePos.y;
        npc.model.position.set(npc.homePos.x, gy, npc.homePos.z);
        npc.model.userData.promptText = `Press E - Talk to ${npc.def.name}`;
        this.npcManager.updateHealthBar(npc);
      } else {
        npc.hp = npc.maxHp;
        this.npcManager.updateHealthBar(npc);
      }
    }

    // Clear nearby enemies (they retreat at dawn)
    for (let i = this.enemyManager.enemies.length - 1; i >= 0; i--) {
      const e = this.enemyManager.enemies[i];
      if (e.state !== 'dead') {
        this.scene.remove(e.model);
        this.enemyManager.enemies.splice(i, 1);
      }
    }
    this.enemyManager.difficulty = 1;

    // Phase 3: Show wake up text
    sleepText.textContent = 'You wake up feeling rested.';
    await this.sleep(1500);

    // Phase 4: Fade out
    sleepText.style.opacity = '0';
    overlay.style.background = 'rgba(0,0,0,0)';
    await this.sleep(1500);

    overlay.remove();

    // Resume
    this.state = GameState.PLAYING;
    if (!this.touch.enabled) this.controls.lock();

    this.ui.addMessage(`You slept until morning. +${healAmount} HP restored.`, 'heal');
    this.ui.addMessage('Dawn breaks. The island feels peaceful... for now.', 'story');

    // Respawn some daytime enemies at distance
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 30;
      this.enemyManager.spawn('infected', new THREE.Vector3(
        playerPos.x + Math.cos(angle) * dist, 0,
        playerPos.z + Math.sin(angle) * dist
      ));
    }

    this.questManager.triggerEvent('slept');
  }

  openInventory() {
    this.state = GameState.INVENTORY;
    this.controls.unlock();
    this.ui.showInventory(true);
  }

  openQuestLog() {
    this.state = GameState.QUEST_LOG;
    this.controls.unlock();
    this.ui.showQuestLog(true);
  }

  openCrafting() {
    this.state = GameState.CRAFTING;
    this.controls.unlock();
    this.ui.showCrafting(true);
  }

  closeMenus() {
    this.state = GameState.PLAYING;
    this.ui.showInventory(false);
    this.ui.showQuestLog(false);
    this.ui.showCrafting(false);
    if (!this.touch.enabled) this.controls.lock();
  }

  pause() {
    this.state = GameState.PAUSED;
    this.controls.unlock();
    document.getElementById('pause-screen').style.display = 'flex';
  }

  resume() {
    document.getElementById('pause-screen').style.display = 'none';
    this.state = GameState.PLAYING;
    if (!this.touch.enabled) this.controls.lock();
  }

  playerDeath(cause) {
    this.state = GameState.DEAD;
    this.controls.unlock();
    const mins = Math.floor(this.totalTime / 60);
    const secs = Math.floor(this.totalTime % 60);
    document.getElementById('death-cause').textContent = cause || 'Consumed by darkness';
    document.getElementById('death-stats').textContent =
      `Survived ${mins}m ${secs}s \u2022 ${this.kills} kills \u2022 Level ${this.player.level}`;
    document.getElementById('death-screen').style.display = 'flex';
  }
}

// Boot
const game = new Game();
window.game = game;
