import * as THREE from 'three';
import { getTerrainHeightFast } from './world.js';

const ENEMY_DEFS = {
  infected: {
    name: 'Infected Villager', hp: 40, speed: 2.5, damage: 8, xp: 15, gold: 5,
    color: 0x8B6955, size: 0.9, attackRange: 2, attackSpeed: 1.2,
    bodyParts: { head: 0x7A6050, body: 0x556644, limbs: 0x7A6050 }
  },
  aswang: {
    name: 'Aswang', hp: 80, speed: 3.5, damage: 15, xp: 30, gold: 12,
    color: 0xAA3333, size: 0.85, attackRange: 2.2, attackSpeed: 0.8,
    bodyParts: { head: 0x993333, body: 0x441111, limbs: 0x882222 }
  },
  tiyanak: {
    name: 'Tiyanak', hp: 25, speed: 4.5, damage: 6, xp: 12, gold: 8,
    color: 0xBBA088, size: 0.5, attackRange: 1.5, attackSpeed: 0.5,
    bodyParts: { head: 0xAA9080, body: 0x998070, limbs: 0x887060 }
  },
  tikbalang: {
    name: 'Tikbalang', hp: 200, speed: 1.8, damage: 30, xp: 60, gold: 25,
    color: 0x6B4226, size: 1.3, attackRange: 3, attackSpeed: 1.6,
    bodyParts: { head: 0x704020, body: 0x5A3A1A, limbs: 0x604020 }
  },
  manananggal: {
    name: 'Manananggal', hp: 100, speed: 2.8, damage: 18, xp: 45, gold: 20,
    color: 0x883388, size: 0.85, attackRange: 8, attackSpeed: 1.4, ranged: true,
    bodyParts: { head: 0x772277, body: 0x551155, limbs: 0x662266 }
  },
  kapre: {
    name: 'Kapre', hp: 500, speed: 1.0, damage: 50, xp: 200, gold: 80,
    color: 0x3D2B1F, size: 2.0, attackRange: 4, attackSpeed: 2.0, boss: true,
    bodyParts: { head: 0x2D1B0F, body: 0x3D2B1F, limbs: 0x4D3B2F }
  },
  diwata: {
    name: 'Corrupted Diwata', hp: 800, speed: 2.0, damage: 40, xp: 500, gold: 200,
    color: 0x440088, size: 1.5, attackRange: 10, attackSpeed: 1.0, boss: true, ranged: true,
    bodyParts: { head: 0x660099, body: 0x330066, limbs: 0x550088 }
  }
};

