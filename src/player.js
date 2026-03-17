import * as THREE from 'three';
import { getTerrainHeightFast, REGIONS } from './world.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.hp = 100; this.maxHp = 100;
    this.stamina = 100; this.maxStamina = 100;
    this.xp = 0; this.xpToLevel = 100;
    this.level = 1;
    this.speed = 6; this.sprintSpeed = 10;
    this.attackPower = 1.0;
    this.defense = 0;

    // Inventory
    this.weapons = [];
    this.currentWeaponIdx = 0;
    this.consumables = {};
    this.materials = {};
    this.gold = 0;

    // Armor
    this.armor = null; // { id, name, icon, defense, durability, maxDurability, desc }
    this.baseDefense = 0;

    // Skills (must be purchased from Espiritista NPC — start locked)
    this.skills = [
      { id: 'battle_cry', name: 'Battle Cry', icon: '\u{1F4E2}', key: 'Q',
        desc: 'Stun nearby enemies for 2 seconds.',
        cooldown: 0, maxCooldown: 18, staminaCost: 15, cost: 25, owned: false },
      { id: 'heal', name: 'Healing Wave', icon: '\u{1F49A}', key: 'F',
        desc: 'Restore 35 HP instantly.',
        cooldown: 0, maxCooldown: 22, staminaCost: 20, cost: 40, owned: false },
      { id: 'fire_strike', name: 'Fire Strike', icon: '\u{1F525}', key: 'V',
        desc: 'Blast nearby enemies with fire for 25 damage.',
        cooldown: 0, maxCooldown: 28, staminaCost: 30, cost: 60, owned: false },
      { id: 'shadow_step', name: 'Shadow Step', icon: '\u{1F300}', key: 'X',
        desc: 'Become invincible and move faster for 3 seconds.',
        cooldown: 0, maxCooldown: 40, staminaCost: 25, cost: 80, owned: false },
    ];

    // Movement
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.canJump = true;
    this.onGround = true;
    this.vertVelocity = 0;

    // Pre-allocated vectors for per-frame movement (avoid GC pressure)
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._move = new THREE.Vector3();
    this._newPos = new THREE.Vector3();
    this._slidePos = new THREE.Vector3();

    // Combat
    this.attackCooldown = 0;
    this.invincible = 0;
    this.weaponSwing = 0;
    this.weaponMesh = null;

    this.initWeapons();
    this.createWeaponModel();
  }

  initWeapons() {
    this.weapons = [
      {
        id: 'paddle', name: 'Paddle', icon: '\u{1F3CF}',
        damage: 8, speed: 0.5, range: 2.5, durability: 80, maxDurability: 80,
        type: 'melee', heavy: 14, desc: 'A wooden paddle from the resort. Better than nothing.',
        staminaCost: 8, heavyStaminaCost: 20
      }
    ];
  }

  get weapon() { return this.weapons[this.currentWeaponIdx]; }

  switchWeapon(idx) {
    if (idx < this.weapons.length) {
      this.currentWeaponIdx = idx;
      this.updateWeaponModel();
      this.game.ui.updateWeaponDisplay();
    }
  }

  addWeapon(weapon) {
    if (this.weapons.length < 5) {
      this.weapons.push(weapon);
      this.game.ui.addMessage(`Picked up ${weapon.name}`, 'loot');
      this.game.questManager.triggerEvent('pickup_weapon');
      return true;
    }
    this.game.ui.addMessage('Weapon slots full (5 max)', 'system');
    return false;
  }

  addItem(id, count = 1) {
    const cat = this.getItemCategory(id);
    if (cat === 'consumable') {
      this.consumables[id] = (this.consumables[id] || 0) + count;
    } else {
      this.materials[id] = (this.materials[id] || 0) + count;
    }
  }

  removeItem(id, count = 1) {
    const cat = this.getItemCategory(id);
    const inv = cat === 'consumable' ? this.consumables : this.materials;
    if ((inv[id] || 0) >= count) {
      inv[id] -= count;
      if (inv[id] <= 0) delete inv[id];
      return true;
    }
    return false;
  }

  hasItem(id, count = 1) {
    return (this.consumables[id] || 0) + (this.materials[id] || 0) >= count;
  }

  buySkill(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return false;
    if (skill.owned) {
      this.game.ui.addMessage(`You already know ${skill.name}.`, 'system');
      return false;
    }
    if (this.gold < skill.cost) {
      this.game.ui.addMessage(`Not enough gold! ${skill.name} costs ${skill.cost} gold.`, 'system');
      return false;
    }
    this.gold -= skill.cost;
    skill.owned = true;
    this.game.ui.addMessage(`Learned ${skill.name}! Press ${skill.key} to use it.`, 'quest');
    this.game.audioManager.playQuestComplete();
    return true;
  }

  equipArmor(armor) {
    if (this.armor) this.unequipArmor();
    this.armor = armor;
    this.defense = this.baseDefense + armor.defense;
    this.game.ui.addMessage(`Equipped ${armor.name} (+${armor.defense} DEF)`, 'loot');
  }

  unequipArmor() {
    if (!this.armor) return;
    this.defense = this.baseDefense;
    this.game.ui.addMessage(`Unequipped ${this.armor.name}`, 'system');
    this.armor = null;
  }

  useSkill(skillIdx) {
    const skill = this.skills[skillIdx];
    if (!skill || !skill.owned) {
      this.game.ui.addMessage('Skill not learned! Visit the Espiritista to buy skills.', 'system');
      return;
    }
    if (skill.cooldown > 0) {
      this.game.ui.addMessage(`${skill.name} on cooldown (${Math.ceil(skill.cooldown)}s)`, 'system');
      return;
    }
    if (this.stamina < skill.staminaCost) {
      this.game.ui.addMessage('Not enough stamina!', 'system');
      return;
    }

    this.stamina -= skill.staminaCost;
    skill.cooldown = skill.maxCooldown;

    switch (skill.id) {
      case 'battle_cry': {
        this.game.ui.addMessage('You let out a terrifying war cry!', 'combat');
        this.game.audioManager.playNPCShout();
        this.game.cameraShake = 0.4;
        // Stun all enemies within 12 units for 2 seconds
        const pos = this.game.camera.position;
        for (const e of this.game.enemyManager.enemies) {
          if (e.state === 'dead') continue;
          const dx = e.model.position.x - pos.x;
          const dz = e.model.position.z - pos.z;
          if (Math.sqrt(dx * dx + dz * dz) < 12) {
            e.stunTimer = 2;
            e.state = 'idle';
          }
        }
        break;
      }
      case 'heal': {
        const healAmt = 35 + this.level * 3;
        this.heal(healAmt);
        this.game.ui.addMessage(`Healing Wave! +${healAmt} HP`, 'heal');
        this.game.audioManager.playNPCHeal();
        break;
      }
      case 'fire_strike': {
        const dmg = 25 + this.level * 2;
        this.game.ui.addMessage(`Fire Strike! ${dmg} damage to nearby enemies!`, 'combat');
        this.game.audioManager.playHit();
        this.game.cameraShake = 0.6;
        this.game.enemyManager.aoeHit(this.game.camera.position, 8, dmg);
        break;
      }
      case 'shadow_step': {
        this.invincible = 3;
        this.speed = 10;
        this.sprintSpeed = 15;
        this.game.ui.addMessage('Shadow Step! You move like a phantom...', 'quest');
        setTimeout(() => {
          this.speed = 6;
          this.sprintSpeed = 10;
          this.game.ui.addMessage('Shadow Step fades.', 'system');
        }, 3000);
        break;
      }
    }
  }

  getItemCategory(id) {
    const consumables = ['coconut', 'buko_juice', 'adobo', 'herbs', 'bandage', 'energy_drink', 'antidote', 'molotov'];
    return consumables.includes(id) ? 'consumable' : 'material';
  }

  useConsumable(id) {
    if (!this.consumables[id] || this.consumables[id] <= 0) return;
    const effects = {
      coconut: { hp: 10, stamina: 20 },
      buko_juice: { hp: 5, stamina: 40 },
      adobo: { hp: 25, stamina: 15 },
      herbs: { hp: 40 },
      bandage: { hp: 30 },
      energy_drink: { stamina: 80 },
      antidote: { hp: 15, cure: true },
      molotov: { aoe: true }
    };
    const e = effects[id];
    if (!e) return;
    // Molotov: area damage around player
    if (e.aoe) {
      this.consumables[id]--;
      if (this.consumables[id] <= 0) delete this.consumables[id];
      this.game.ui.addMessage('You throw a Molotov cocktail!', 'combat');
      const pos = this.game.camera.position;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.game.camera.quaternion);
      const hitPos = pos.clone().add(dir.multiplyScalar(5));
      this.game.enemyManager.aoeHit(hitPos, 6, 35);
      return;
    }
    this.consumables[id]--;
    if (this.consumables[id] <= 0) delete this.consumables[id];
    if (e.hp) this.heal(e.hp);
    if (e.stamina) this.stamina = Math.min(this.maxStamina, this.stamina + e.stamina);
    this.game.ui.addMessage(`Used ${id.replace(/_/g, ' ')}`, 'loot');
  }

  createWeaponModel() {
    const group = new THREE.Group();
    group.position.set(0.35, -0.35, -0.5);
    group.rotation.z = -0.3;
    this.weaponMesh = group;
    this.game.camera.add(group);
    this.buildWeaponGeometry();
  }

  buildWeaponGeometry() {
    while (this.weaponMesh.children.length) this.weaponMesh.remove(this.weaponMesh.children[0]);
    const w = this.weapon;
    const std = (color, metal = 0, rough = 0.6) =>
      new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
    const glow = (color, emissive, intensity = 0.3) =>
      new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3, emissive, emissiveIntensity: intensity });
    const add = (geo, mat, pos, rot) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      this.weaponMesh.add(m);
      return m;
    };

    switch (w.id) {
      case 'paddle': {
        // Flat wooden paddle blade with rounded top
        add(new THREE.BoxGeometry(0.08, 0.3, 0.015), std(0x8B7355), [0, -0.05, 0]);
        add(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 8), std(0x8B7355), [0, 0.1, 0], [Math.PI / 2, 0, 0]);
        // Handle
        add(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 6), std(0x5C3A1E), [0, -0.34, 0]);
        // Grip wrap
        add(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6), std(0x333333), [0, -0.42, 0]);
        break;
      }
      case 'kitchen_knife': {
        // Triangular blade
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.lineTo(0.035, -0.22); shape.lineTo(-0.005, -0.25); shape.lineTo(-0.005, 0);
        add(new THREE.ExtrudeGeometry(shape, { depth: 0.004, bevelEnabled: false }), std(0xCCCCCC, 0.8, 0.2), [0, 0, -0.002]);
        // Guard
        add(new THREE.BoxGeometry(0.05, 0.012, 0.014), std(0x888888, 0.5), [0, 0.01, 0]);
        // Handle with rivets
        add(new THREE.BoxGeometry(0.028, 0.13, 0.016), std(0x1a0a00), [0, 0.08, 0]);
        for (const dy of [0.04, 0.1]) add(new THREE.SphereGeometry(0.004, 4, 4), std(0x999999), [0, dy, 0.01]);
        break;
      }
      case 'bolo': {
        // Curved machete blade
        const shape = new THREE.Shape();
        shape.moveTo(0, 0);
        shape.quadraticCurveTo(0.06, -0.12, 0.045, -0.28);
        shape.lineTo(0.01, -0.31);
        shape.quadraticCurveTo(0.02, -0.12, -0.005, 0);
        add(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }), std(0x999999, 0.7, 0.35), [0, 0, -0.003]);
        // Handle
        add(new THREE.CylinderGeometry(0.02, 0.018, 0.15, 6), std(0x4a3520), [0, 0.08, 0]);
        add(new THREE.SphereGeometry(0.022, 5, 4), std(0x3a2510), [0, 0.16, 0]);
        // Wrap
        for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.021, 0.003, 4, 6), std(0x222222), [0, 0.03 + i * 0.04, 0], [Math.PI / 2, 0, 0]);
        break;
      }
      case 'sumpak': {
        // Improvised shotgun - barrel
        add(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 6), std(0x555555, 0.6, 0.4), [0, 0, -0.2], [Math.PI / 2, 0, 0]);
        // Muzzle
        add(new THREE.RingGeometry(0.012, 0.022, 6), std(0x333333, 0.5), [0, 0, -0.4]);
        // Stock
        add(new THREE.BoxGeometry(0.04, 0.06, 0.2), std(0x5C3A1E), [0, -0.02, 0.1]);
        // Grip
        const grip = add(new THREE.BoxGeometry(0.03, 0.1, 0.04), std(0x4a3520), [0, -0.06, 0.05]);
        grip.rotation.x = 0.3;
        // Duct tape
        add(new THREE.CylinderGeometry(0.027, 0.027, 0.04, 6), std(0x777777), [0, 0, -0.05], [Math.PI / 2, 0, 0]);
        // Trigger guard
        add(new THREE.TorusGeometry(0.02, 0.003, 4, 6), std(0x666666, 0.4), [0, -0.035, 0], [0, 0, 0]);
        break;
      }
      case 'reinforced_paddle': {
        add(new THREE.BoxGeometry(0.08, 0.3, 0.015), std(0x8B7355), [0, -0.05, 0]);
        // Metal plate
        add(new THREE.BoxGeometry(0.068, 0.2, 0.005), std(0x999999, 0.6), [0, -0.05, 0.01]);
        // Corner bolts
        for (const [bx, by] of [[-0.025, 0.03], [0.025, 0.03], [-0.025, -0.12], [0.025, -0.12]])
          add(new THREE.SphereGeometry(0.005, 4, 4), std(0x666666, 0.5), [bx, by, 0.015]);
        add(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 6), std(0x5C3A1E), [0, -0.34, 0]);
        add(new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6), std(0x333333), [0, -0.42, 0]);
        break;
      }
      case 'spiked_bat': {
        // Thick bat body
        add(new THREE.CylinderGeometry(0.035, 0.02, 0.4, 7), std(0x6B4226), [0, -0.1, 0]);
        add(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 6), std(0x222222), [0, -0.36, 0]);
        // Protruding nail spikes
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const h = -0.15 + (i % 3) * 0.07;
          const spike = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.06), std(0xAAAAAA, 0.7, 0.3));
          spike.position.set(Math.cos(angle) * 0.04, h, Math.sin(angle) * 0.04);
          spike.lookAt(new THREE.Vector3(Math.cos(angle) * 0.15, h, Math.sin(angle) * 0.15));
          this.weaponMesh.add(spike);
        }
        break;
      }
      case 'electro_blade': {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.quadraticCurveTo(0.06, -0.12, 0.045, -0.28);
        shape.lineTo(0.01, -0.31); shape.quadraticCurveTo(0.02, -0.12, -0.005, 0);
        add(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }),
          glow(0x4488FF, 0x1144aa, 0.4), [0, 0, -0.003]);
        // Wire wrapping
        for (let i = 0; i < 3; i++)
          add(new THREE.TorusGeometry(0.025, 0.003, 4, 8), std(0xAAAACC, 0.5), [0, -0.06 - i * 0.07, 0], [Math.PI / 2, 0, 0]);
        add(new THREE.CylinderGeometry(0.02, 0.018, 0.15, 6), std(0x4a3520), [0, 0.08, 0]);
        // Electric glow
        add(new THREE.SphereGeometry(0.12, 6, 4), new THREE.MeshBasicMaterial({ color: 0x2244ff, transparent: true, opacity: 0.08 }), [0, -0.1, 0]);
        break;
      }
      case 'poison_blade': {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.quadraticCurveTo(0.06, -0.12, 0.045, -0.28);
        shape.lineTo(0.01, -0.31); shape.quadraticCurveTo(0.02, -0.12, -0.005, 0);
        add(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }),
          glow(0x44AA44, 0x225522, 0.25), [0, 0, -0.003]);
        // Dripping poison
        for (let i = 0; i < 4; i++)
          add(new THREE.SphereGeometry(0.006 + i * 0.001, 4, 4),
            new THREE.MeshBasicMaterial({ color: 0x33ff33, transparent: true, opacity: 0.5 }),
            [0.04 - i * 0.01, -0.08 - i * 0.06, 0.005]);
        add(new THREE.CylinderGeometry(0.02, 0.018, 0.15, 6), std(0x4a3520), [0, 0.08, 0]);
        break;
      }
      case 'enchanted_bolo': {
        const shape = new THREE.Shape();
        shape.moveTo(0, 0); shape.quadraticCurveTo(0.06, -0.12, 0.045, -0.28);
        shape.lineTo(0.01, -0.31); shape.quadraticCurveTo(0.02, -0.12, -0.005, 0);
        add(new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: false }),
          glow(0xBB77FF, 0x6633aa, 0.5), [0, 0, -0.003]);
        // Ethereal aura
        add(new THREE.SphereGeometry(0.14, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0x8844ff, transparent: true, opacity: 0.1 }), [0, -0.1, 0]);
        // Ornate handle with rune glow
        add(new THREE.CylinderGeometry(0.022, 0.018, 0.15, 6), glow(0x3a2510, 0x442288, 0.15), [0, 0.08, 0]);
        add(new THREE.SphereGeometry(0.025, 6, 4), glow(0x9966FF, 0x6633CC, 0.4), [0, 0.16, 0]);
        break;
      }
      default: {
        add(new THREE.BoxGeometry(0.06, 0.4, 0.02), std(0x8B7355), [0, -0.1, 0]);
        add(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), std(0x4a3520), [0, -0.38, 0]);
        break;
      }
    }
  }

  updateWeaponModel() {
    if (!this.weaponMesh) return;
    this.buildWeaponGeometry();
  }

  update(dt) {
    const cam = this.game.camera;
    const keys = this.game.keys;
    const sprinting = keys['ShiftLeft'] && this.stamina > 10;
    const exhausted = this.stamina < this.maxStamina * 0.1;

    // Movement speed affected by stamina
    let moveSpeed;
    if (sprinting) {
      moveSpeed = this.sprintSpeed;
    } else if (exhausted) {
      // Exhausted: reduced to 60% walk speed
      moveSpeed = this.speed * 0.6;
    } else {
      moveSpeed = this.speed;
    }

    // Stamina regen/drain
    if (sprinting && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])) {
      this.stamina = Math.max(0, this.stamina - 20 * dt);
    } else {
      // Regen slower when exhausted (recovery penalty)
      const regenRate = exhausted ? 8 : 15;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
    }

    // Exhaustion visual + message
    const staminaOverlay = document.getElementById('stamina-overlay');
    if (staminaOverlay) {
      staminaOverlay.style.opacity = exhausted ? 0.6 : 0;
    }
    if (exhausted && !this._wasExhausted) {
      this.game.ui.addMessage('You\'re exhausted! Movement slowed...', 'system');
    }
    this._wasExhausted = exhausted;

    // Movement
    this.direction.set(0, 0, 0);
    if (keys['KeyW']) this.direction.z -= 1;
    if (keys['KeyS']) this.direction.z += 1;
    if (keys['KeyA']) this.direction.x -= 1;
    if (keys['KeyD']) this.direction.x += 1;
    this.direction.normalize();

    // Apply movement in camera direction (reuse pre-allocated vectors)
    cam.getWorldDirection(this._forward);
    this._forward.y = 0; this._forward.normalize();
    this._right.crossVectors(this._forward, this._up);

    this._move.set(0, 0, 0);
    this._move.addScaledVector(this._forward, -this.direction.z * moveSpeed * dt);
    this._move.addScaledVector(this._right, this.direction.x * moveSpeed * dt);

    // Collision check
    this._newPos.copy(cam.position).add(this._move);
    if (this.checkCollision(this._newPos)) {
      // Try sliding along walls
      this._slidePos.set(cam.position.x + this._move.x, cam.position.y, cam.position.z);
      if (!this.checkCollision(this._slidePos)) cam.position.copy(this._slidePos);
      else {
        this._slidePos.set(cam.position.x, cam.position.y, cam.position.z + this._move.z);
        if (!this.checkCollision(this._slidePos)) cam.position.copy(this._slidePos);
      }
    } else {
      cam.position.copy(this._newPos);
    }

    // Gravity & ground
    this.vertVelocity -= 20 * dt;
    cam.position.y += this.vertVelocity * dt;
    const groundH = this.getGroundHeight(cam.position.x, cam.position.z);
    if (cam.position.y < groundH + 1.7) {
      cam.position.y = groundH + 1.7;
      this.vertVelocity = 0;
      this.onGround = true;
    }

    // Jump
    if (keys['Space'] && this.onGround) {
      this.vertVelocity = 7;
      this.onGround = false;
    }

    // Keep in bounds
    const bounds = 145;
    cam.position.x = THREE.MathUtils.clamp(cam.position.x, -bounds, bounds);
    cam.position.z = THREE.MathUtils.clamp(cam.position.z, -bounds, bounds);

    // Attack cooldown
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.invincible > 0) this.invincible -= dt;

    // Skill cooldowns
    for (const skill of this.skills) {
      if (skill.cooldown > 0) skill.cooldown = Math.max(0, skill.cooldown - dt);
    }

    // Weapon + camera bob
    const moving = this.direction.length() > 0 && this.onGround;
    if (this.weaponMesh) {
      const bobSpeed = sprinting ? 12 : 7;
      const bobAmt = sprinting ? 0.04 : 0.02;
      if (moving) {
        this.weaponSwing += dt * bobSpeed;
        this.weaponMesh.position.y = -0.35 + Math.sin(this.weaponSwing) * bobAmt;
        this.weaponMesh.position.x = 0.35 + Math.cos(this.weaponSwing * 0.5) * bobAmt * 0.5;
      } else {
        // Idle breathing sway on weapon
        const idleSway = Math.sin(Date.now() * 0.0015) * 0.005;
        this.weaponMesh.position.y = -0.35 + idleSway;
        this.weaponMesh.position.x += (0.35 - this.weaponMesh.position.x) * 0.05;
      }

      // Weapon sway - lags behind camera rotation for natural feel
      if (!this._lastCamY) this._lastCamY = cam.rotation.y;
      if (!this._lastCamX) this._lastCamX = cam.rotation.x;
      const camDeltaY = cam.rotation.y - this._lastCamY;
      const camDeltaX = cam.rotation.x - this._lastCamX;
      this._lastCamY = cam.rotation.y;
      this._lastCamX = cam.rotation.x;
      // Apply sway with damping
      this._swayX = (this._swayX || 0) * 0.85 + camDeltaY * 2.0;
      this._swayY = (this._swayY || 0) * 0.85 + camDeltaX * 1.5;
      this.weaponMesh.position.x += THREE.MathUtils.clamp(this._swayX, -0.08, 0.08);
      this.weaponMesh.position.y += THREE.MathUtils.clamp(this._swayY, -0.06, 0.06);

      // Attack animation
      if (this.attackCooldown > this.weapon.speed * 0.5) {
        const t = (this.attackCooldown - this.weapon.speed * 0.5) / (this.weapon.speed * 0.5);
        this.weaponMesh.rotation.x = -t * 1.2;
        this.weaponMesh.position.z = -0.5 - t * 0.3;
      } else {
        this.weaponMesh.rotation.x *= 0.85;
        this.weaponMesh.position.z += (-0.5 - this.weaponMesh.position.z) * 0.1;
      }
    }

    // Camera head bob
    if (moving) {
      const headBobSpeed = sprinting ? 12 : 7;
      const headBobAmt = sprinting ? 0.035 : 0.02;
      cam.position.y += Math.sin(this.weaponSwing * 1.0) * headBobAmt * 0.3;
    }

    // Footstep sounds
    this.game.audioManager.updateFootsteps(dt, moving, sprinting, cam.position);

    // Update region
    this.updateRegion();
  }

  checkCollision(pos) {
    if (!this.game.colliders) return false;
    const playerBox = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(pos.x, pos.y - 0.85, pos.z),
      new THREE.Vector3(0.6, 1.7, 0.6)
    );
    for (const c of this.game.colliders) {
      if (playerBox.intersectsBox(c)) return true;
    }
    return false;
  }

  getGroundHeight(x, z) {
    let h = getTerrainHeightFast(x, z);
    // Check platforms (hut floors, etc.)
    const platforms = this.game.platforms;
    if (platforms) {
      const camY = this.game.camera.position.y - 1.7; // feet position
      for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i];
        if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) {
          // Only stand on platform if feet are above or near the surface
          if (camY >= p.top - 0.5) {
            h = Math.max(h, p.top);
          }
        }
      }
    }
    return h;
  }

  updateRegion() {
    const pos = this.game.camera.position;
    let region = 'The Wilderness';
    for (const r of REGIONS) {
      const dx = pos.x - r.center[0];
      const dz = pos.z - r.center[1];
      if (Math.sqrt(dx * dx + dz * dz) < r.radius) {
        region = r.name;
        break;
      }
    }
    const locEl = document.getElementById('location-display');
    if (locEl.textContent !== region) {
      locEl.textContent = region;
      this.game.questManager.triggerEvent('enter_' + region.toLowerCase().replace(/\s+/g, '_'));
    }
  }

  attack(heavy) {
    const w = this.weapon;
    if (this.attackCooldown > 0) return;
    const cost = heavy ? (w.heavyStaminaCost || 20) : (w.staminaCost || 8);
    if (this.stamina < cost) {
      this.game.ui.addMessage('Not enough stamina!', 'system');
      return;
    }
    this.stamina -= cost;
    this.attackCooldown = w.speed;
    const dmg = heavy ? (w.heavy || w.damage * 1.8) : w.damage;
    const finalDmg = Math.floor(dmg * this.attackPower);

    // Durability
    if (w.durability !== undefined) {
      w.durability -= heavy ? 2 : 1;
      if (w.durability <= 0) {
        this.game.ui.addMessage(`${w.name} broke!`, 'combat');
        this.weapons.splice(this.currentWeaponIdx, 1);
        if (this.weapons.length === 0) this.initWeapons();
        this.currentWeaponIdx = Math.min(this.currentWeaponIdx, this.weapons.length - 1);
        this.updateWeaponModel();
      }
      this.game.ui.updateWeaponDisplay();
    }

    // Hit detection
    const cam = this.game.camera;
    if (w.type === 'melee') {
      this.game.enemyManager.meleeHit(cam.position, cam.getWorldDirection(new THREE.Vector3()), w.range, finalDmg);
    } else {
      this.game.enemyManager.rangedHit(cam.position, cam.getWorldDirection(new THREE.Vector3()), w.range, finalDmg);
    }
  }

  takeDamage(amount, source) {
    if (this.invincible > 0) return;
    const reduced = Math.max(1, amount - this.defense);
    this.hp -= reduced;
    this.invincible = 0.3;
    this.lastDamageTime = Date.now();
    this.game.ui.flashDamage();
    this.game.cameraShake = Math.min(1, reduced / 20); // Shake intensity based on damage
    if (this.hp <= 0) {
      this.hp = 0;
      this.game.playerDeath(`Killed by ${source || 'the island'}`);
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  addXP(amount) {
    this.xp += amount;
    while (this.xp >= this.xpToLevel) {
      this.xp -= this.xpToLevel;
      this.level++;
      this.xpToLevel = Math.floor(this.xpToLevel * 1.4);
      this.maxHp += 10;
      this.hp = this.maxHp;
      this.maxStamina += 5;
      this.stamina = this.maxStamina;
      this.attackPower += 0.08;
      this.baseDefense += 1;
      this.defense = this.baseDefense + (this.armor ? this.armor.defense : 0);
      this.game.ui.addMessage(`Level up! You are now level ${this.level}`, 'quest');
    }
    document.getElementById('level-display').textContent = `Level ${this.level}`;
  }
}
