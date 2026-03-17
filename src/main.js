import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
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
    this.scene.add(this.camera); // Camera must be in scene for weapon model to render
    this.baseFOV = 75;
    this.targetFOV = 75;
    this.cameraShake = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    document.body.prepend(this.renderer.domElement);

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.3, // strength - subtle bloom
      0.6, // radius
      0.85  // threshold - only bright things bloom
    );
    this.composer.addPass(this.bloomPass);

    // Vignette + color grading pass
    const vignetteShader = {
      uniforms: {
        tDiffuse: { value: null },
        darkness: { value: 0.5 },
        offset: { value: 1.2 },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float darkness;
        uniform float offset;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          vec2 uv = (vUv - 0.5) * 2.0;
          float vig = 1.0 - dot(uv, uv) * darkness;
          vig = clamp(pow(vig, 1.5), 0.0, 1.0);
          color.rgb *= vig;
          // Subtle warm color grading
          color.r *= 1.02;
          color.b *= 0.97;
          gl_FragColor = color;
        }`
    };
    this.vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(this.vignettePass);

    // Controls
    this.controls = new PointerLockControls(this.camera, document.body);
    this.keys = {};
    this.mouseDown = { left: false, right: false };
    this.attackCooldown = 0;

    // Raycaster for interactions
    this.interactRay = new THREE.Raycaster();
    this.interactRay.far = 4;
    this._rayCenter = new THREE.Vector2(0, 0);

    // Pre-allocated colors for day/night cycle (avoid per-frame allocations)
    this._skyColors = {
      day: new THREE.Color(0.4, 0.7, 1.0),
      sunset: new THREE.Color(1.0, 0.4, 0.15),
      dawn: new THREE.Color(0.9, 0.55, 0.35),
      twilight: new THREE.Color(0.15, 0.1, 0.3),
      night: new THREE.Color(0.02, 0.02, 0.06),
      dayAmb: new THREE.Color(1, 0.95, 0.8),
      nightAmb: new THREE.Color(0.2, 0.2, 0.5),
      scratch: new THREE.Color(),
    };

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

    // Tutorial system
    this.tutorial = {
      shown: {},
      queue: [],
      active: false,
      steps: this.getTutorialSteps(),
    };

    this.setupEvents();
    this.animate = this.animate.bind(this);
  }

  setupEvents() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('death-restart').addEventListener('click', () => location.reload());
    document.getElementById('pause-resume').addEventListener('click', () => this.resume());
    document.getElementById('pause-restart').addEventListener('click', () => location.reload());

    // Menu close buttons (critical for mobile)
    document.getElementById('inv-close').addEventListener('click', () => this.closeMenus());
    document.getElementById('quest-close').addEventListener('click', () => this.closeMenus());
    document.getElementById('craft-close').addEventListener('click', () => this.closeMenus());

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
      this.composer.setSize(window.innerWidth, window.innerHeight);
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

    // Pre-compile all shaders to avoid lag spikes when encountering new materials
    this.renderer.compile(this.scene, this.camera);

    // Always spawn near the resort — safe starting area with Lena nearby
    const spawn = { x: 5, z: 12, name: 'the resort beach' };
    this.spawnName = spawn.name;
    const spawnY = 1.7;
    this.camera.position.set(spawn.x, spawnY, spawn.z);
    loadBar.style.width = '100%';
    await this.sleep(300);

    loadScreen.style.display = 'none';

    // Show a click-to-play prompt (browsers require user gesture for pointer lock)
    await this.showClickToPlay();

    this.state = GameState.PLAYING;
    // Brief spawn invincibility so player can orient
    this.player.invincible = 8;

    this.ui.showHUD(true);

    // Show tutorial for new players
    await new Promise(resolve => {
      this.showTutorial();
      const checkDone = setInterval(() => {
        if (!this.tutorial.active) { clearInterval(checkDone); resolve(); }
      }, 100);
    });

    this.ui.addMessage(`You wake up near ${this.spawnName}. Something terrible has happened...`, 'story');
    setTimeout(() => this.ui.addMessage('Look for Lena at the resort (green dot on minimap).', 'system'), 3000);

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

  // --- Tutorial System ---
  getTutorialSteps() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const k = (desktop, mobile) => isMobile ? mobile : desktop;
    return [
      {
        id: 'welcome',
        title: 'WELCOME TO PARADISE GONE DARK',
        text: 'You\'re stranded on a cursed tropical island. Survive by exploring, fighting creatures, crafting weapons, and uncovering the mystery of the ancient temple.',
        hint: 'This tutorial will guide you through the basics.',
      },
      {
        id: 'movement',
        title: 'MOVEMENT',
        text: k(
          '<b>WASD</b> — Move around<br><b>SHIFT</b> — Sprint (uses stamina)<br><b>SPACE</b> — Jump<br><b>Mouse</b> — Look around',
          '<b>Left stick</b> — Move (push fully to sprint)<br><b>Swipe right side</b> — Look around'
        ),
        hint: 'Watch your stamina bar — sprinting drains it. When exhausted, you move slower.',
      },
      {
        id: 'combat',
        title: 'COMBAT',
        text: k(
          '<b>Left Click</b> — Attack<br><b>Right Click</b> — Heavy Attack (more damage, more stamina)<br>Weapons have durability — they break with use!',
          '<b>ATK</b> — Attack<br><b>HVY</b> — Heavy Attack (more damage, more stamina)<br>Weapons have durability — they break with use!'
        ),
        hint: 'Red dots on the minimap (top-right) are enemies. Avoid getting surrounded!',
      },
      {
        id: 'interact',
        title: 'ITEMS & INTERACTION',
        text: k(
          '<b>E</b> — Pick up items and talk to NPCs<br>Glowing objects on the ground are collectible items.<br>Green dots on the minimap are friendly NPCs.',
          '<b>USE</b> button — Pick up items and talk to NPCs<br>Glowing objects on the ground are collectible items.<br>Green dots on the minimap are friendly NPCs.'
        ),
        hint: 'Find Lena at the resort first — she\'ll give you a weapon upgrade.',
      },
      {
        id: 'inventory',
        title: 'INVENTORY & CRAFTING',
        text: k(
          '<b>TAB</b> — Inventory (use consumables, switch weapons)<br><b>C</b> — Crafting (combine materials at workbenches)<br><b>J</b> — Quest Log (track your objectives)',
          '<b>ITEMS</b> — Inventory<br><b>CRAFT</b> — Crafting (combine materials at workbenches)<br><b>QUESTS</b> — Quest Log'
        ),
        hint: 'Collect materials like scrap metal, cloth rags, and herbs to craft better weapons and healing items.',
      },
      {
        id: 'progression',
        title: 'HOW TO PROGRESS',
        text: '1. <b>Find Lena</b> at the resort for your first weapon<br>2. <b>Go to the Village</b> (east) and talk to Anna<br>3. <b>Complete quests</b> from NPCs to unlock the story<br>4. <b>Find the 3 sacred relics</b> scattered across the island<br>5. <b>Return to the Temple</b> to face the final boss',
        hint: 'Follow quest objectives in the top-left corner. Sleep in the village bed to heal and skip to morning.',
      },
      {
        id: 'tips',
        title: 'SURVIVAL TIPS',
        text: 'Night is dangerous — enemies are stronger and more numerous.<br>NPCs fight alongside you and can be healed by sleeping.<br>Craft a <b>Molotov Cocktail</b> for area damage against groups.<br>The <b>workbench</b> at the resort and village lets you craft weapons.',
        hint: 'Good luck, survivor. The island\'s fate is in your hands.',
      },
    ];
  }

  showTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    const steps = this.tutorial.steps;
    let stepIdx = 0;

    const showStep = () => {
      const step = steps[stepIdx];
      document.getElementById('tutorial-title').textContent = step.title;
      document.getElementById('tutorial-text').innerHTML = step.text;
      document.getElementById('tutorial-hint').textContent = step.hint || '';
      // Step dots
      const dotsEl = document.getElementById('tutorial-step');
      dotsEl.innerHTML = steps.map((_, i) =>
        `<div class="dot${i === stepIdx ? ' active' : ''}"></div>`
      ).join('');
      document.getElementById('tutorial-dismiss').textContent =
        stepIdx < steps.length - 1 ? 'Click or press any key to continue' : 'Click or press any key to start playing';
    };

    const advance = (e) => {
      if (e) e.preventDefault();
      stepIdx++;
      if (stepIdx >= steps.length) {
        // Tutorial done
        overlay.style.display = 'none';
        this.tutorial.active = false;
        overlay.removeEventListener('click', advance);
        window.removeEventListener('keydown', advance);
        overlay.removeEventListener('touchstart', advance);
        // Lock controls after tutorial
        if (!this.touch.enabled) this.controls.lock();
        return;
      }
      showStep();
    };

    this.tutorial.active = true;
    overlay.style.display = 'flex';
    showStep();

    overlay.addEventListener('click', advance);
    overlay.addEventListener('touchstart', advance, { passive: false });
    window.addEventListener('keydown', advance);
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

      // --- Sprint FOV kick ---
      const sprinting = this.keys['ShiftLeft'] && this.player.stamina > 10;
      const moving = this.player.direction.length() > 0;
      this.targetFOV = (sprinting && moving) ? 85 : this.baseFOV;
      const currentFOV = this.camera.fov;
      if (Math.abs(currentFOV - this.targetFOV) > 0.1) {
        this.camera.fov += (this.targetFOV - currentFOV) * dt * 6;
        this.camera.updateProjectionMatrix();
      }

      // --- Camera shake (applied to weapon mesh only to avoid PointerLockControls conflict) ---
      if (this.cameraShake > 0) {
        this.cameraShake *= (1 - dt * 8);
        if (this.cameraShake < 0.01) this.cameraShake = 0;
        if (this.player.weaponMesh) {
          this.player.weaponMesh.position.x += (Math.random() - 0.5) * this.cameraShake * 0.08;
          this.player.weaponMesh.position.y += (Math.random() - 0.5) * this.cameraShake * 0.06;
        }
      }

      // --- Idle breathing sway ---
      if (!moving) {
        const breathe = Math.sin(this.totalTime * 1.5) * 0.002;
        this.camera.position.y += breathe;
      }
    }

    // Shadow camera follows player for better shadow quality nearby
    if (this.sunLight && this.state === GameState.PLAYING) {
      this.sunLight.target.position.copy(this.camera.position);
      this.sunLight.target.updateMatrixWorld();
    }

    // Bloom intensity adjusts with time of day
    if (this.bloomPass) {
      this.bloomPass.strength = this.isNight ? 0.5 : 0.25;
    }

    // Vignette darkens at night
    if (this.vignettePass) {
      this.vignettePass.uniforms.darkness.value = this.isNight ? 0.7 : 0.4;
    }

    this.composer.render();
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

    // Sky color with richer sunrise/sunset transitions (using pre-allocated colors)
    const sc = this._skyColors;
    const skyColor = sc.scratch;
    if (sunY > 0.3) {
      skyColor.copy(sc.day);
    } else if (sunY > 0.1) {
      const t = (sunY - 0.1) / 0.2;
      skyColor.copy(sc.dawn).lerp(sc.day, t);
    } else if (sunY > -0.05) {
      const t = (sunY + 0.05) / 0.15;
      skyColor.copy(sc.twilight).lerp(sc.sunset, t);
    } else if (sunY > -0.2) {
      const t = (sunY + 0.2) / 0.15;
      skyColor.copy(sc.night).lerp(sc.twilight, t);
    } else {
      skyColor.copy(sc.night);
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
      this.ambientLight.color.copy(sc.dayAmb).lerp(sc.nightAmb, nightAmt);
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
    this.interactRay.setFromCamera(this._rayCenter, this.camera);
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
    if (!this.touch.enabled) this.controls.unlock();

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
    if (!this.touch.enabled) this.controls.unlock();
    this.ui.showInventory(true);
  }

  openQuestLog() {
    this.state = GameState.QUEST_LOG;
    if (!this.touch.enabled) this.controls.unlock();
    this.ui.showQuestLog(true);
  }

  openCrafting() {
    this.state = GameState.CRAFTING;
    if (!this.touch.enabled) this.controls.unlock();
    this.ui.showCrafting(true);
  }

  closeMenus() {
    this.state = GameState.PLAYING;
    this.ui.showInventory(false);
    this.ui.showQuestLog(false);
    this.ui.showCrafting(false);
    document.getElementById('pause-screen').style.display = 'none';
    if (!this.touch.enabled) this.controls.lock();
  }

  pause() {
    this.state = GameState.PAUSED;
    if (!this.touch.enabled) this.controls.unlock();
    document.getElementById('pause-screen').style.display = 'flex';
  }

  resume() {
    document.getElementById('pause-screen').style.display = 'none';
    this.state = GameState.PLAYING;
    if (!this.touch.enabled) this.controls.lock();
  }

  playerDeath(cause) {
    this.state = GameState.DEAD;
    if (!this.touch.enabled) this.controls.unlock();
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