function createEnemyModel(def) {
  const group = new THREE.Group();
  const s = def.size;
  const bp = def.bodyParts;
  const mS = (c, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
  const mSkin = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0 });
  const mB = (c) => new THREE.MeshBasicMaterial({ color: c });
  const mGlow = (c, em, i = 0.5) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.4, emissive: em, emissiveIntensity: i });

  // --- Type-specific body builds ---
  if (def === ENEMY_DEFS.infected) {
    // Hunched humanoid in tattered clothes - more decrepit and zombie-like
    // Torso - heavily hunched, torn clothing
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.45, s*0.5, s*0.25), mSkin(0x4a5538));
    torso.position.y = s*0.75; torso.rotation.x = 0.2;
    group.add(torso);
    // Tattered shirt with rips
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(s*0.47, s*0.28, s*0.26), mS(0x556644));
    shirt.position.y = s*0.88;
    group.add(shirt);
    // Exposed skin/wound patches
    for (let i = 0; i < 3; i++) {
      const wound = new THREE.Mesh(new THREE.PlaneGeometry(s*0.06, s*0.04),
        new THREE.MeshStandardMaterial({ color: 0x661122, roughness: 0.4, side: THREE.DoubleSide }));
      wound.position.set((Math.random()-0.5)*s*0.3, s*(0.65+Math.random()*0.3), s*0.13);
      wound.rotation.z = Math.random();
      group.add(wound);
    }
    // Head - pale, gaunt with sunken features
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.18, 8, 8), mSkin(0x887766));
    head.position.set(0, s*1.05, s*0.08); head.scale.set(1, 1.15, 0.85);
    group.add(head);
    // Sunken cheeks
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4), mSkin(0x665544));
      cheek.position.set(side*s*0.1, s*1.0, s*0.12);
      cheek.scale.set(1, 1.3, 0.5);
      group.add(cheek);
    }
    // Deep dark eye sockets with glowing eyes
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.05, 5, 5), mS(0x1a1a11, 0.3));
      socket.position.set(side*s*0.07, s*1.08, s*0.16);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.025, 4, 4), mGlow(0xffcc00, 0xffaa00, 0.8));
      eye.position.set(side*s*0.07, s*1.08, s*0.2);
      group.add(eye);
    }
    // Slack jaw with drool
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.05, s*0.07), mSkin(0x775544));
    jaw.position.set(0, s*0.94, s*0.15); jaw.rotation.x = 0.15;
    group.add(jaw);
    // Exposed teeth
    for (let i = 0; i < 4; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(s*0.015, s*0.02, s*0.01), mS(0xccbb88));
      tooth.position.set((i-1.5)*s*0.025, s*0.96, s*0.18);
      group.add(tooth);
    }
    // Drool strand
    const drool = new THREE.Mesh(new THREE.CylinderGeometry(s*0.003, s*0.002, s*0.08, 3),
      new THREE.MeshStandardMaterial({ color: 0xaabb99, transparent: true, opacity: 0.5 }));
    drool.position.set(s*0.02, s*0.9, s*0.17);
    group.add(drool);
    // Arms - one reaching forward, skin lesions
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.045, s*0.3, 5), mSkin(bp.limbs));
      upper.position.set(side*s*0.28, s*0.7, side > 0 ? s*0.12 : 0);
      upper.rotation.x = side > 0 ? -0.7 : -0.1;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.035, s*0.25, 5), mSkin(bp.limbs));
      fore.position.set(side*s*0.28, s*0.5, side > 0 ? s*0.25 : 0);
      fore.rotation.x = side > 0 ? -0.3 : 0;
      group.add(fore);
      // Gnarled fingers
      const hand = new THREE.Mesh(new THREE.BoxGeometry(s*0.07, s*0.06, s*0.04), mSkin(0x887766));
      hand.position.set(side*s*0.28, s*0.38, side > 0 ? s*0.32 : 0);
      group.add(hand);
    }
    // Legs - shuffling stance
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.065, s*0.055, s*0.25, 5), mS(0x443322));
      thigh.position.set(side*s*0.12, s*0.3, side > 0 ? s*0.04 : 0);
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.045, s*0.2, 5), mSkin(bp.limbs));
      shin.position.set(side*s*0.12, s*0.1, side > 0 ? s*0.04 : 0);
      group.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.04, s*0.14), mS(0x332211));
      foot.position.set(side*s*0.12, s*0.02, s*0.03);
      group.add(foot);
    }

  } else if (def === ENEMY_DEFS.aswang) {
    // Crouched predator - lean, angular, canine-like with elongated limbs
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.4, s*0.45, s*0.3), mSkin(bp.body));
    torso.position.y = s*0.65; torso.rotation.x = 0.35;
    group.add(torso);
    // Visible ribcage under taut skin
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(s*0.14, s*0.008, 4, 6, Math.PI*0.8),
        mS(0x551111, 0.5));
      rib.position.set(0, s*(0.58 + i*0.06), s*0.1);
      rib.rotation.x = Math.PI * 0.5;
      group.add(rib);
    }
    // Spine ridges - prominent vertebrae
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(s*0.025, s*0.06, 4), mS(0x330000, 0.6));
      spike.position.set(0, s*(0.72 + i*0.06), -s*0.15);
      spike.rotation.x = -0.3;
      group.add(spike);
    }
    // Head - elongated skull, predatory
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.2, 8, 8), mSkin(bp.head));
    head.position.set(0, s*0.95, s*0.12); head.scale.set(0.9, 1.15, 1.1);
    group.add(head);
    // Stringy matted hair
    for (let i = 0; i < 8; i++) {
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(s*0.008, s*0.004, s*(0.2+Math.random()*0.15), 3),
        mS(0x1a0505, 0.9));
      hair.position.set((i-3.5)*s*0.04, s*1.0, -s*0.08);
      hair.rotation.x = 0.4 + Math.random()*0.5;
      hair.rotation.z = (Math.random()-0.5)*0.4;
      group.add(hair);
    }
    // Glowing red eyes - larger, more menacing
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 5, 5), mS(0x110000, 0.2));
      socket.position.set(side*s*0.08, s*0.98, s*0.22);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 5, 5), mGlow(0xff0000, 0xff0000, 1.0));
      eye.position.set(side*s*0.08, s*0.98, s*0.25);
      group.add(eye);
    }
    // Wide gaping mouth with rows of teeth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.06, s*0.05), mS(0x330000, 0.3));
    mouth.position.set(0, s*0.86, s*0.22);
    group.add(mouth);
    // Upper fangs
    for (const x of [-0.04, -0.015, 0.015, 0.04]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(s*0.01, s*0.05, 4), mS(0xeeddcc, 0.3));
      fang.position.set(x*s, s*0.82, s*0.22);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }
    // Lower teeth
    for (const x of [-0.03, 0, 0.03]) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(s*0.008, s*0.03, 3), mS(0xddccbb, 0.3));
      tooth.position.set(x*s, s*0.89, s*0.22);
      group.add(tooth);
    }
    // Blood dripping from mouth
    const blood = new THREE.Mesh(new THREE.CylinderGeometry(s*0.005, s*0.003, s*0.06, 3),
      new THREE.MeshStandardMaterial({ color: 0xaa0011, roughness: 0.2, metalness: 0.3 }));
    blood.position.set(s*0.02, s*0.8, s*0.23);
    group.add(blood);
    // Long arms with claws - more articulated
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.04, s*0.35, 5), mSkin(bp.limbs));
      upper.position.set(side*s*0.28, s*0.55, s*0.1);
      upper.rotation.x = -0.5;
      upper.rotation.z = side * 0.15;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.03, s*0.3, 5), mSkin(bp.limbs));
      fore.position.set(side*s*0.32, s*0.35, s*0.2);
      fore.rotation.x = -0.3;
      group.add(fore);
      // Splayed fingers with long claws
      for (let c = -1; c <= 1; c++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(s*0.008, s*0.005, s*0.06, 3), mSkin(bp.limbs));
        finger.position.set(side*s*0.32 + c*s*0.02, s*0.2, s*0.28);
        finger.rotation.x = -0.4;
        group.add(finger);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s*0.008, s*0.06, 3), mS(0x221111, 0.3));
        claw.position.set(side*s*0.32 + c*s*0.02, s*0.14, s*0.32);
        claw.rotation.x = -0.6;
        group.add(claw);
      }
    }
    // Crouched digitigrade legs
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.05, s*0.25, 5), mSkin(bp.limbs));
      thigh.position.set(side*s*0.14, s*0.28, -s*0.05);
      thigh.rotation.x = 0.3;
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.035, s*0.2, 5), mSkin(bp.limbs));
      shin.position.set(side*s*0.14, s*0.1, s*0.02);
      group.add(shin);
    }

  } else if (def === ENEMY_DEFS.tiyanak) {
    // Demonic infant - uncanny valley baby with wrong proportions
    // Oversized head
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.4, 10, 8), mSkin(0xBBAA99));
    head.position.y = s*0.6; head.scale.set(1, 1.15, 0.95);
    group.add(head);
    // Fontanelle - pulsing soft spot
    const fontanelle = new THREE.Mesh(new THREE.SphereGeometry(s*0.1, 6, 6),
      mGlow(0x998877, 0x442211, 0.3));
    fontanelle.position.y = s*0.82;
    fontanelle.scale.y = 0.3;
    group.add(fontanelle);
    // Dark hollow eye sockets - too large for head
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.14, 6, 6), mS(0x110505, 0.2));
      socket.position.set(side*s*0.14, s*0.65, s*0.28);
      socket.scale.set(1, 1.2, 0.5);
      group.add(socket);
      // Tiny glowing pupils in huge sockets
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 5, 5), mGlow(0xff4400, 0xff2200, 1.2));
      pupil.position.set(side*s*0.14, s*0.65, s*0.38);
      group.add(pupil);
    }
    // Wide unnatural grin - ear to ear
    const grin = new THREE.Mesh(new THREE.TorusGeometry(s*0.15, s*0.02, 4, 8, Math.PI),
      mS(0x330000, 0.3));
    grin.position.set(0, s*0.45, s*0.32);
    grin.rotation.x = Math.PI;
    group.add(grin);
    // Sharp needle teeth
    for (let i = 0; i < 8; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(s*0.008, s*0.04, 3), mS(0xeeeedd, 0.2));
      tooth.position.set((i-3.5)*s*0.035, s*0.43, s*0.35);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }
    // Small twisted body
    const body = new THREE.Mesh(new THREE.CylinderGeometry(s*0.12, s*0.1, s*0.2, 6), mSkin(0xAA9988));
    body.position.y = s*0.2;
    group.add(body);
    // Swollen belly
    const belly = new THREE.Mesh(new THREE.SphereGeometry(s*0.13, 6, 6), mSkin(0xBBAA99));
    belly.position.set(0, s*0.2, s*0.05);
    belly.scale.set(1, 0.8, 1.1);
    group.add(belly);
    // Stubby arms with tiny claws - reaching out
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.03, s*0.18, 4), mSkin(0xBBAA99));
      arm.position.set(side*s*0.18, s*0.25, s*0.08);
      arm.rotation.x = -0.6;
      arm.rotation.z = side * -0.3;
      group.add(arm);
      // Tiny clawed fingers
      for (let f = 0; f < 3; f++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s*0.005, s*0.03, 3), mS(0x332222, 0.3));
        claw.position.set(side*s*0.18 + (f-1)*s*0.015, s*0.15, s*0.16);
        claw.rotation.x = -0.5;
        group.add(claw);
      }
    }
    // Stubby legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.04, s*0.12, 4), mSkin(0xAA9988));
      leg.position.set(side*s*0.08, s*0.06, 0);
      group.add(leg);
    }
    // Dark aura around the creature
    const aura = new THREE.Mesh(new THREE.SphereGeometry(s*0.5, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x220000, transparent: true, opacity: 0.08 }));
    aura.position.y = s*0.4;
    group.add(aura);

  } else if (def === ENEMY_DEFS.tikbalang) {
    // Tall horse-headed humanoid - massive, threatening
    // Muscular torso with visible muscle definition
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(s*0.22, s*0.2, s*0.5, 6), mSkin(bp.body));
    torso.position.y = s*0.75;
    group.add(torso);
    // Chest plates / pectoral muscles
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(new THREE.SphereGeometry(s*0.1, 5, 5), mSkin(bp.body));
      pec.position.set(side*s*0.08, s*0.85, s*0.1);
      pec.scale.set(1.2, 0.8, 0.5);
      group.add(pec);
    }
    // Broad shoulders with bone spurs
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(s*0.65, s*0.1, s*0.3), mSkin(bp.body));
    shoulders.position.y = s*1.02;
    group.add(shoulders);
    for (const side of [-1, 1]) {
      const spur = new THREE.Mesh(new THREE.ConeGeometry(s*0.03, s*0.1, 4), mS(0x443322, 0.5));
      spur.position.set(side*s*0.32, s*1.08, 0);
      spur.rotation.z = side * 0.5;
      group.add(spur);
    }
    // Horse head - elongated, terrifying
    const skull = new THREE.Mesh(new THREE.BoxGeometry(s*0.2, s*0.28, s*0.38), mSkin(bp.head));
    skull.position.set(0, s*1.22, s*0.06);
    group.add(skull);
    // Elongated snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(s*0.16, s*0.14, s*0.22), mSkin(bp.head));
    snout.position.set(0, s*1.1, s*0.26);
    group.add(snout);
    // Flared nostrils with steam effect
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(s*0.025, 4, 4), mS(0x220000, 0.3));
      nostril.position.set(side*s*0.05, s*1.08, s*0.37);
      group.add(nostril);
      const steam = new THREE.Mesh(new THREE.SphereGeometry(s*0.02, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.15 }));
      steam.position.set(side*s*0.05, s*1.06, s*0.4);
      group.add(steam);
    }
    // Burning amber eyes
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 5, 5), mS(0x221100, 0.2));
      socket.position.set(side*s*0.08, s*1.24, s*0.2);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.035, 5, 5), mGlow(0xffcc00, 0xff8800, 0.9));
      eye.position.set(side*s*0.08, s*1.24, s*0.23);
      group.add(eye);
    }
    // Ears - pointed, horse-like
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(s*0.03, s*0.1, 4), mSkin(bp.head));
      ear.position.set(side*s*0.1, s*1.38, s*0.02);
      ear.rotation.z = side * 0.3;
      group.add(ear);
    }
    // Wild mane - thicker, more dramatic
    for (let i = 0; i < 12; i++) {
      const hair = new THREE.Mesh(new THREE.CylinderGeometry(s*0.012, s*0.008, s*(0.2+Math.random()*0.15), 3),
        mS(0x1a0a00, 0.9));
      hair.position.set((i-5.5)*s*0.03, s*1.35, -s*0.08);
      hair.rotation.x = 0.5 + Math.random()*0.4;
      hair.rotation.z = (Math.random()-0.5)*0.3;
      group.add(hair);
    }
    // Massive muscular arms
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.08, s*0.07, s*0.35, 6), mSkin(bp.limbs));
      upper.position.set(side*s*0.38, s*0.8, 0);
      upper.rotation.z = side * 0.1;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.07, s*0.06, s*0.3, 6), mSkin(bp.limbs));
      fore.position.set(side*s*0.4, s*0.5, s*0.03);
      group.add(fore);
      // Hooved fist - keratin
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.07, s*0.08, 6), mS(0x221100, 0.4));
      hoof.position.set(side*s*0.4, s*0.33, s*0.03);
      group.add(hoof);
    }
    // Digitigrade legs - powerful
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.09, s*0.07, s*0.3, 6), mSkin(bp.limbs));
      thigh.position.set(side*s*0.15, s*0.38, -s*0.03);
      thigh.rotation.x = 0.2;
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.05, s*0.25, 6), mSkin(bp.limbs));
      shin.position.set(side*s*0.15, s*0.12, s*0.05);
      shin.rotation.x = -0.15;
      group.add(shin);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.07, s*0.06, 6), mS(0x221100, 0.4));
      hoof.position.set(side*s*0.15, s*0.02, s*0.06);
      group.add(hoof);
    }

  } else if (def === ENEMY_DEFS.manananggal) {
    // Half-bodied flying creature - visceral horror, exposed organs, bat wings
    // Upper torso - with visible damage at separation point
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2, s*0.22, s*0.4, 8), mSkin(bp.body));
    torso.position.y = s*0.9;
    group.add(torso);
    // Breasts/chest definition
    const chest = new THREE.Mesh(new THREE.BoxGeometry(s*0.42, s*0.15, s*0.22), mSkin(bp.body));
    chest.position.y = s*1.0;
    group.add(chest);
    // Exposed ribcage at separation - more detailed
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(s*0.13, s*0.012, 4, 10, Math.PI),
        mS(0xddccbb, 0.4, 0.1));
      rib.position.set(0, s*(0.72 - i*0.04), s*0.02);
      rib.rotation.x = Math.PI * 0.5;
      rib.rotation.z = Math.PI;
      group.add(rib);
    }
    // Spine stump visible
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(s*0.03, s*0.04, s*0.15, 5), mS(0xccbbaa, 0.4));
    spine.position.set(0, s*0.55, -s*0.05);
    group.add(spine);
    // Dangling entrails/intestines - longer, more visceral
    for (let i = 0; i < 7; i++) {
      const len = s*(0.15 + Math.random()*0.25);
      const thick = s*(0.01 + Math.random()*0.008);
      const entrail = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick*0.6, len, 5),
        mS(0x882244, 0.3, 0.1));
      entrail.position.set((Math.random()-0.5)*s*0.2, s*0.55 - len/2, (Math.random()-0.5)*s*0.12);
      entrail.rotation.z = (Math.random()-0.5)*0.4;
      entrail.rotation.x = (Math.random()-0.5)*0.2;
      group.add(entrail);
    }
    // Blood drips - animated looking
    for (let i = 0; i < 5; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(s*0.015, 4, 4),
        mGlow(0xaa0022, 0x880011, 0.3));
      drip.position.set((Math.random()-0.5)*s*0.2, s*(0.3 + Math.random()*0.15), (Math.random()-0.5)*s*0.1);
      group.add(drip);
    }
    // Head - wild-eyed, inhuman beauty twisted into horror
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.2, 10, 8), mSkin(bp.head));
    head.position.set(0, s*1.18, s*0.05); head.scale.set(1, 1.1, 0.9);
    group.add(head);
    // Long wild hair - flowing behind
    for (let i = 0; i < 12; i++) {
      const hair = new THREE.Mesh(
        new THREE.CylinderGeometry(s*0.01, s*0.005, s*(0.2+Math.random()*0.2), 3),
        mS(0x0a0005, 0.9));
      hair.position.set((i-5.5)*s*0.035, s*1.15, -s*0.1);
      hair.rotation.x = 0.4 + Math.random()*0.5;
      hair.rotation.z = (Math.random()-0.5)*0.4;
      group.add(hair);
    }
    // Bloodshot eyes - wide, manic
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(s*0.065, 8, 8), mS(0xffddcc, 0.3));
      eyeWhite.position.set(side*s*0.08, s*1.2, s*0.16);
      group.add(eyeWhite);
      // Blood vessels in eye
      const vein = new THREE.Mesh(new THREE.CylinderGeometry(s*0.003, s*0.002, s*0.05, 3),
        new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true, opacity: 0.5 }));
      vein.position.set(side*s*0.1, s*1.2, s*0.17);
      vein.rotation.z = side * 0.5;
      group.add(vein);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s*0.03, 5, 5), mGlow(0xff0000, 0xff0000, 1.0));
      pupil.position.set(side*s*0.08, s*1.2, s*0.22);
      group.add(pupil);
    }
    // Wide gaping mouth - hinged jaw
    const upperJaw = new THREE.Mesh(new THREE.BoxGeometry(s*0.15, s*0.03, s*0.06), mSkin(bp.head));
    upperJaw.position.set(0, s*1.09, s*0.17);
    group.add(upperJaw);
    const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.03, s*0.05), mSkin(bp.head));
    lowerJaw.position.set(0, s*1.03, s*0.18);
    lowerJaw.rotation.x = 0.2;
    group.add(lowerJaw);
    const mouthInside = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.05, s*0.04), mS(0x440000, 0.3));
    mouthInside.position.set(0, s*1.06, s*0.17);
    group.add(mouthInside);
    // Large fangs
    for (const x of [-0.045, -0.015, 0.015, 0.045]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(s*0.01, s*0.05, 4), mS(0xeeddcc, 0.2));
      fang.position.set(x*s, s*1.01, s*0.18);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }
    // Long prehensile tongue
    const tongue = new THREE.Mesh(new THREE.CylinderGeometry(s*0.015, s*0.008, s*0.25, 5), mS(0xcc2255, 0.3));
    tongue.position.set(0, s*1.0, s*0.25);
    tongue.rotation.x = -0.8;
    group.add(tongue);
    // Arms - elongated, unnaturally long with talons
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.04, s*0.35, 5), mSkin(bp.limbs));
      upper.position.set(side*s*0.3, s*0.9, 0);
      upper.rotation.z = side * 0.35;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.03, s*0.32, 5), mSkin(bp.limbs));
      fore.position.set(side*s*0.42, s*0.6, s*0.05);
      fore.rotation.x = -0.3;
      group.add(fore);
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s*0.01, s*0.08, 3), mS(0x221111, 0.3));
        claw.position.set(side*s*0.42 + c*s*0.02, s*0.38, s*0.12);
        claw.rotation.x = -0.6;
        group.add(claw);
      }
    }
    // Bat wings - larger, more membrane detail
    for (const side of [-1, 1]) {
      // Wing bones - 3 segments
      const bone1 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.02, s*0.015, s*0.65, 4), mS(0x331133, 0.6));
      bone1.position.set(side*s*0.5, s*1.05, -s*0.08);
      bone1.rotation.z = side * 1.2;
      group.add(bone1);
      const bone2 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.015, s*0.01, s*0.55, 4), mS(0x331133, 0.6));
      bone2.position.set(side*s*0.7, s*0.9, -s*0.08);
      bone2.rotation.z = side * 0.7;
      group.add(bone2);
      const bone3 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.01, s*0.007, s*0.4, 3), mS(0x331133, 0.6));
      bone3.position.set(side*s*0.55, s*0.75, -s*0.08);
      bone3.rotation.z = side * 1.0;
      group.add(bone3);
      // Wing membrane - translucent with vein pattern
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(side*s*0.75, s*0.35);
      wingShape.lineTo(side*s*0.9, s*0.05);
      wingShape.lineTo(side*s*0.7, -s*0.15);
      wingShape.lineTo(side*s*0.4, -s*0.2);
      wingShape.lineTo(0, -s*0.15);
      const wingGeo = new THREE.ShapeGeometry(wingShape);
      const wingMat = new THREE.MeshStandardMaterial({
        color: 0x441144, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, roughness: 0.6, emissive: 0x220022, emissiveIntensity: 0.15
      });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0, s*0.98, -s*0.1);
      wing.rotation.y = side > 0 ? -0.15 : 0.15;
      group.add(wing);
    }

  } else if (def === ENEMY_DEFS.kapre) {
    // Massive tree giant - ancient, terrifying nature spirit
    const mBark = new THREE.MeshStandardMaterial({ color: 0x3D2B1F, roughness: 0.95, metalness: 0 });
    const mDarkBark = new THREE.MeshStandardMaterial({ color: 0x2D1B0F, roughness: 0.9, metalness: 0 });
    const mMoss = new THREE.MeshStandardMaterial({ color: 0x2a4a20, roughness: 0.8 });
    // Massive torso - barrel-shaped with deep bark cracks
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.25, s*0.55, 8), mBark);
    torso.position.y = s*0.8;
    group.add(torso);
    // Deep bark crack lines
    for (let i = 0; i < 5; i++) {
      const crack = new THREE.Mesh(new THREE.BoxGeometry(s*0.005, s*0.15, s*0.01), mS(0x1a0a00, 0.3));
      crack.position.set((Math.random()-0.5)*s*0.25, s*(0.65+Math.random()*0.25), s*0.13);
      crack.rotation.z = (Math.random()-0.5)*0.5;
      group.add(crack);
    }
    // Bark texture rings on torso
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s*0.28, s*0.018, 4, 10), mDarkBark);
      ring.position.y = s*(0.62 + i*0.12);
      ring.rotation.x = Math.PI/2;
      group.add(ring);
    }
    // Moss patches - more organic looking
    for (const side of [-1, 1]) {
      const moss = new THREE.Mesh(new THREE.SphereGeometry(s*0.14, 6, 5), mMoss);
      moss.position.set(side*s*0.28, s*1.05, s*0.05);
      moss.scale.set(1.5, 0.4, 1.2);
      group.add(moss);
    }
    // Extra moss on back
    const backMoss = new THREE.Mesh(new THREE.SphereGeometry(s*0.15, 5, 4), mMoss);
    backMoss.position.set(0, s*0.85, -s*0.15);
    backMoss.scale.set(1.5, 0.5, 1);
    group.add(backMoss);
    // Broad shoulders - massive
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(s*0.75, s*0.14, s*0.38), mBark);
    shoulders.position.y = s*1.1;
    group.add(shoulders);
    // Head - craggy, ancient face carved from wood
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.24, 8, 8), mBark);
    head.position.set(0, s*1.32, s*0.05); head.scale.set(1.2, 1.05, 0.9);
    group.add(head);
    // Heavy brow ridge with wood grain
    const brow = new THREE.Mesh(new THREE.BoxGeometry(s*0.38, s*0.07, s*0.16), mDarkBark);
    brow.position.set(0, s*1.38, s*0.12);
    group.add(brow);
    // Deep-set glowing ember eyes
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.055, 5, 5), mS(0x0a0500, 0.2));
      socket.position.set(side*s*0.1, s*1.32, s*0.18);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 6, 6), mGlow(0xff6600, 0xff4400, 1.0));
      eye.position.set(side*s*0.1, s*1.32, s*0.21);
      group.add(eye);
    }
    // Flat wide nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.07, s*0.07), mBark);
    nose.position.set(0, s*1.27, s*0.2);
    group.add(nose);
    // Grim mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(s*0.15, s*0.04, s*0.04), mS(0x1a0500, 0.3));
    mouth.position.set(0, s*1.18, s*0.2);
    group.add(mouth);
    // Vine beard - longer, thicker
    for (let i = 0; i < 8; i++) {
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(s*0.012, s*0.006, s*(0.12+Math.random()*0.12), 3), mMoss);
      vine.position.set((i-3.5)*s*0.04, s*1.1, s*0.18);
      vine.rotation.z = (Math.random()-0.5)*0.3;
      vine.rotation.x = 0.2;
      group.add(vine);
    }
    // Cigar - large, with glowing ember and smoke trail
    const cigarBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.03, s*0.035, s*0.28, 6), mS(0x8B7355, 0.7));
    cigarBody.position.set(s*0.12, s*1.22, s*0.24);
    cigarBody.rotation.z = 0.5; cigarBody.rotation.x = -0.2;
    group.add(cigarBody);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(s*0.035, 5, 5), mGlow(0xff4400, 0xff2200, 1.5));
    ember.position.set(s*0.22, s*1.28, s*0.27);
    group.add(ember);
    // Smoke trail
    for (let i = 0; i < 4; i++) {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(s*(0.025+i*0.01), 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.15 - i*0.03 }));
      smoke.position.set(s*(0.24+i*0.03), s*(1.32+i*0.08), s*0.27);
      group.add(smoke);
    }
    // Massive arms - tree-trunk thickness with knot details
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.11, s*0.09, s*0.42, 6), mBark);
      upper.position.set(side*s*0.44, s*0.85, 0);
      upper.rotation.z = side * 0.15;
      group.add(upper);
      // Knot on arm
      const knot = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4), mDarkBark);
      knot.position.set(side*s*0.44, s*0.8, s*0.08);
      group.add(knot);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.09, s*0.075, s*0.38, 6), mBark);
      fore.position.set(side*s*0.47, s*0.5, s*0.05);
      group.add(fore);
      // Large gnarled hands
      const hand = new THREE.Mesh(new THREE.BoxGeometry(s*0.13, s*0.1, s*0.09), mDarkBark);
      hand.position.set(side*s*0.47, s*0.28, s*0.05);
      group.add(hand);
      // Thick fingers
      for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(s*0.018, s*0.022, s*0.09, 4), mDarkBark);
        finger.position.set(side*s*0.47 + (f-1.5)*s*0.025, s*0.22, s*0.08);
        finger.rotation.x = -0.4;
        group.add(finger);
      }
    }
    // Trunk-like legs
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.13, s*0.11, s*0.35, 6), mBark);
      thigh.position.set(side*s*0.16, s*0.35, 0);
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(s*0.11, s*0.13, s*0.3, 6), mBark);
      shin.position.set(side*s*0.16, s*0.08, 0);
      group.add(shin);
      // Rooted feet - spreading out
      const foot = new THREE.Mesh(new THREE.BoxGeometry(s*0.18, s*0.05, s*0.22), mDarkBark);
      foot.position.set(side*s*0.16, s*0.01, s*0.04);
      group.add(foot);
      // Root tendrils from feet
      for (let r = 0; r < 2; r++) {
        const root = new THREE.Mesh(new THREE.CylinderGeometry(s*0.012, s*0.005, s*0.12, 3), mDarkBark);
        root.position.set(side*s*0.16 + (r-0.5)*s*0.06, s*0.01, s*0.12);
        root.rotation.x = -0.8;
        group.add(root);
      }
    }
    // Vines hanging from body
    for (const side of [-1, 1]) {
      for (let v = 0; v < 3; v++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(s*0.008, s*0.004, s*(0.12+Math.random()*0.08), 3), mMoss);
        vine.position.set(side*s*(0.35+v*0.05), s*(0.7 - v*0.12), -s*0.08);
        group.add(vine);
      }
    }

  } else if (def === ENEMY_DEFS.diwata) {
    // Corrupted nature spirit - ethereal horror, reality-bending
    const mEther = (c, em) => new THREE.MeshStandardMaterial({
      color: c, metalness: 0.5, roughness: 0.2, emissive: em, emissiveIntensity: 0.5,
      transparent: true, opacity: 0.85
    });
    const mVoid = (c) => new THREE.MeshStandardMaterial({
      color: c, metalness: 0.6, roughness: 0.15, emissive: c, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.4
    });
    // Flowing robe body - tapers, multiple ghostly layers
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(s*0.15, s*0.38, s*0.75, 10), mEther(0x330066, 0x220044));
    robe.position.y = s*0.45;
    group.add(robe);
    // Ghostly outer layer
    const robeOuter = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2, s*0.45, s*0.7, 10), mVoid(0x440088));
    robeOuter.position.y = s*0.47;
    group.add(robeOuter);
    // Third wispy layer
    const robeWisp = new THREE.Mesh(new THREE.CylinderGeometry(s*0.22, s*0.5, s*0.6, 8),
      new THREE.MeshBasicMaterial({ color: 0x330055, transparent: true, opacity: 0.12 }));
    robeWisp.position.y = s*0.5;
    group.add(robeWisp);
    // Upper body - elegant but corrupted
    const chest = new THREE.Mesh(new THREE.BoxGeometry(s*0.36, s*0.32, s*0.2), mEther(0x440077, 0x330055));
    chest.position.y = s*0.95;
    group.add(chest);
    // Corrupted veins across chest
    for (let i = 0; i < 4; i++) {
      const vein = new THREE.Mesh(new THREE.CylinderGeometry(s*0.005, s*0.003, s*0.15, 3),
        mGlow(0xaa00ff, 0x8800cc, 0.8));
      vein.position.set((Math.random()-0.5)*s*0.2, s*0.9+Math.random()*s*0.15, s*0.1);
      vein.rotation.z = (Math.random()-0.5)*1.0;
      group.add(vein);
    }
    // Corrupted tendrils from waist - more numerous, animated-looking
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const len = s*(0.15 + Math.random()*0.1);
      const tendril = new THREE.Mesh(new THREE.CylinderGeometry(s*0.012, s*0.004, len, 4),
        mGlow(0x660099, 0x440066, 0.6));
      tendril.position.set(Math.cos(angle)*s*0.32, s*0.18, Math.sin(angle)*s*0.32);
      tendril.rotation.x = Math.cos(angle) * 0.6;
      tendril.rotation.z = Math.sin(angle) * 0.6;
      group.add(tendril);
    }
    // Head - hauntingly beautiful, corrupted
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.19, 10, 10), mEther(0x997788, 0x440044));
    head.position.set(0, s*1.22, 0); head.scale.set(1, 1.15, 0.9);
    group.add(head);
    // Crown of thorns - more elaborate
    const crown = new THREE.Mesh(new THREE.TorusGeometry(s*0.2, s*0.018, 6, 14), mS(0x2a0a2a, 0.6, 0.3));
    crown.position.y = s*1.34;
    crown.rotation.x = Math.PI / 2;
    group.add(crown);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const thorn = new THREE.Mesh(new THREE.ConeGeometry(s*0.012, s*0.1, 3), mS(0x2a0a2a, 0.5, 0.2));
      thorn.position.set(Math.cos(angle)*s*0.2, s*1.36, Math.sin(angle)*s*0.2);
      thorn.rotation.x = Math.cos(angle) * 0.5;
      thorn.rotation.z = -Math.sin(angle) * 0.5;
      group.add(thorn);
    }
    // Glowing eyes - intense, otherworldly
    for (const side of [-1, 1]) {
      // Eye glow halo
      const halo = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.25 }));
      halo.position.set(side*s*0.07, s*1.24, s*0.14);
      group.add(halo);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 8, 8), mGlow(0xff00ff, 0xff00ff, 1.5));
      eye.position.set(side*s*0.07, s*1.24, s*0.15);
      group.add(eye);
    }
    // Dark elegant lips
    const lips = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.015, s*0.03), mS(0x440033, 0.3));
    lips.position.set(0, s*1.13, s*0.16);
    group.add(lips);
    // Long flowing hair - ethereal, floating
    for (let i = 0; i < 14; i++) {
      const strand = new THREE.Mesh(
        new THREE.CylinderGeometry(s*0.008, s*0.004, s*(0.3+Math.random()*0.25), 3),
        new THREE.MeshStandardMaterial({
          color: 0x1a001a, transparent: true, opacity: 0.6,
          emissive: 0x220022, emissiveIntensity: 0.2
        }));
      strand.position.set((i-6.5)*s*0.03, s*1.12, -s*0.12);
      strand.rotation.x = 0.3 + Math.random()*0.4;
      strand.rotation.z = (Math.random()-0.5)*0.25;
      group.add(strand);
    }
    // Ethereal arms - slender, glowing, longer
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.035, s*0.03, s*0.32, 5),
        mEther(0x550088, 0x330055));
      upper.position.set(side*s*0.25, s*0.85, 0);
      upper.rotation.z = side * 0.25;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.03, s*0.025, s*0.28, 5),
        mEther(0x550088, 0x330055));
      fore.position.set(side*s*0.32, s*0.58, s*0.05);
      fore.rotation.x = side > 0 ? -0.4 : -0.2;
      group.add(fore);
      // Glowing fingertips - magical energy
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s*0.035, 5, 5),
        mGlow(0xcc44ff, 0xaa22ff, 1.0));
      hand.position.set(side*s*0.32, s*0.42, s*0.1);
      group.add(hand);
      // Energy trail from fingers
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(s*0.02, s*0.005, s*0.1, 3),
        new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.2 }));
      trail.position.set(side*s*0.32, s*0.35, s*0.12);
      group.add(trail);
    }
    // Floating orbs - more, with energy connections
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(s*0.035, 8, 8),
        mGlow(0xcc66ff, 0xaa44ff, 0.8));
      orb.position.set(Math.cos(angle)*s*0.55, s*0.8 + Math.sin(angle*2)*s*0.12, Math.sin(angle)*s*0.55);
      group.add(orb);
    }
    // Inner aura - multi-layered
    const innerAura = new THREE.Mesh(new THREE.SphereGeometry(s*0.5, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x6600aa, transparent: true, opacity: 0.08 }));
    innerAura.position.y = s*0.8;
    group.add(innerAura);
    const outerAura = new THREE.Mesh(new THREE.SphereGeometry(s*0.7, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x440066, transparent: true, opacity: 0.04 }));
    outerAura.position.y = s*0.8;
    group.add(outerAura);

  } else {
    // Generic fallback
    const body = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2, s*0.18, s*0.6, 6), mSkin(bp.body));
    body.position.y = s*0.7;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.22, 8, 8), mSkin(bp.head));
    head.position.y = s*1.1;
    group.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 5, 5), mGlow(0xff2200, 0xff0000, 0.8));
      eye.position.set(side*s*0.09, s*1.13, s*0.18);
      group.add(eye);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.05, s*0.45, 5), mSkin(bp.limbs));
      arm.position.set(side*s*0.35, s*0.65, 0);
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.07, s*0.06, s*0.4, 5), mSkin(bp.limbs));
      leg.position.set(side*s*0.15, s*0.2, 0);
      group.add(leg);
    }
  }

  // --- NAME + HEALTH BAR label above head ---
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 256; labelCanvas.height = 48;
  const lctx = labelCanvas.getContext('2d');
  // Name
  lctx.font = 'bold 18px sans-serif';
  lctx.fillStyle = def.boss ? '#ff44ff' : '#ff4444';
  lctx.textAlign = 'center';
  lctx.fillText(def.name, 128, 16);
  // Health bar background
  lctx.fillStyle = '#333333';
  lctx.fillRect(48, 22, 160, 10);
  // Health bar fill
  lctx.fillStyle = def.boss ? '#ff44ff' : '#cc0000';
  lctx.fillRect(48, 22, 160, 10);
  // Health bar border
  lctx.strokeStyle = '#666666';
  lctx.strokeRect(48, 22, 160, 10);

  const labelTex = new THREE.CanvasTexture(labelCanvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
  label.position.y = s * 1.5;
  label.scale.set(2, 0.4, 1);
  label.userData.isLabel = true;
  label.userData.canvas = labelCanvas;
  label.userData.texture = labelTex;
  group.add(label);

  // Eye glow light for all enemies
  if (def === ENEMY_DEFS.aswang || def === ENEMY_DEFS.manananggal) {
    const eyeLight = new THREE.PointLight(0xff0000, 0.4, 3);
    eyeLight.position.set(0, s * 1.0, s * 0.25);
    group.add(eyeLight);
  } else if (def === ENEMY_DEFS.infected || def === ENEMY_DEFS.tiyanak) {
    const eyeLight = new THREE.PointLight(0xff6600, 0.25, 2);
    eyeLight.position.set(0, s * 0.7, s * 0.2);
    group.add(eyeLight);
  }

  // Kapre cigar light + eye glow
  if (def === ENEMY_DEFS.kapre) {
    const cigarLight = new THREE.PointLight(0xff4400, 0.6, 5);
    cigarLight.position.set(s * 0.22, s * 1.28, s * 0.27);
    group.add(cigarLight);
    const eyeLight = new THREE.PointLight(0xff6600, 0.3, 4);
    eyeLight.position.set(0, s * 1.32, s * 0.2);
    group.add(eyeLight);
  }

  // Diwata aura light
  if (def === ENEMY_DEFS.diwata) {
    const auraLight = new THREE.PointLight(0x8800ff, 2.0, 14);
    auraLight.position.y = s * 0.8;
    group.add(auraLight);
  }

  // Tikbalang eye glow
  if (def === ENEMY_DEFS.tikbalang) {
    const eyeLight = new THREE.PointLight(0xffcc00, 0.4, 4);
    eyeLight.position.set(0, s * 1.24, s * 0.23);
    group.add(eyeLight);
  }

  return group;
}

