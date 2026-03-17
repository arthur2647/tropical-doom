export class TouchControls {
  constructor(game) {
    this.game = game;
    this.enabled = false;
    this.joystickInput = { x: 0, z: 0 }; // normalized -1 to 1
    this.lookDelta = { x: 0, y: 0 };
    this.joystickTouchId = null;
    this.lookTouchId = null;
    this.lastLookPos = null;

    // Detect mobile/touch device
    this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  init() {
    if (!this.isTouchDevice) return;
    this.enabled = true;

    document.getElementById('touch-controls').style.display = 'block';

    const joystickZone = document.getElementById('joystick-zone');
    const thumb = document.getElementById('joystick-thumb');
    const lookZone = document.getElementById('touch-look-zone');
    const baseRect = () => document.getElementById('joystick-base').getBoundingClientRect();

    // --- Joystick ---
    joystickZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;
      this.updateJoystick(touch, baseRect(), thumb);
    }, { passive: false });

    joystickZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickTouchId) {
          this.updateJoystick(touch, baseRect(), thumb);
        }
      }
    }, { passive: false });

    const resetJoystick = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.joystickTouchId) {
          this.joystickTouchId = null;
          this.joystickInput.x = 0;
          this.joystickInput.z = 0;
          thumb.style.transform = 'translate(-50%, -50%)';
          thumb.style.left = '50%';
          thumb.style.top = '50%';
        }
      }
    };
    joystickZone.addEventListener('touchend', resetJoystick);
    joystickZone.addEventListener('touchcancel', resetJoystick);

    // --- Look zone (right side swipe) ---
    lookZone.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this.lookTouchId = touch.identifier;
      this.lastLookPos = { x: touch.clientX, y: touch.clientY };
    }, { passive: false });

    lookZone.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.lookTouchId && this.lastLookPos) {
          const dx = touch.clientX - this.lastLookPos.x;
          const dy = touch.clientY - this.lastLookPos.y;
          this.lookDelta.x += dx;
          this.lookDelta.y += dy;
          this.lastLookPos = { x: touch.clientX, y: touch.clientY };
        }
      }
    }, { passive: false });

    const resetLook = e => {
      for (const touch of e.changedTouches) {
        if (touch.identifier === this.lookTouchId) {
          this.lookTouchId = null;
          this.lastLookPos = null;
        }
      }
    };
    lookZone.addEventListener('touchend', resetLook);
    lookZone.addEventListener('touchcancel', resetLook);

    // --- Action buttons ---
    document.getElementById('touch-attack').addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === 2) this.game.player.attack(false);
    }, { passive: false });

    document.getElementById('touch-heavy').addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === 2) this.game.player.attack(true);
    }, { passive: false });

    document.getElementById('touch-interact').addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === 2) this.game.interact();
      if (this.game.state === 7) this.game.npcManager.advanceDialogue(); // dialogue
    }, { passive: false });

    // --- Menu buttons (close any open menu first, then open requested one) ---
    const isInMenu = () => [3, 4, 5, 6].includes(this.game.state);

    document.getElementById('touch-inv').addEventListener('touchstart', e => {
      e.preventDefault();
      if (isInMenu()) { this.game.closeMenus(); return; }
      if (this.game.state === 2) this.game.openInventory();
    }, { passive: false });

    document.getElementById('touch-quest').addEventListener('touchstart', e => {
      e.preventDefault();
      if (isInMenu()) { this.game.closeMenus(); return; }
      if (this.game.state === 2) this.game.openQuestLog();
    }, { passive: false });

    document.getElementById('touch-craft').addEventListener('touchstart', e => {
      e.preventDefault();
      if (isInMenu()) { this.game.closeMenus(); return; }
      if (this.game.state === 2) this.game.openCrafting();
    }, { passive: false });

    document.getElementById('touch-pause').addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.game.state === 3) { this.game.resume(); return; }
      if (isInMenu()) { this.game.closeMenus(); return; }
      if (this.game.state === 2) this.game.pause();
    }, { passive: false });

    // --- Skill buttons ---
    for (let i = 0; i < 4; i++) {
      const btn = document.getElementById(`touch-skill-${i}`);
      if (btn) {
        btn.addEventListener('touchstart', e => {
          e.preventDefault();
          if (this.game.state === 2) this.game.player.useSkill(i);
        }, { passive: false });
      }
    }
  }

  updateJoystick(touch, rect, thumb) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;
    const maxR = rect.width / 2 - 10;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    // Normalize to -1..1
    this.joystickInput.x = dx / maxR;
    this.joystickInput.z = dy / maxR;

    // Move thumb visual
    thumb.style.left = (50 + (dx / rect.width) * 100) + '%';
    thumb.style.top = (50 + (dy / rect.height) * 100) + '%';
  }

  applyToPlayer(player, camera, dt) {
    if (!this.enabled) return;

    // Apply joystick movement
    if (Math.abs(this.joystickInput.x) > 0.1 || Math.abs(this.joystickInput.z) > 0.1) {
      // Simulate key state for the player's existing movement code
      this.game.keys['KeyW'] = this.joystickInput.z < -0.2;
      this.game.keys['KeyS'] = this.joystickInput.z > 0.2;
      this.game.keys['KeyA'] = this.joystickInput.x < -0.2;
      this.game.keys['KeyD'] = this.joystickInput.x > 0.2;

      // Sprint if pushed to edge
      const mag = Math.sqrt(this.joystickInput.x ** 2 + this.joystickInput.z ** 2);
      this.game.keys['ShiftLeft'] = mag > 0.85;
    } else {
      this.game.keys['KeyW'] = false;
      this.game.keys['KeyS'] = false;
      this.game.keys['KeyA'] = false;
      this.game.keys['KeyD'] = false;
      this.game.keys['ShiftLeft'] = false;
    }

    // Apply look rotation
    if (this.lookDelta.x !== 0 || this.lookDelta.y !== 0) {
      const sensitivity = 0.004;

      // Horizontal rotation (yaw) - rotate the camera's parent euler
      camera.rotation.y -= this.lookDelta.x * sensitivity;

      // Vertical rotation (pitch) - clamp to avoid flipping
      camera.rotation.x -= this.lookDelta.y * sensitivity;
      camera.rotation.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, camera.rotation.x));

      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    }
  }
}
