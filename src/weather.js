import * as THREE from 'three';

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.particles = null;
    this.rainActive = false;
    this.rainTimer = 0;
    this.rainDuration = 0;
    this.windDirection = new THREE.Vector3(1, 0, 0.5).normalize();
    this.windStrength = 0;
    this.lightningTimer = 0;
    this.lightningFlash = null;
  }

  init() {
    // Rain particle system (fewer on mobile for performance)
    const isMobile = this.game.isMobile;
    const count = isMobile ? 800 : 2000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -15 - Math.random() * 10;
      velocities[i * 3 + 2] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainVelocities = velocities;

    const mat = new THREE.PointsMaterial({
      color: 0xaabbcc,
      size: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });

    this.particles = new THREE.Points(geo, mat);
    this.particles.visible = false;
    this.game.scene.add(this.particles);

    // Lightning flash light
    this.lightningFlash = new THREE.DirectionalLight(0xffffff, 0);
    this.lightningFlash.position.set(0, 100, 0);
    this.game.scene.add(this.lightningFlash);

    // Start weather cycle
    this.scheduleRain();
  }

  scheduleRain() {
    this.rainTimer = 30 + Math.random() * 60; // Rain every 30-90 seconds
    this.rainDuration = 15 + Math.random() * 30;
  }

  update(dt) {
    if (!this.particles) return;

    // Rain timing
    this.rainTimer -= dt;
    if (this.rainTimer <= 0 && !this.rainActive) {
      this.startRain();
    }
    if (this.rainActive) {
      this.rainDuration -= dt;
      if (this.rainDuration <= 0) {
        this.stopRain();
      }
    }

    // Update rain particles
    if (this.rainActive) {
      const positions = this.particles.geometry.attributes.position;
      const playerPos = this.game.camera.position;

      for (let i = 0; i < positions.count; i++) {
        let x = positions.getX(i);
        let y = positions.getY(i);
        let z = positions.getZ(i);

        y += this.rainVelocities[i * 3 + 1] * dt;
        x += this.windDirection.x * this.windStrength * dt;
        z += this.windDirection.z * this.windStrength * dt;

        // Reset if below ground or too far
        if (y < -1 || Math.abs(x - playerPos.x) > 40 || Math.abs(z - playerPos.z) > 40) {
          x = playerPos.x + (Math.random() - 0.5) * 80;
          y = 20 + Math.random() * 20;
          z = playerPos.z + (Math.random() - 0.5) * 80;
        }

        positions.setXYZ(i, x, y, z);
      }
      positions.needsUpdate = true;

      // Lightning
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightning();
        this.lightningTimer = 5 + Math.random() * 15;
      }

      // Fade lightning
      if (this.lightningFlash.intensity > 0) {
        this.lightningFlash.intensity *= 0.85;
        if (this.lightningFlash.intensity < 0.01) this.lightningFlash.intensity = 0;
      }
    }

    // Wind affects trees slightly (scene fog density)
    this.windStrength = Math.sin(Date.now() * 0.001) * 3 + 2;
  }

  startRain() {
    this.rainActive = true;
    this.particles.visible = true;
    this.lightningTimer = 3 + Math.random() * 5;
    this.game.ui.addMessage('Dark clouds gather... rain begins to fall.', 'system');

    // Increase fog density during rain
    if (this.game.scene.fog) {
      this.game.scene.fog.density = 0.018;
    }
  }

  stopRain() {
    this.rainActive = false;
    this.particles.visible = false;
    this.scheduleRain();

    if (this.game.scene.fog) {
      this.game.scene.fog.density = 0.012;
    }
  }

  lightning() {
    this.lightningFlash.intensity = 3 + Math.random() * 2;
    // Thunder sound with crack + rumble
    this.game.audioManager.playThunder();
  }
}