export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.enemies = [];
    this.spawnTimer = 0;
    this.maxEnemies = 20;
    this.difficulty = 1;
  }

  spawnInitial() {
    // Infected AWAY from spawn - scattered around resort perimeter (not on top of player)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.5; // offset so none are at 0,0
      this.spawn('infected', new THREE.Vector3(
        Math.cos(angle) * 35 + (Math.random() - 0.5) * 10,
        0,
        Math.sin(angle) * 35 + (Math.random() - 0.5) * 10
      ));
    }
    // Aswang in the jungle - far from player
    for (let i = 0; i < 3; i++) {
      this.spawn('aswang', new THREE.Vector3(
        -50 + (Math.random() - 0.5) * 30,
        0,
        50 + (Math.random() - 0.5) * 30
      ));
    }
    // Tiyanak near village
    for (let i = 0; i < 3; i++) {
      this.spawn('tiyanak', new THREE.Vector3(
        60 + (Math.random() - 0.5) * 30,
        0,
        20 + (Math.random() - 0.5) * 30
      ));
    }
    // Tikbalang deep jungle
    this.spawn('tikbalang', new THREE.Vector3(-60, 0, 60));
    // Manananggal near temple
    this.spawn('manananggal', new THREE.Vector3(-55, 0, -50));
    // Kapre boss deep jungle
    this.spawn('kapre', new THREE.Vector3(-45, 0, 65));
  }

  spawn(type, position) {
    const def = ENEMY_DEFS[type];
    if (!def || this.enemies.length >= this.maxEnemies) return;

    const model = createEnemyModel(def);
    const groundY = getTerrainHeightFast(position.x, position.z);
    model.position.set(position.x, groundY, position.z);
    this.game.scene.add(model);

    const enemy = {
      type, def, model,
      hp: def.hp * this.difficulty,
      maxHp: def.hp * this.difficulty,
      speed: def.speed,
      attackCooldown: 0,
      hitFlash: 0,
      state: 'idle', // idle, chase, attack, dead
      alertRange: def.boss ? 40 : 20,
      animTime: Math.random() * 10,
      dropItems: this.getDrops(type),
    };
    this.enemies.push(enemy);
    return enemy;
  }

  getDrops(type) {
    const drops = {
      infected: ['scrap_metal', 'cloth_rag'],
      aswang: ['dark_essence', 'sharp_bone'],
      tiyanak: ['herbs', 'coconut'],
      tikbalang: ['thick_hide', 'horse_hair', 'scrap_metal'],
      manananggal: ['dark_essence', 'bat_wing', 'herbs'],
      kapre: ['ancient_wood', 'thick_hide', 'dark_essence', 'dark_essence'],
      diwata: ['sacred_crystal', 'ancient_wood', 'dark_essence'],
    };
    return drops[type] || ['scrap_metal'];
  }

  onNightfall() {
    this.difficulty = 1.5;
    // Spawn extra enemies
    const playerPos = this.game.camera.position;
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 25 + Math.random() * 20;
      const types = ['aswang', 'aswang', 'infected', 'tiyanak', 'manananggal'];
      this.spawn(types[Math.floor(Math.random() * types.length)], new THREE.Vector3(
        playerPos.x + Math.cos(angle) * dist, 0,
        playerPos.z + Math.sin(angle) * dist
      ));
    }
  }

  update(dt) {
    const playerPos = this.game.camera.position;
    this.spawnTimer += dt;

    // Respawn enemies periodically
    if (this.spawnTimer > 15 && this.enemies.length < this.maxEnemies * 0.6) {
      this.spawnTimer = 0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      const types = this.game.isNight
        ? ['aswang', 'aswang', 'manananggal', 'tiyanak', 'infected']
        : ['infected', 'infected', 'tiyanak', 'infected', 'aswang'];
      this.spawn(types[Math.floor(Math.random() * types.length)], new THREE.Vector3(
        playerPos.x + Math.cos(angle) * dist, 0,
        playerPos.z + Math.sin(angle) * dist
      ));
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.state === 'dead') continue;

      e.animTime += dt;
      e.attackCooldown -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt * 3;

      // Distance to player
      const dx = playerPos.x - e.model.position.x;
      const dz = playerPos.z - e.model.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Idle animation - breathing, head tilt, menacing sway
      if (e.state === 'idle') {
        const breathe = Math.sin(e.animTime * 1.5) * 0.02;
        e.model.position.y = getTerrainHeightFast(e.model.position.x, e.model.position.z) + breathe;
        // Slow menacing sway
        e.model.rotation.y += Math.sin(e.animTime * 0.5) * 0.003;
      }

      // State machine
      if (dist < e.alertRange && e.state === 'idle') {
        e.state = 'chase';
        // Growl when first aggroed
        if (Math.random() > 0.5) this.game.audioManager.playEnemyGrowl();
      }

      // Check if a nearby NPC is closer than the player and target them
      let targetPos = playerPos;
      let targetDist = dist;
      let targetIsNPC = false;
      let targetNPC = null;

      if (this.game.npcManager) {
        for (const npc of Object.values(this.game.npcManager.npcs)) {
          if (npc.combatState === 'downed') continue;
          const nx = npc.model.position.x - e.model.position.x;
          const nz = npc.model.position.z - e.model.position.z;
          const nDist = Math.sqrt(nx * nx + nz * nz);
          // Enemies aggro on NPCs that are fighting them or just nearby
          if (nDist < 12 && (npc.combatState === 'fighting' || nDist < dist * 0.6)) {
            targetPos = npc.model.position;
            targetDist = nDist;
            targetIsNPC = true;
            targetNPC = npc;
          }
        }
      }

      if (e.state === 'chase') {
        const tdx = targetPos.x - e.model.position.x;
        const tdz = targetPos.z - e.model.position.z;
        const tDist = Math.sqrt(tdx * tdx + tdz * tdz);

        // Move toward target
        if (tDist > 0.5) {
          const moveX = (tdx / tDist) * e.speed * dt;
          const moveZ = (tdz / tDist) * e.speed * dt;
          e.model.position.x += moveX;
          e.model.position.z += moveZ;
        }

        // Ground follow
        const gy = getTerrainHeightFast(e.model.position.x, e.model.position.z);
        e.model.position.y = gy;

        // Face target
        e.model.rotation.y = Math.atan2(tdx, tdz);

        // Walk animation
        const walkBob = Math.sin(e.animTime * e.speed * 2) * 0.1;
        const s = e.def.size || 1;
        e.model.children.forEach((c, ci) => {
          // Swing limbs that are positioned at the sides of the body
          if (c.isMesh && Math.abs(c.position.x) > s * 0.2 && c.position.y > s * 0.3) {
            c.rotation.x = Math.sin(e.animTime * e.speed * 2 + ci) * 0.5;
          }
        });
        e.model.position.y += Math.abs(walkBob) * 0.1;

        // Attack NPC target
        if (targetIsNPC && targetNPC && tDist < e.def.attackRange && e.attackCooldown <= 0) {
          e.attackCooldown = e.def.attackSpeed;
          const dmg = Math.floor(e.def.damage * this.difficulty);
          this.game.npcManager.damageNPC(targetNPC, dmg, e.def.name);
        }
        // Attack player
        else if (!targetIsNPC && dist < e.def.attackRange && e.attackCooldown <= 0) {
          e.attackCooldown = e.def.attackSpeed;
          const dmg = Math.floor(e.def.damage * this.difficulty);
          this.game.player.takeDamage(dmg, e.def.name);
          this.game.ui.addMessage(`${e.def.name} hits you for ${dmg} damage!`, 'combat');
        }
      }

      // Hit flash visual
      if (e.hitFlash > 0) {
        e.model.children.forEach(c => {
          if (c.material && c.material.emissive) {
            c.material.emissive.setHex(0xff4444);
            c.material.emissiveIntensity = e.hitFlash;
          }
        });
      } else {
        e.model.children.forEach(c => {
          if (c.material && c.material.emissive && c.material.emissiveIntensity > 0) {
            c.material.emissive.setHex(0x000000);
            c.material.emissiveIntensity = 0;
          }
        });
      }

      // Too far away - despawn (but never despawn bosses)
      if (dist > 100 && !e.def.boss) {
        this.game.scene.remove(e.model);
        this.enemies.splice(i, 1);
      }
    }
  }

  meleeHit(origin, direction, range, damage) {
    let hit = false;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const toEnemy = e.model.position.clone().sub(origin);
      toEnemy.y = 0;
      const dist = toEnemy.length();
      if (dist > range) continue;

      // Check angle
      const dir2d = direction.clone();
      dir2d.y = 0;
      dir2d.normalize();
      toEnemy.normalize();
      const dot = dir2d.dot(toEnemy);
      if (dot < 0.5) continue; // ~60 degree cone

      this.damageEnemy(e, damage);
      hit = true;
    }
    if (!hit) {
      this.game.audioManager.playSwing();
    }
  }

  aoeHit(center, radius, damage) {
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const dist = e.model.position.distanceTo(center);
      if (dist <= radius) {
        this.damageEnemy(e, damage);
      }
    }
  }

  rangedHit(origin, direction, range, damage) {
    const ray = new THREE.Raycaster(origin, direction, 0, range);
    let closest = null, closestDist = range;

    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const hits = ray.intersectObject(e.model, true);
      if (hits.length > 0 && hits[0].distance < closestDist) {
        closest = e;
        closestDist = hits[0].distance;
      }
    }
    if (closest) this.damageEnemy(closest, damage);
  }

  updateHealthBar(e) {
    // Find the label sprite and redraw health bar
    const label = e.model.children.find(c => c.userData && c.userData.isLabel);
    if (!label) return;
    const canvas = label.userData.canvas;
    const ctx = canvas.getContext('2d');
    const hpPct = Math.max(0, e.hp / e.maxHp);

    // Clear and redraw
    ctx.clearRect(0, 18, 256, 30);
    // BG
    ctx.fillStyle = '#333333';
    ctx.fillRect(48, 22, 160, 10);
    // Fill
    const barColor = hpPct > 0.5 ? '#cc0000' : hpPct > 0.25 ? '#cc6600' : '#ff0000';
    ctx.fillStyle = e.def.boss ? '#ff44ff' : barColor;
    ctx.fillRect(48, 22, 160 * hpPct, 10);
    // Border
    ctx.strokeStyle = '#666666';
    ctx.strokeRect(48, 22, 160, 10);

    label.userData.texture.needsUpdate = true;
  }

  damageEnemy(e, damage) {
    e.hp -= damage;
    e.hitFlash = 1;
    e.state = 'chase';
    this.updateHealthBar(e);
    this.game.ui.addMessage(`${e.def.name}: -${damage} HP (${Math.max(0, e.hp)}/${e.maxHp})`, 'combat');
    this.game.audioManager.playHit();

    if (e.hp <= 0) {
      this.killEnemy(e);
    }
  }

  killEnemy(e) {
    e.state = 'dead';
    this.game.audioManager.playEnemyDeath();
    this.game.kills++;
    this.game.player.addXP(e.def.xp);
    this.game.player.gold += e.def.gold;
    this.game.ui.addMessage(`Killed ${e.def.name}! +${e.def.xp} XP, +${e.def.gold} gold`, 'loot');

    // Drop items
    for (const itemId of e.dropItems) {
      if (Math.random() < 0.6) {
        this.game.itemManager.spawnItem(itemId, e.model.position.clone());
      }
    }

    // Quest triggers
    this.game.questManager.triggerEvent('kill_' + e.type);
    if (e.def.boss) this.game.questManager.triggerEvent('kill_boss_' + e.type);

    // Night kill tracking
    if (this.game.isNight) {
      this.game.questManager.triggerEvent('kill_night');
    }

    // Location-based kill tracking
    const pos = e.model.position;
    const villageDist = Math.sqrt((pos.x - 60) ** 2 + (pos.z - 20) ** 2);
    if (villageDist < 35) this.game.questManager.triggerEvent('kill_village_enemy');

    const coveDist = Math.sqrt((pos.x - 70) ** 2 + (pos.z + 50) ** 2);
    if (coveDist < 25) this.game.questManager.triggerEvent('kill_cove_enemy');

    // Death animation - topple over, flash, fade out
    const model = e.model;
    const fallDir = (Math.random() > 0.5 ? 1 : -1);
    let deathTime = 0;
    const deathInterval = setInterval(() => {
      deathTime += 0.03;

      // Phase 1 (0-0.5s): topple over sideways
      if (deathTime < 0.5) {
        model.rotation.z += fallDir * 0.06;
        model.position.y -= 0.01;
      }

      // Phase 2 (0.5-1.5s): lie on ground, flash red then fade
      if (deathTime >= 0.5) {
        const fadeProgress = (deathTime - 0.5) / 1.0; // 0 to 1 over 1 second
        model.children.forEach(c => {
          if (c.material) {
            if (!c.material.transparent) {
              c.material = c.material.clone();
              c.material.transparent = true;
            }
            c.material.opacity = Math.max(0, 1 - fadeProgress);
          }
        });
      }

      // Phase 3 (1.5s+): remove
      if (deathTime >= 1.5) {
        clearInterval(deathInterval);
        this.game.scene.remove(model);
        const idx = this.enemies.indexOf(e);
        if (idx >= 0) this.enemies.splice(idx, 1);
      }
    }, 30);
  }
}
