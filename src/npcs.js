import * as THREE from 'three';
import { getTerrainHeightFast } from './world.js';

const NPC_DEFS = {
  maria: {
    name: 'Maria',
    title: 'Village Leader',
    position: [62, 0, 18],
    color: 0xCC6644,
    // Combat stats
    hp: 120, damage: 14, attackRange: 2.5, attackSpeed: 1.4, zoneRadius: 25,
    combatStyle: 'melee', // bolo fighter
    callouts: {
      enemySpotted: ['Enemies approaching! Everyone, fight!', 'To arms! Protect the village!', 'They\'re coming! Stand your ground!'],
      attacking: ['Hiya!', 'Get back, demon!', 'You won\'t take this village!'],
      playerHurt: ['Watch out! They\'re flanking you!', 'Stay strong, we fight together!'],
      enemyKilled: ['One down! Keep fighting!', 'That\'s how we do it!'],
      downed: ['I... can\'t... keep going...', 'Ugh... need to rest...'],
      revived: ['I\'m back on my feet. Let\'s go!'],
    },
    dialogues: {
      initial: {
        speaker: 'Maria - Village Leader',
        lines: [
          'Salamat sa Diyos, another survivor! I\'m Maria. We\'ve gathered what\'s left of the village here.',
          'Three days ago the earth shook and that old temple in the jungle cracked open. Then the creatures came.',
          'We lose people every night. The Aswang... they come when it\'s dark. We need help defending this place.',
          'Can you fight? We need every able body. Talk to old Tomas for medicine, and Pedro knows the coast.'
        ],
        onComplete: 'talk_maria',
        unlockQuests: ['herbalist', 'fisher_problem', 'scavenger', 'kapre_hunt'],
        next: 'defense'
      },
      defense: {
        speaker: 'Maria - Village Leader',
        lines: [
          'Thank you for staying. Every night they attack in greater numbers.',
          'There\'s something wrong with the old temple. The elders used to say a powerful Diwata was sealed there.',
          'If you can survive a night defending us, I\'ll tell you everything I know about the temple.'
        ],
        checkCondition: { event: 'survive_dawn', required: 1, nextIfMet: 'post_defense' },
      },
      post_defense: {
        speaker: 'Maria - Village Leader',
        lines: [
          'You fought bravely. The old stories say three sacred relics were used to seal the Diwata centuries ago.',
          'If the seal is broken, maybe we can restore it. But you\'d need to find all three relics.',
          'The amulet is said to be in a cave in the deep jungle. The shell was kept by the fishermen at the cove.',
          'The sacred flame... legends say it burns eternal in the heart of the mangrove swamp. Be careful.'
        ],
        next: 'waiting'
      },
      waiting: {
        speaker: 'Maria - Village Leader',
        lines: [
          'Have you found the relics? The attacks are getting worse. Please hurry.',
          'Stay safe out there. The jungle is most dangerous at night.'
        ],
      }
    }
  },
  tomas: {
    name: 'Tomas',
    title: 'Village Healer',
    position: [55, 0, 25],
    color: 0x888866,
    hp: 60, damage: 5, attackRange: 2, attackSpeed: 2.0, zoneRadius: 20,
    combatStyle: 'healer', // heals player when nearby during combat
    callouts: {
      enemySpotted: ['Creatures! Stay close, I\'ll tend your wounds!', 'They\'re here again... be careful!'],
      attacking: ['Back! Get back!', 'Leave us alone!'],
      playerHurt: ['You\'re wounded! Come closer, let me help!', 'Hold still, I can heal you!'],
      enemyKilled: ['Good, one less to worry about.'],
      downed: ['My old bones... can\'t take much more...'],
      revived: ['The herbs... they worked. I can continue.'],
      healing: ['Let me treat those wounds.', 'Hold on, I\'ll patch you up.'],
    },
    dialogues: {
      initial: {
        speaker: 'Tomas - Village Healer',
        lines: [
          'Ah, a new face. I am Tomas, the village healer. Or what\'s left of one.',
          'My medicines are running low. The wounded need halamang gamot - medicinal herbs.',
          'They grow wild in the jungle, green plants with a faint glow. Could you gather some for me?',
          'Be careful in the jungle. The Tikbalang roams there - a horse-demon as tall as a tree.'
        ],
        onComplete: 'talk_tomas',
        next: 'waiting_herbs'
      },
      waiting_herbs: {
        speaker: 'Tomas - Village Healer',
        lines: [
          'Have you found the herbs yet? Look for glowing green plants in the jungle.',
          'The deeper you go, the more you\'ll find. But also more danger...'
        ],
        checkCondition: { event: 'collect_herbs', required: 5, nextIfMet: 'herbs_done' },
      },
      herbs_done: {
        speaker: 'Tomas - Village Healer',
        lines: [
          'Wonderful! These herbs will save lives. Here, take this antidote recipe.',
          'I\'ve been making these for years. Mix herbs with buko juice and you get a powerful healing potion.',
          'Come back if you need healing. I\'ll do what I can.'
        ],
        onComplete: 'talk_tomas_herbs',
      }
    }
  },
  pedro: {
    name: 'Pedro',
    title: 'Fisherman',
    position: [72, 0, -48],
    color: 0x6688AA,
    hp: 80, damage: 18, attackRange: 2, attackSpeed: 1.2, zoneRadius: 22,
    combatStyle: 'melee', // tough fighter with improvised weapons
    callouts: {
      enemySpotted: ['Punyeta! More of them!', 'Here they come again!'],
      attacking: ['Take that!', 'Try me, ugly!', 'Come on!'],
      playerHurt: ['Don\'t let them surround you!', 'Stay near me, I\'ll cover you!'],
      enemyKilled: ['Ha! Not so tough now!', 'Stay down!'],
      downed: ['Argh... go on without me...'],
      revived: ['Alright... I can still fight.'],
    },
    dialogues: {
      initial: {
        speaker: 'Pedro - Fisherman',
        lines: [
          'Hey! You shouldn\'t be out here alone. I\'m Pedro, I used to fish these waters.',
          'Something\'s in the water now. The cove is full of those... things. Tiyanak, they call them.',
          'I can\'t get to my boat. If you clear them out, I\'ll give you something useful.',
          'I\'ve got a sumpak hidden in my shack. Improvised shotgun. Packs a punch.'
        ],
        onComplete: 'talk_pedro',
        next: 'waiting'
      },
      waiting: {
        speaker: 'Pedro - Fisherman',
        lines: [
          'The cove is still dangerous. Clear out those creatures and come find me.',
          'My sumpak is yours if you do. It\'s saved my life more than once.'
        ],
        checkCondition: { event: 'kill_cove_enemy', required: 5, nextIfMet: 'done' },
      },
      done: {
        speaker: 'Pedro - Fisherman',
        lines: [
          'You did it! The cove is clear. Here, take the sumpak as promised.',
          'Oh, and I found something strange on the beach. A shell that glows in the dark.',
          'Might be one of those sacred things the elders talk about. You take it.'
        ],
        onComplete: 'talk_pedro_done',
      }
    }
  },
  lena: {
    name: 'Lena',
    title: 'Resort Manager',
    position: [-6, 0, -2],
    color: 0xBB7766,
    hp: 50, damage: 8, attackRange: 2, attackSpeed: 1.8, zoneRadius: 18,
    combatStyle: 'scared', // fights only when cornered
    callouts: {
      enemySpotted: ['Oh god, they\'re here!', 'No no no... not again!'],
      attacking: ['Stay away from me!', 'Get back!'],
      playerHurt: ['Be careful!', 'Watch out!'],
      enemyKilled: ['Is it... is it dead?', 'Thank god...'],
      downed: ['Help... someone help...'],
      revived: ['I\'m okay... I think...'],
    },
    dialogues: {
      initial: {
        speaker: 'Lena - Former Resort Manager',
        lines: [
          'Oh thank god, I thought I was the only one left at the resort.',
          'I\'m Lena. I managed this place before... before everything went to hell.',
          'The guests... most didn\'t make it. I hid in the supply closet for two days.',
          'There should be a kitchen knife somewhere in the restaurant. Better than bare hands.',
          'If you head east along the coast, there\'s a fishing village. Maybe more survivors there.'
        ],
        onComplete: 'talk_lena',
        giveWeapon: {
          id: 'kitchen_knife', name: 'Kitchen Knife', icon: '\u{1F52A}',
          damage: 12, speed: 0.3, range: 2, durability: 50, maxDurability: 50,
          type: 'melee', heavy: 20, desc: 'A kitchen knife from the resort. Fast but fragile.',
          staminaCost: 6, heavyStaminaCost: 15
        },
        next: 'waiting'
      },
      waiting: {
        speaker: 'Lena - Former Resort Manager',
        lines: [
          'Be careful out there. I\'ll stay here and try to barricade this place.',
          'If you find any supplies, I could use some food and water...'
        ],
      }
    }
  }
};

