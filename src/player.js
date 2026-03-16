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

    // Movement
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.canJump = true;
    this.onGround = true;
    this.vertVelocity = 0;

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

  getItemCategory(id) {
    const consumables = ['coconut', 'buko_juice', 'adobo', 'herbs', 'bandage', 'energy_drink', 'antidote'];
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
      antidote: { hp: 15, cure: true }
    };
    const e = effects[id];
    if (!e) return;
    this.consumables[id]--;
    if (this.consumables[id] <= 0) delete this.consumables[id];
    if (e.hp) this.heal(e.hp);
    if (e.stamina) this.stamina = Math.min(this.maxStamina, this.stamina + e.stamina);
    this.game.ui.addMessage(`Used ${id.replace(/_/g, ' ')}`, 'loot');
  }

  createWeaponModel() {
    const group = new THREE.Group();
    // Simple weapon geometry
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.6 })
    );
    blade.position.set(0, -0.1, 0);
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 })
    );
    handle.position.set(0, -0.4, 0);
    group.add(blade, handle);
    group.position.set(0.35, -0.35, -0.5);
    group.rotation.z = -0.3;
    this.weaponMesh = group;
    this.game.camera.add(group);
  }

  updateWeaponModel() {
    if (!this.weaponMesh) return;
    const w = this.weapon;
    const mat = this.weaponMesh.children[0].material;
    const colors = {
      paddle: 0x8B7355, kitchen_knife: 0xC0C0C0, bolo: 0x888888,
      reinforced_paddle: 0x999999, spiked_bat: 0x884422,
      electro_blade: 0x4488FF, poison_blade: 0x44AA44,
      enchanted_bolo: 0xAA66FF,
      pipe: 0x666666, bat: 0x6B4226, sumpak: 0x4a3520
    };
    mat.color.setHex(colors[w.id] || 0x8B7355);
  }

  update(dt) {
    const cam = this.game.camera;
    const keys = this.game.keys;
    const sprinting = keys['ShiftLeft'] && this.stamina > 0;
    const moveSpeed = sprinting ? this.sprintSpeed : this.speed;

    // Stamina regen/drain
    if (sprinting && (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD'])) {
      this.stamina = Math.max(0, this.stamina - 20 * dt);
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + 15 * dt);
    }

    // Movement
    this.direction.set(0, 0, 0);
    if (keys['KeyW']) this.direction.z -= 1;
    if (keys['KeyS']) this.direction.z += 1;
    if (keys['KeyA']) this.direction.x -= 1;
    if (keys['KeyD']) this.direction.x += 1;
    this.direction.normalize();

    // Apply movement in camera direction
    const forward = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    const move = new THREE.Vector3();
    move.addScaledVector(forward, -this.direction.z * moveSpeed * dt);
    move.addScaledVector(right, this.direction.x * moveSpeed * dt);

    // Collision check
    const newPos = cam.position.clone().add(move);
    if (this.checkCollision(newPos)) {
      // Try sliding along walls
      const slideX = cam.position.clone().add(new THREE.Vector3(move.x, 0, 0));
      const slideZ = cam.position.clone().add(new THREE.Vector3(0, 0, move.z));
      if (!this.checkCollision(slideX)) cam.position.copy(slideX);
      else if (!this.checkCollision(slideZ)) cam.position.copy(slideZ);
    } else {
      cam.position.copy(newPos);
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

    // Weapon + camera bob
    const moving = this.direction.length() > 0 && this.onGround;
    if (this.weaponMesh) {
      const bobSpeed = sprinting ? 12 : 7;
      const bobAmt = sprinting ? 0.04 : 0.02;
      if (moving) {
        this.weaponSwing += dt * bobSpeed;
        this.weaponMesh.position.y = -0.35 + Math.sin(this.weaponSwing) * bobAmt;
        this.weaponMesh.position.x = 0.35 + Math.cos(this.weaponSwing * 0.5) * bobAmt * 0.5;
      }
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
    return getTerrainHeightFast(x, z);
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
      this.defense += 1;
      this.game.ui.addMessage(`Level up! You are now level ${this.level}`, 'quest');
    }
    document.getElementById('level-display').textContent = `Level ${this.level}`;
  }
}
