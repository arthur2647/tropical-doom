import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { getTerrainHeightFast } from './world.js';

export class PhysicsWorld {
  constructor(game) {
    this.game = game;
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -20, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.2;

    // Materials
    this.groundMat = new CANNON.Material('ground');
    this.playerMat = new CANNON.Material('player');
    this.wallMat = new CANNON.Material('wall');
    this.debrisMat = new CANNON.Material('debris');

    // Contact materials
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.playerMat, this.groundMat, { friction: 0.4, restitution: 0 }
    ));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.playerMat, this.wallMat, { friction: 0.1, restitution: 0 }
    ));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.debrisMat, this.groundMat, { friction: 0.5, restitution: 0.3 }
    ));
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.debrisMat, this.wallMat, { friction: 0.3, restitution: 0.4 }
    ));

    // Track dynamic debris bodies for sync
    this.debrisBodies = [];

    // Player body
    this.playerBody = null;

    // Enemy bodies
    this.enemyBodies = new Map();
  }

  // Create terrain as a heightfield
  initTerrain() {
    const size = 300;
    const res = this.game.isMobile ? 40 : 60; // lower res for physics (performance)
    const half = size / 2;
    const matrix = [];
    const elSize = size / res;

    for (let i = 0; i < res; i++) {
      matrix.push([]);
      for (let j = 0; j < res; j++) {
        const x = (i / res) * size - half;
        const z = (j / res) * size - half;
        matrix[i].push(getTerrainHeightFast(x, z));
      }
    }

    const heightfield = new CANNON.Heightfield(matrix, { elementSize: elSize });
    const terrainBody = new CANNON.Body({
      mass: 0,
      material: this.groundMat,
      shape: heightfield,
    });
    // Terrain in group 8 — player doesn't collide with it (Y managed by game),
    // but debris still collides with it via group 1 mask
    terrainBody.collisionFilterGroup = 8;
    terrainBody.collisionFilterMask = 4; // only collide with debris
    // Heightfield is in XZ, cannon uses XY for heightfield, so rotate
    terrainBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    terrainBody.position.set(-half, 0, half);
    this.world.addBody(terrainBody);
  }

  // Convert existing game.colliders (THREE.Box3) to cannon static bodies
  initColliders() {
    this.colliderBodies = [];
    if (!this.game.colliders) return;
    for (const box of this.game.colliders) {
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
      const body = new CANNON.Body({
        mass: 0,
        material: this.wallMat,
        shape: new CANNON.Box(halfExtents),
        position: new CANNON.Vec3(center.x, center.y, center.z),
      });
      body.collisionFilterGroup = 1;
      this.world.addBody(body);
      this.colliderBodies.push(body);
    }
  }

  // Remove a collider's cannon body by index (when destructible is destroyed)
  removeColliderBody(idx) {
    if (!this.colliderBodies || idx < 0 || idx >= this.colliderBodies.length) return;
    const body = this.colliderBodies[idx];
    if (body) this.world.removeBody(body);
    this.colliderBodies.splice(idx, 1);
  }

  // Create player physics body (sphere for smooth wall sliding)
  initPlayer() {
    const cam = this.game.camera;
    this.playerBody = new CANNON.Body({
      mass: 75,
      material: this.playerMat,
      shape: new CANNON.Sphere(0.35),
      position: new CANNON.Vec3(cam.position.x, cam.position.y - 1.35, cam.position.z),
      linearDamping: 0.05,
      angularDamping: 1.0,
      fixedRotation: true,
    });
    this.playerBody.collisionFilterGroup = 2;
    this.playerBody.collisionFilterMask = 1 | 4; // collide with static + debris
    this.world.addBody(this.playerBody);
  }

  // Create a physics body for an enemy
  addEnemyBody(enemy) {
    const s = enemy.def.size || 1;
    const body = new CANNON.Body({
      mass: 0, // kinematic
      type: CANNON.Body.KINEMATIC,
      material: this.wallMat,
      shape: new CANNON.Sphere(s * 0.4),
      position: new CANNON.Vec3(
        enemy.model.position.x,
        enemy.model.position.y + s * 0.5,
        enemy.model.position.z
      ),
    });
    body.collisionFilterGroup = 1;
    this.world.addBody(body);
    this.enemyBodies.set(enemy, body);
    return body;
  }

  removeEnemyBody(enemy) {
    const body = this.enemyBodies.get(enemy);
    if (body) {
      this.world.removeBody(body);
      this.enemyBodies.delete(enemy);
    }
  }

  // Sync enemy Three.js positions to cannon bodies
  syncEnemyBodies() {
    for (const [enemy, body] of this.enemyBodies) {
      const s = enemy.def.size || 1;
      body.position.set(
        enemy.model.position.x,
        enemy.model.position.y + s * 0.5,
        enemy.model.position.z
      );
    }
  }

  // Spawn physics debris (replaces the simple particle debris)
  spawnDebris(x, y, z, color, count) {
    count = count || (this.game.isMobile ? 3 : 6);
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const size = 0.05 + Math.random() * 0.12;
      const halfSize = size / 2;

      const body = new CANNON.Body({
        mass: 0.2 + Math.random() * 0.5,
        material: this.debrisMat,
        shape: new CANNON.Box(new CANNON.Vec3(halfSize, halfSize, halfSize)),
        position: new CANNON.Vec3(
          x + (Math.random() - 0.5) * 0.5,
          y + 0.5 + Math.random() * 0.5,
          z + (Math.random() - 0.5) * 0.5
        ),
        linearDamping: 0.3,
        angularDamping: 0.4,
      });

      // Launch debris outward
      const angle = Math.random() * Math.PI * 2;
      const upForce = 3 + Math.random() * 5;
      const outForce = 2 + Math.random() * 4;
      body.velocity.set(
        Math.cos(angle) * outForce,
        upForce,
        Math.sin(angle) * outForce
      );
      body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );

      body.collisionFilterGroup = 4;
      body.collisionFilterMask = 1 | 8; // collide with walls + terrain
      body.allowSleep = true;
      body.sleepSpeedLimit = 0.3;
      body.sleepTimeLimit = 2;
      this.world.addBody(body);

      // Create visual mesh
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshLambertMaterial({ color });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      this.game.scene.add(mesh);

      pieces.push({ body, mesh, life: 5 + Math.random() * 3 });
    }
    this.debrisBodies.push(...pieces);
  }

  // Update physics world and sync visuals
  update(dt) {
    // Counteract cannon's gravity on player — we manage Y ourselves
    if (this.playerBody) {
      const g = this.world.gravity;
      const m = this.playerBody.mass;
      this.playerBody.force.y -= g.y * m; // cancel world gravity
      // Keep cannon body Y synced to camera (game controls Y via terrain + gravity)
      this.playerBody.position.y = this.game.camera.position.y - 1.35;
      this.playerBody.velocity.y = 0;
    }

    // Step physics (fixed timestep for stability)
    const fixedStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedStep, dt, maxSubSteps);

    // Sync player body XZ -> camera (cannon handles wall collision response)
    if (this.playerBody) {
      const cam = this.game.camera;
      cam.position.x = this.playerBody.position.x;
      cam.position.z = this.playerBody.position.z;
      // Y is entirely managed by game (terrain + platforms + manual gravity)
    }

    // Sync debris visuals
    for (let i = this.debrisBodies.length - 1; i >= 0; i--) {
      const d = this.debrisBodies[i];
      d.life -= dt;

      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);

      if (d.life < 1) {
        d.mesh.material.transparent = true;
        d.mesh.material.opacity = d.life;
      }

      if (d.life <= 0) {
        this.world.removeBody(d.body);
        this.game.scene.remove(d.mesh);
        d.mesh.geometry.dispose();
        d.mesh.material.dispose();
        this.debrisBodies.splice(i, 1);
      }
    }

    // Sync enemy kinematic bodies
    this.syncEnemyBodies();
  }

  // Apply movement intent to player body (called from player.update)
  setPlayerVelocity(vx, vz) {
    if (!this.playerBody) return;
    this.playerBody.velocity.x = vx;
    this.playerBody.velocity.z = vz;
  }

  setPlayerPosition(x, y, z) {
    if (!this.playerBody) return;
    this.playerBody.position.set(x, y - 1.35, z);
    this.playerBody.velocity.set(0, 0, 0);
  }
}