function createNPCModel(def) {
  const group = new THREE.Group();
  const mL = (c) => new THREE.MeshLambertMaterial({ color: c });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25), mL(def.color));
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mL(0xDEB887));
  head.position.y = 1.35;
  group.add(head);

  // Hair
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), mL(0x1a1a1a));
  hair.position.y = 1.4;
  hair.scale.set(1, 0.7, 1);
  group.add(hair);

  // Arms (tagged for animation)
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mL(0xDEB887));
    arm.position.set(side * 0.28, 0.85, 0);
    arm.userData.isArm = true;
    arm.userData.side = side;
    group.add(arm);
  }

  // Weapon in right hand
  if (def.combatStyle === 'melee') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.06), mL(0xaaaaaa));
    blade.position.set(0.28, 0.55, 0.1);
    blade.rotation.x = -0.3;
    blade.userData.isWeapon = true;
    group.add(blade);
  } else if (def.combatStyle === 'healer') {
    // Staff
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), mL(0x886633));
    staff.position.set(0.28, 0.65, 0.05);
    staff.userData.isWeapon = true;
    group.add(staff);
    // Staff glow
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
    orb.position.set(0.28, 0.98, 0.05);
    group.add(orb);
  }

  // Legs
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), mL(0x4a3520));
    leg.position.set(side * 0.1, 0.4, 0);
    group.add(leg);
  }

  // Name + health bar label (sprite)
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#ffcc44';
  ctx.textAlign = 'center';
  ctx.fillText(def.name, 128, 20);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#aa8855';
  ctx.fillText(def.title, 128, 38);
  // Health bar bg
  ctx.fillStyle = '#333333';
  ctx.fillRect(48, 46, 160, 8);
  // Health bar fill (green for allies)
  ctx.fillStyle = '#44cc44';
  ctx.fillRect(48, 46, 160, 8);
  ctx.strokeStyle = '#666666';
  ctx.strokeRect(48, 46, 160, 8);

  const labelTex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
  label.position.y = 2;
  label.scale.set(2, 0.5, 1);
  label.userData.isLabel = true;
  label.userData.canvas = canvas;
  label.userData.texture = labelTex;
  group.add(label);

  return group;
}

export class NPCManager {
  constructor(game) {
    this.game = game;
    this.npcs = {};
    this.currentDialogue = null;
    this.dialogueIndex = 0;
    this.calloutCooldown = 0; // global cooldown so callouts don't spam
  }

  spawnNPCs() {
    for (const [id, def] of Object.entries(NPC_DEFS)) {
      const model = createNPCModel(def);
      const [x, , z] = def.position;
      const gy = getTerrainHeightFast(x, z);
      model.position.set(x, gy, z);

      model.userData = {
        interactable: true,
        type: 'npc',
        npcId: id,
        promptText: `Press E - Talk to ${def.name}`
      };

      this.game.scene.add(model);
      this.game.interactables.push(model);
      this.npcs[id] = {
        def,
        model,
        dialogueState: 'initial',
        talked: false,
        // Combat state
        hp: def.hp,
        maxHp: def.hp,
        homePos: new THREE.Vector3(x, gy, z),
        combatState: 'idle', // idle, alert, fighting, returning, downed
        target: null,
        attackCooldown: 0,
        calloutTimer: 0,
        downedTimer: 0,
        animTime: 0,
        healCooldown: 0,
      };
    }
  }

  callout(npc, type) {
    if (this.calloutCooldown > 0) return;
    const lines = npc.def.callouts[type];
    if (!lines || lines.length === 0) return;
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.game.ui.addMessage(`${npc.def.name}: "${line}"`, 'npc');
    this.calloutCooldown = 4;
    npc.calloutTimer = 6;

    // Play sound based on callout type
    const audio = this.game.audioManager;
    if (type === 'enemySpotted' || type === 'playerHurt') audio.playNPCShout();
    else if (type === 'attacking') audio.playNPCAttack();
    else if (type === 'enemyKilled') audio.playNPCKillCheer();
    else if (type === 'downed') audio.playNPCDowned();
    else if (type === 'revived') audio.playNPCRevive();
    else if (type === 'healing') audio.playNPCHeal();
  }

  updateHealthBar(npc) {
    const label = npc.model.children.find(c => c.userData && c.userData.isLabel);
    if (!label) return;
    const canvas = label.userData.canvas;
    const ctx = canvas.getContext('2d');
    const hpPct = Math.max(0, npc.hp / npc.maxHp);

    ctx.clearRect(0, 42, 256, 22);
    ctx.fillStyle = '#333333';
    ctx.fillRect(48, 46, 160, 8);
    const barColor = hpPct > 0.5 ? '#44cc44' : hpPct > 0.25 ? '#ccaa00' : '#cc4400';
    ctx.fillStyle = barColor;
    ctx.fillRect(48, 46, 160 * hpPct, 8);
    ctx.strokeStyle = '#666666';
    ctx.strokeRect(48, 46, 160, 8);

    label.userData.texture.needsUpdate = true;
  }

  damageNPC(npc, damage, attackerName) {
    if (npc.combatState === 'downed') return;
    npc.hp -= damage;
    this.updateHealthBar(npc);
    this.game.ui.addMessage(`${attackerName} hits ${npc.def.name} for ${damage}!`, 'combat');

    this.game.audioManager.playNPCHurt();

    if (npc.hp <= 0) {
      npc.hp = 0;
      npc.combatState = 'downed';
      npc.downedTimer = 20; // 20 seconds to recover
      npc.target = null;
      this.callout(npc, 'downed');
      // Visual: slump over
      npc.model.rotation.x = 0.8;
      npc.model.position.y -= 0.3;
      // Remove from interactables temporarily
      npc.model.userData.promptText = `${npc.def.name} is down...`;
    }
  }

  findNearestEnemy(npc) {
    let nearest = null;
    let nearestDist = npc.def.zoneRadius;
    for (const e of this.game.enemyManager.enemies) {
      if (e.state === 'dead') continue;
      const dx = e.model.position.x - npc.model.position.x;
      const dz = e.model.position.z - npc.model.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < nearestDist) {
        nearest = e;
        nearestDist = dist;
      }
    }
    return { enemy: nearest, dist: nearestDist };
  }

  update(dt) {
    const playerPos = this.game.camera.position;
    this.calloutCooldown = Math.max(0, this.calloutCooldown - dt);

    for (const npc of Object.values(this.npcs)) {
      npc.animTime += dt;
      npc.attackCooldown -= dt;
      npc.calloutTimer -= dt;
      if (npc.healCooldown > 0) npc.healCooldown -= dt;

      // --- DOWNED STATE ---
      if (npc.combatState === 'downed') {
        npc.downedTimer -= dt;
        if (npc.downedTimer <= 0) {
          // Revive
          npc.combatState = 'idle';
          npc.hp = Math.floor(npc.maxHp * 0.5);
          npc.model.rotation.x = 0;
          const gy = getTerrainHeightFast(npc.homePos.x, npc.homePos.z);
          npc.model.position.set(npc.homePos.x, gy, npc.homePos.z);
          npc.model.userData.promptText = `Press E - Talk to ${npc.def.name}`;
          this.updateHealthBar(npc);
          this.callout(npc, 'revived');
        }
        continue;
      }

      // --- Find threats ---
      const { enemy: nearestEnemy, dist: enemyDist } = this.findNearestEnemy(npc);

      // --- COMBAT AI ---
      if (nearestEnemy && npc.combatState !== 'downed') {
        const wasIdle = npc.combatState === 'idle' || npc.combatState === 'returning';

        if (wasIdle && npc.calloutTimer <= 0) {
          this.callout(npc, 'enemySpotted');
        }

        npc.combatState = 'fighting';
        npc.target = nearestEnemy;

        // Scared NPCs only fight if enemy is very close
        if (npc.def.combatStyle === 'scared' && enemyDist > 8) {
          npc.combatState = 'alert';
        }

        if (npc.combatState === 'fighting') {
          const ex = nearestEnemy.model.position.x - npc.model.position.x;
          const ez = nearestEnemy.model.position.z - npc.model.position.z;

          // Face enemy
          npc.model.rotation.y = Math.atan2(ex, ez);

          // Move toward enemy (but stay within zone)
          const homeDistX = npc.model.position.x - npc.homePos.x;
          const homeDistZ = npc.model.position.z - npc.homePos.z;
          const homeDist = Math.sqrt(homeDistX * homeDistX + homeDistZ * homeDistZ);

          if (enemyDist > npc.def.attackRange && homeDist < npc.def.zoneRadius) {
            const moveSpeed = 2.5 * dt;
            npc.model.position.x += (ex / enemyDist) * moveSpeed;
            npc.model.position.z += (ez / enemyDist) * moveSpeed;
            const gy = getTerrainHeightFast(npc.model.position.x, npc.model.position.z);
            npc.model.position.y = gy;

            // Walk animation
            npc.model.children.forEach(c => {
              if (c.userData.isArm) {
                c.rotation.x = Math.sin(npc.animTime * 5 + c.userData.side) * 0.6;
              }
            });
          }

          // Attack!
          if (enemyDist <= npc.def.attackRange && npc.attackCooldown <= 0) {
            npc.attackCooldown = npc.def.attackSpeed;

            // Attack animation - swing arm forward
            npc.model.children.forEach(c => {
              if (c.userData.isWeapon || (c.userData.isArm && c.userData.side > 0)) {
                c.rotation.x = -1.2;
                setTimeout(() => { if (c) c.rotation.x = 0; }, 200);
              }
            });

            // Deal damage
            this.game.enemyManager.damageEnemy(nearestEnemy, npc.def.damage);
            this.game.audioManager.playNPCAttack();
            if (npc.calloutTimer <= 0) this.callout(npc, 'attacking');

            // Check if enemy died from this hit
            if (nearestEnemy.hp <= 0 && npc.calloutTimer <= 0) {
              this.callout(npc, 'enemyKilled');
            }
          }
        }

        // Healer special: heal player when nearby
        if (npc.def.combatStyle === 'healer' && npc.healCooldown <= 0) {
          const px = playerPos.x - npc.model.position.x;
          const pz = playerPos.z - npc.model.position.z;
          const playerDist = Math.sqrt(px * px + pz * pz);
          if (playerDist < 8 && this.game.player.hp < this.game.player.maxHp * 0.7) {
            const healAmount = 8;
            this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + healAmount);
            npc.healCooldown = 10;
            if (npc.calloutTimer <= 0) this.callout(npc, 'healing');
            this.game.ui.addMessage(`${npc.def.name} heals you for ${healAmount} HP!`, 'heal');
          }
        }

        // Warn player when they take damage
        if (this.game.player.lastDamageTime && Date.now() - this.game.player.lastDamageTime < 500) {
          const px = playerPos.x - npc.model.position.x;
          const pz = playerPos.z - npc.model.position.z;
          const playerDist = Math.sqrt(px * px + pz * pz);
          if (playerDist < 20 && npc.calloutTimer <= 0) {
            this.callout(npc, 'playerHurt');
          }
        }

      } else {
        // --- NO ENEMIES NEARBY ---
        if (npc.combatState === 'fighting' || npc.combatState === 'alert') {
          npc.combatState = 'returning';
          npc.target = null;
        }

        // Return to home position
        if (npc.combatState === 'returning') {
          const hx = npc.homePos.x - npc.model.position.x;
          const hz = npc.homePos.z - npc.model.position.z;
          const hDist = Math.sqrt(hx * hx + hz * hz);
          if (hDist > 0.5) {
            npc.model.rotation.y = Math.atan2(hx, hz);
            npc.model.position.x += (hx / hDist) * 2 * dt;
            npc.model.position.z += (hz / hDist) * 2 * dt;
            const gy = getTerrainHeightFast(npc.model.position.x, npc.model.position.z);
            npc.model.position.y = gy;
          } else {
            npc.combatState = 'idle';
          }
        }

        // Face player when close and idle
        if (npc.combatState === 'idle') {
          const dx = playerPos.x - npc.model.position.x;
          const dz = playerPos.z - npc.model.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 10) {
            const targetRot = Math.atan2(dx, dz);
            npc.model.rotation.y += (targetRot - npc.model.rotation.y) * 0.05;
          }
          // Reset arm animation
          npc.model.children.forEach(c => {
            if (c.userData.isArm) c.rotation.x = 0;
          });
        }
      }

      // Passive health regen when out of combat
      if (npc.combatState === 'idle' && npc.hp < npc.maxHp) {
        npc.hp = Math.min(npc.maxHp, npc.hp + dt * 2);
        this.updateHealthBar(npc);
      }

      // Idle bob
      if (npc.combatState === 'idle') {
        const gy = getTerrainHeightFast(npc.model.position.x, npc.model.position.z);
        npc.model.position.y = gy + Math.sin(Date.now() * 0.002) * 0.01;
      }
    }
  }

  talkTo(npcId) {
    const npc = this.npcs[npcId];
    if (!npc) return;

    // Check if current dialogue has a condition to auto-advance
    let dialogueKey = npc.dialogueState;
    const currentDialogue = npc.def.dialogues[dialogueKey];
    if (currentDialogue && currentDialogue.checkCondition) {
      const cond = currentDialogue.checkCondition;
      const count = this.game.questManager.eventCounters[cond.event] || 0;
      if (count >= cond.required) {
        npc.dialogueState = cond.nextIfMet;
        dialogueKey = cond.nextIfMet;
      }
    }

    const dialogue = npc.def.dialogues[dialogueKey];
    if (!dialogue) return;

    this.currentDialogue = { npc, npcId, dialogue };
    this.dialogueIndex = 0;
    this.game.state = 7; // DIALOGUE
    this.game.controls.unlock();
    this.showDialogueLine();
  }

  showDialogueLine() {
    if (!this.currentDialogue) return;
    const { dialogue } = this.currentDialogue;
    const box = document.getElementById('dialogue-box');
    box.style.display = 'block';
    document.getElementById('dialogue-speaker').textContent = dialogue.speaker;
    document.getElementById('dialogue-text').textContent = dialogue.lines[this.dialogueIndex];
    document.getElementById('dialogue-options').innerHTML = '';

    const isLast = this.dialogueIndex >= dialogue.lines.length - 1;
    document.getElementById('dialogue-continue').textContent =
      isLast ? 'Click or press E to close' : 'Click or press E to continue';
  }

  advanceDialogue() {
    if (!this.currentDialogue) return;
    const { npc, npcId, dialogue } = this.currentDialogue;
    this.dialogueIndex++;

    if (this.dialogueIndex >= dialogue.lines.length) {
      // Dialogue complete
      document.getElementById('dialogue-box').style.display = 'none';

      // Trigger events
      if (dialogue.onComplete) {
        this.game.questManager.triggerEvent(dialogue.onComplete);
      }

      // Give weapon
      if (dialogue.giveWeapon) {
        this.game.player.addWeapon({ ...dialogue.giveWeapon });
        this.game.questManager.triggerEvent('pickup_weapon');
      }

      // Unlock quests
      if (dialogue.unlockQuests) {
        for (const qid of dialogue.unlockQuests) {
          this.game.questManager.activateQuest(qid);
        }
      }

      // Advance dialogue state
      if (dialogue.next) {
        npc.dialogueState = dialogue.next;
      }
      npc.talked = true;

      this.currentDialogue = null;
      this.game.state = 2; // PLAYING
      this.game.controls.lock();
    } else {
      this.showDialogueLine();
    }
  }
}
