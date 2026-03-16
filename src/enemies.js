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
  const mL = (c) => new THREE.MeshLambertMaterial({ color: c });
  const mB = (c) => new THREE.MeshBasicMaterial({ color: c });

  // --- Type-specific body builds ---
  if (def === ENEMY_DEFS.infected) {
    // Hunched humanoid in tattered clothes
    // Torso - slightly hunched
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.45, s*0.5, s*0.25), mL(0x556644));
    torso.position.y = s*0.75; torso.rotation.x = 0.15;
    group.add(torso);
    // Tattered shirt overlay
    const shirt = new THREE.Mesh(new THREE.BoxGeometry(s*0.47, s*0.3, s*0.26), mL(0x667755));
    shirt.position.y = s*0.85;
    group.add(shirt);
    // Head - pale
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.18, 6, 6), mL(0x998877));
    head.position.set(0, s*1.05, s*0.05); head.scale.set(1, 1.1, 0.9);
    group.add(head);
    // Sunken eyes
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4), mL(0x333322));
      socket.position.set(side*s*0.07, s*1.07, s*0.18);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.025, 4, 4), mB(0xffaa00));
      eye.position.set(side*s*0.07, s*1.07, s*0.2);
      group.add(eye);
    }
    // Slack jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.04, s*0.06), mL(0x885555));
    jaw.position.set(0, s*0.95, s*0.15);
    group.add(jaw);
    // Arms - one reaching forward
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.3, s*0.1), mL(bp.limbs));
      upper.position.set(side*s*0.3, s*0.7, side > 0 ? s*0.15 : 0);
      upper.rotation.x = side > 0 ? -0.6 : 0;
      group.add(upper);
      const hand = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.08, s*0.04), mL(0x998877));
      hand.position.set(side*s*0.3, s*0.5, side > 0 ? s*0.3 : 0);
      group.add(hand);
    }
    // Legs in shorts
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.4, s*0.14), mL(0x554433));
      leg.position.set(side*s*0.13, s*0.2, 0);
      group.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.05, s*0.16), mL(0x443322));
      foot.position.set(side*s*0.13, s*0.02, s*0.03);
      group.add(foot);
    }
  } else if (def === ENEMY_DEFS.aswang) {
    // Crouched, long-armed creature with claws and fangs
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.4, s*0.45, s*0.3), mL(bp.body));
    torso.position.y = s*0.65; torso.rotation.x = 0.3;
    group.add(torso);
    // Spine ridges
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(s*0.03, s*0.08, 4), mL(0x220000));
      spike.position.set(0, s*(0.75 + i*0.08), -s*0.15);
      spike.rotation.x = -0.3;
      group.add(spike);
    }
    // Head with long hair
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.2, 6, 6), mL(bp.head));
    head.position.set(0, s*0.95, s*0.1); head.scale.set(1, 1.1, 0.85);
    group.add(head);
    // Stringy hair
    for (let i = 0; i < 5; i++) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(s*0.02, s*0.25, s*0.01), mL(0x1a0505));
      hair.position.set((i-2)*s*0.06, s*1.0, -s*0.1);
      hair.rotation.x = 0.3 + Math.random()*0.3;
      group.add(hair);
    }
    // Glowing red eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.05, 4, 4), mB(0xff0000));
      eye.position.set(side*s*0.08, s*0.98, s*0.22);
      group.add(eye);
    }
    // Wide mouth with fangs
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.03, s*0.04), mL(0x440000));
    mouth.position.set(0, s*0.88, s*0.2);
    group.add(mouth);
    for (const side of [-0.03, 0.03]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(s*0.012, s*0.04, 4), mL(0xeeeecc));
      fang.position.set(side*s, s*0.85, s*0.2);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }
    // Long arms with claws
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.5, s*0.1), mL(bp.limbs));
      arm.position.set(side*s*0.3, s*0.5, s*0.1);
      arm.rotation.x = -0.4;
      group.add(arm);
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s*0.015, s*0.08, 3), mL(0x332222));
        claw.position.set(side*s*0.3 + c*s*0.025, s*0.22, s*0.2);
        claw.rotation.x = -0.5;
        group.add(claw);
      }
    }
    // Crouched legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.13, s*0.35, s*0.13), mL(bp.limbs));
      leg.position.set(side*s*0.15, s*0.18, 0);
      group.add(leg);
    }
  } else if (def === ENEMY_DEFS.tiyanak) {
    // Tiny demonic baby - oversized head, small body
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.4, 8, 6), mL(0xBBAA99));
    head.position.y = s*0.6; head.scale.set(1, 1.1, 0.9);
    group.add(head);
    // Dark eye sockets
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.12, 4, 4), mL(0x221111));
      socket.position.set(side*s*0.15, s*0.65, s*0.3);
      group.add(socket);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4), mB(0xff4400));
      pupil.position.set(side*s*0.15, s*0.65, s*0.38);
      group.add(pupil);
    }
    // Grin
    const grin = new THREE.Mesh(new THREE.BoxGeometry(s*0.25, s*0.04, s*0.02), mL(0x330000));
    grin.position.set(0, s*0.45, s*0.35);
    group.add(grin);
    // Tiny teeth
    for (let i = 0; i < 5; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(s*0.01, s*0.03, 3), mL(0xddddaa));
      tooth.position.set((i-2)*s*0.05, s*0.44, s*0.36);
      tooth.rotation.x = Math.PI;
      group.add(tooth);
    }
    // Tiny body
    const body = new THREE.Mesh(new THREE.BoxGeometry(s*0.3, s*0.25, s*0.2), mL(0xAA9988));
    body.position.y = s*0.2;
    group.add(body);
    // Stubby arms reaching out
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.2, s*0.08), mL(0xBBAA99));
      arm.position.set(side*s*0.22, s*0.25, s*0.1);
      arm.rotation.x = -0.5;
      group.add(arm);
    }
    // Stubby legs
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.12, s*0.1), mL(0xAA9988));
      leg.position.set(side*s*0.1, s*0.05, 0);
      group.add(leg);
    }
  } else if (def === ENEMY_DEFS.tikbalang) {
    // Tall horse-headed humanoid
    // Muscular torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.5, s*0.5, s*0.3), mL(bp.body));
    torso.position.y = s*0.75;
    group.add(torso);
    // Broad shoulders
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(s*0.6, s*0.1, s*0.28), mL(bp.body));
    shoulders.position.y = s*1.0;
    group.add(shoulders);
    // Horse head - elongated
    const head = new THREE.Mesh(new THREE.BoxGeometry(s*0.2, s*0.25, s*0.35), mL(bp.head));
    head.position.set(0, s*1.2, s*0.08);
    group.add(head);
    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.12, s*0.2), mL(bp.head));
    snout.position.set(0, s*1.1, s*0.25);
    group.add(snout);
    // Nostrils
    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(s*0.02, 4, 4), mL(0x221100));
      nostril.position.set(side*s*0.04, s*1.08, s*0.35);
      group.add(nostril);
    }
    // Amber eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4), mB(0xffcc00));
      eye.position.set(side*s*0.08, s*1.22, s*0.2);
      group.add(eye);
    }
    // Wild mane
    for (let i = 0; i < 7; i++) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(s*0.03, s*0.2+Math.random()*s*0.1, s*0.02), mL(0x1a0a00));
      hair.position.set((i-3)*s*0.04, s*1.3, -s*0.05);
      hair.rotation.x = 0.5;
      group.add(hair);
    }
    // Muscular arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.45, s*0.14), mL(bp.limbs));
      arm.position.set(side*s*0.38, s*0.7, 0);
      group.add(arm);
      // Hooved fist
      const hoof = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.08, s*0.12), mL(0x332211));
      hoof.position.set(side*s*0.38, s*0.45, 0);
      group.add(hoof);
    }
    // Digitigrade legs
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.BoxGeometry(s*0.16, s*0.3, s*0.16), mL(bp.limbs));
      thigh.position.set(side*s*0.15, s*0.35, 0);
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.25, s*0.12), mL(bp.limbs));
      shin.position.set(side*s*0.15, s*0.1, s*0.05);
      group.add(shin);
      const hoof = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.08, s*0.06, 6), mL(0x332211));
      hoof.position.set(side*s*0.15, s*0.02, s*0.05);
      group.add(hoof);
    }
  } else if (def === ENEMY_DEFS.manananggal) {
    // Half-bodied flying creature - upper torso with bat wings, dangling entrails, no legs
    const mGlow = (c, em, i = 0.3) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.5, emissive: em, emissiveIntensity: i });
    // Upper torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(s*0.45, s*0.4, s*0.25), mL(bp.body));
    torso.position.y = s*0.9;
    group.add(torso);
    // Exposed ribcage at bottom
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(s*0.12, s*0.015, 4, 8, Math.PI), mL(0xccbbaa));
      rib.position.set(0, s*(0.72 - i*0.05), s*0.02);
      rib.rotation.x = Math.PI * 0.5;
      rib.rotation.z = Math.PI;
      group.add(rib);
    }
    // Dangling entrails/intestines
    for (let i = 0; i < 5; i++) {
      const len = s*(0.2 + Math.random()*0.2);
      const entrail = new THREE.Mesh(new THREE.CylinderGeometry(s*0.015, s*0.01, len, 5), mL(0x882244));
      entrail.position.set((Math.random()-0.5)*s*0.25, s*0.55 - len/2, (Math.random()-0.5)*s*0.1);
      entrail.rotation.z = (Math.random()-0.5)*0.3;
      group.add(entrail);
    }
    // Blood drip spheres at bottom
    for (let i = 0; i < 3; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(s*0.02, 4, 4), mB(0xaa0022));
      drip.position.set((Math.random()-0.5)*s*0.2, s*(0.35 + Math.random()*0.1), 0);
      group.add(drip);
    }
    // Head - wild-eyed with long tongue
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.2, 8, 6), mL(bp.head));
    head.position.set(0, s*1.15, s*0.05); head.scale.set(1, 1.1, 0.9);
    group.add(head);
    // Long wild hair
    for (let i = 0; i < 8; i++) {
      const hair = new THREE.Mesh(new THREE.BoxGeometry(s*0.025, s*(0.2+Math.random()*0.15), s*0.015), mL(0x0a0005));
      hair.position.set((i-3.5)*s*0.05, s*1.15, -s*0.1);
      hair.rotation.x = 0.4 + Math.random()*0.4;
      hair.rotation.z = (Math.random()-0.5)*0.3;
      group.add(hair);
    }
    // Bloodshot eyes
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 6, 6), mL(0xffddcc));
      eyeWhite.position.set(side*s*0.08, s*1.18, s*0.16);
      group.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(s*0.03, 4, 4), mB(0xff0000));
      pupil.position.set(side*s*0.08, s*1.18, s*0.21);
      group.add(pupil);
    }
    // Wide open mouth with fangs
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.06, s*0.04), mL(0x440000));
    mouth.position.set(0, s*1.05, s*0.18);
    group.add(mouth);
    for (const x of [-0.04, -0.02, 0.02, 0.04]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(s*0.01, s*0.04, 3), mL(0xeeeedd));
      fang.position.set(x*s, s*1.01, s*0.18);
      fang.rotation.x = Math.PI;
      group.add(fang);
    }
    // Long tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(s*0.03, s*0.02, s*0.2), mL(0xcc2255));
    tongue.position.set(0, s*1.02, s*0.28);
    tongue.rotation.x = 0.3;
    group.add(tongue);
    // Arms - elongated with claws
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(s*0.1, s*0.35, s*0.1), mL(bp.limbs));
      upper.position.set(side*s*0.32, s*0.85, 0);
      upper.rotation.z = side * 0.3;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.3, s*0.08), mL(bp.limbs));
      fore.position.set(side*s*0.4, s*0.55, s*0.05);
      fore.rotation.x = -0.3;
      group.add(fore);
      for (let c = -1; c <= 1; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(s*0.012, s*0.06, 3), mL(0x221111));
        claw.position.set(side*s*0.4 + c*s*0.025, s*0.38, s*0.12);
        claw.rotation.x = -0.6;
        group.add(claw);
      }
    }
    // Bat wings - multi-segment membrane
    for (const side of [-1, 1]) {
      // Wing bone
      const bone1 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.02, s*0.015, s*0.6, 4), mL(0x331133));
      bone1.position.set(side*s*0.5, s*1.0, -s*0.08);
      bone1.rotation.z = side * 1.2;
      group.add(bone1);
      const bone2 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.015, s*0.01, s*0.5, 4), mL(0x331133));
      bone2.position.set(side*s*0.65, s*0.85, -s*0.08);
      bone2.rotation.z = side * 0.8;
      group.add(bone2);
      // Wing membrane - translucent
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(side*s*0.7, s*0.3);
      wingShape.lineTo(side*s*0.8, 0);
      wingShape.lineTo(side*s*0.6, -s*0.2);
      wingShape.lineTo(0, -s*0.15);
      const wingGeo = new THREE.ShapeGeometry(wingShape);
      const wingMat = new THREE.MeshLambertMaterial({ color: 0x441144, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(0, s*0.95, -s*0.1);
      wing.rotation.y = side > 0 ? -0.15 : 0.15;
      group.add(wing);
    }

  } else if (def === ENEMY_DEFS.kapre) {
    // Massive tree giant - bark-textured skin, moss, cigar, leaf beard
    const mBark = new THREE.MeshStandardMaterial({ color: 0x3D2B1F, roughness: 0.95, metalness: 0 });
    const mMoss = new THREE.MeshLambertMaterial({ color: 0x2a4a20 });
    // Massive torso - barrel-shaped
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.25, s*0.55, 8), mBark);
    torso.position.y = s*0.8;
    group.add(torso);
    // Bark texture rings on torso
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(s*0.28, s*0.02, 4, 8), mL(0x2D1B0F));
      ring.position.y = s*(0.65 + i*0.15);
      ring.rotation.x = Math.PI/2;
      group.add(ring);
    }
    // Moss patches on shoulders
    for (const side of [-1, 1]) {
      const moss = new THREE.Mesh(new THREE.SphereGeometry(s*0.12, 5, 4), mMoss);
      moss.position.set(side*s*0.28, s*1.05, s*0.05);
      moss.scale.set(1.5, 0.5, 1);
      group.add(moss);
    }
    // Broad shoulders
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(s*0.7, s*0.12, s*0.35), mBark);
    shoulders.position.y = s*1.08;
    group.add(shoulders);
    // Head - craggy, wide with deep-set eyes
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.22, 6, 6), mBark);
    head.position.set(0, s*1.3, s*0.05); head.scale.set(1.2, 1, 0.9);
    group.add(head);
    // Heavy brow ridge
    const brow = new THREE.Mesh(new THREE.BoxGeometry(s*0.35, s*0.06, s*0.15), mL(0x2D1B0F));
    brow.position.set(0, s*1.35, s*0.12);
    group.add(brow);
    // Deep-set glowing amber eyes
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(s*0.05, 4, 4), mL(0x1a0a00));
      socket.position.set(side*s*0.1, s*1.3, s*0.17);
      group.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.035, 4, 4), mB(0xff8800));
      eye.position.set(side*s*0.1, s*1.3, s*0.2);
      group.add(eye);
    }
    // Flat wide nose
    const nose = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.06, s*0.06), mL(0x3D2B1F));
    nose.position.set(0, s*1.25, s*0.2);
    group.add(nose);
    // Leaf/vine beard
    for (let i = 0; i < 6; i++) {
      const vine = new THREE.Mesh(new THREE.BoxGeometry(s*0.025, s*(0.1+Math.random()*0.1), s*0.015), mMoss);
      vine.position.set((i-2.5)*s*0.05, s*1.12, s*0.18);
      vine.rotation.z = (Math.random()-0.5)*0.3;
      group.add(vine);
    }
    // Cigar - large, with ember glow
    const cigarBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.025, s*0.03, s*0.25, 6), mL(0x8B7355));
    cigarBody.position.set(s*0.12, s*1.2, s*0.22);
    cigarBody.rotation.z = 0.5; cigarBody.rotation.x = -0.2;
    group.add(cigarBody);
    const ember = new THREE.Mesh(new THREE.SphereGeometry(s*0.03, 4, 4), mB(0xff4400));
    ember.position.set(s*0.2, s*1.25, s*0.25);
    group.add(ember);
    // Smoke wisps (small translucent spheres)
    for (let i = 0; i < 3; i++) {
      const smoke = new THREE.Mesh(new THREE.SphereGeometry(s*0.03, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.2 }));
      smoke.position.set(s*(0.22+i*0.04), s*(1.3+i*0.06), s*0.25);
      group.add(smoke);
    }
    // Massive arms - tree-trunk thickness
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(s*0.1, s*0.08, s*0.4, 6), mBark);
      upper.position.set(side*s*0.42, s*0.85, 0);
      upper.rotation.z = side * 0.15;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(s*0.08, s*0.07, s*0.35, 6), mBark);
      fore.position.set(side*s*0.45, s*0.5, s*0.05);
      group.add(fore);
      // Large gnarled hands
      const hand = new THREE.Mesh(new THREE.BoxGeometry(s*0.12, s*0.1, s*0.08), mL(0x4D3B2F));
      hand.position.set(side*s*0.45, s*0.3, s*0.05);
      group.add(hand);
      // Thick fingers
      for (let f = 0; f < 3; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(s*0.015, s*0.02, s*0.08, 4), mL(0x4D3B2F));
        finger.position.set(side*s*0.45 + (f-1)*s*0.03, s*0.24, s*0.08);
        finger.rotation.x = -0.4;
        group.add(finger);
      }
    }
    // Trunk-like legs
    for (const side of [-1, 1]) {
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.12, s*0.1, s*0.35, 6), mBark);
      thigh.position.set(side*s*0.15, s*0.35, 0);
      group.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(s*0.1, s*0.12, s*0.3, 6), mBark);
      shin.position.set(side*s*0.15, s*0.08, 0);
      group.add(shin);
      // Rooted feet
      const foot = new THREE.Mesh(new THREE.BoxGeometry(s*0.15, s*0.05, s*0.2), mL(0x2D1B0F));
      foot.position.set(side*s*0.15, s*0.01, s*0.04);
      group.add(foot);
    }
    // Vines hanging from arms
    for (const side of [-1, 1]) {
      for (let v = 0; v < 2; v++) {
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(s*0.008, s*0.005, s*0.15, 3), mMoss);
        vine.position.set(side*s*0.42, s*0.6 - v*0.15, -s*0.05);
        group.add(vine);
      }
    }

  } else if (def === ENEMY_DEFS.diwata) {
    // Corrupted nature spirit - ethereal, flowing robes, crown of thorns, magical aura
    const mEther = (c, em) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.4, roughness: 0.3, emissive: em, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    // Flowing robe body - tapers at top
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(s*0.15, s*0.35, s*0.7, 8), mEther(0x330066, 0x220044));
    robe.position.y = s*0.45;
    group.add(robe);
    // Robe layers - overlapping translucent
    const robeOuter = new THREE.Mesh(new THREE.CylinderGeometry(s*0.18, s*0.4, s*0.65, 8),
      new THREE.MeshLambertMaterial({ color: 0x440088, transparent: true, opacity: 0.35 }));
    robeOuter.position.y = s*0.47;
    group.add(robeOuter);
    // Upper body
    const chest = new THREE.Mesh(new THREE.BoxGeometry(s*0.35, s*0.3, s*0.2), mEther(0x440077, 0x330055));
    chest.position.y = s*0.95;
    group.add(chest);
    // Corrupted tendrils from waist
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const tendril = new THREE.Mesh(new THREE.CylinderGeometry(s*0.012, s*0.005, s*0.2, 4),
        new THREE.MeshBasicMaterial({ color: 0x660099, transparent: true, opacity: 0.4 }));
      tendril.position.set(Math.cos(angle)*s*0.3, s*0.2, Math.sin(angle)*s*0.3);
      tendril.rotation.x = Math.cos(angle) * 0.5;
      tendril.rotation.z = Math.sin(angle) * 0.5;
      group.add(tendril);
    }
    // Head - elegant but corrupted
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.18, 8, 8), mEther(0x997788, 0x440044));
    head.position.set(0, s*1.2, 0); head.scale.set(1, 1.15, 0.9);
    group.add(head);
    // Crown of thorns / corrupted vines
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const thorn = new THREE.Mesh(new THREE.ConeGeometry(s*0.015, s*0.08, 3), mL(0x2a0a2a));
      thorn.position.set(Math.cos(angle)*s*0.18, s*1.32, Math.sin(angle)*s*0.18);
      thorn.rotation.x = Math.cos(angle) * 0.4;
      thorn.rotation.z = -Math.sin(angle) * 0.4;
      group.add(thorn);
    }
    // Crown ring
    const crown = new THREE.Mesh(new THREE.TorusGeometry(s*0.18, s*0.015, 4, 12), mL(0x3a1a3a));
    crown.position.y = s*1.3;
    crown.rotation.x = Math.PI / 2;
    group.add(crown);
    // Glowing purple eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      eye.position.set(side*s*0.07, s*1.22, s*0.14);
      group.add(eye);
    }
    // Dark lips
    const lips = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.02, s*0.03), mL(0x330033));
    lips.position.set(0, s*1.12, s*0.16);
    group.add(lips);
    // Long flowing hair
    for (let i = 0; i < 10; i++) {
      const strand = new THREE.Mesh(new THREE.BoxGeometry(s*0.02, s*(0.3+Math.random()*0.2), s*0.01),
        new THREE.MeshLambertMaterial({ color: 0x1a001a, transparent: true, opacity: 0.7 }));
      strand.position.set((i-4.5)*s*0.04, s*1.1, -s*0.12);
      strand.rotation.x = 0.3 + Math.random()*0.3;
      strand.rotation.z = (Math.random()-0.5)*0.2;
      group.add(strand);
    }
    // Ethereal arms - slender, glowing
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(s*0.07, s*0.3, s*0.07), mEther(0x550088, 0x330055));
      upper.position.set(side*s*0.25, s*0.85, 0);
      upper.rotation.z = side * 0.2;
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(s*0.06, s*0.25, s*0.06), mEther(0x550088, 0x330055));
      fore.position.set(side*s*0.3, s*0.6, s*0.05);
      fore.rotation.x = side > 0 ? -0.4 : -0.2;
      group.add(fore);
      // Glowing fingertips
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xaa44ff, transparent: true, opacity: 0.6 }));
      hand.position.set(side*s*0.3, s*0.45, s*0.1);
      group.add(hand);
    }
    // Floating orbs orbiting the body
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.5 }));
      orb.position.set(Math.cos(angle)*s*0.5, s*0.8 + Math.sin(angle*2)*s*0.1, Math.sin(angle)*s*0.5);
      group.add(orb);
    }
    // Inner aura glow
    const innerAura = new THREE.Mesh(new THREE.SphereGeometry(s*0.5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x6600aa, transparent: true, opacity: 0.1 }));
    innerAura.position.y = s*0.8;
    group.add(innerAura);

  } else {
    // Generic fallback
    const body = new THREE.Mesh(new THREE.BoxGeometry(s*0.5, s*0.6, s*0.3), mL(bp.body));
    body.position.y = s*0.7;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.22, 6, 6), mL(bp.head));
    head.position.y = s*1.1;
    group.add(head);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 4, 4), mB(0xff2200));
      eye.position.set(side*s*0.09, s*1.13, s*0.18);
      group.add(eye);
    }
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(s*0.14, s*0.45, s*0.14), mL(bp.limbs));
      arm.position.set(side*s*0.35, s*0.65, 0);
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.16, s*0.4, s*0.16), mL(bp.limbs));
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

  // Kapre cigar light
  if (def === ENEMY_DEFS.kapre) {
    const cigarLight = new THREE.PointLight(0xff4400, 0.5, 4);
    cigarLight.position.set(s * 0.2, s * 1.25, s * 0.25);
    group.add(cigarLight);
  }

  // Diwata aura light
  if (def === ENEMY_DEFS.diwata) {
    const auraLight = new THREE.PointLight(0x8800ff, 1.5, 12);
    auraLight.position.y = s * 0.8;
    group.add(auraLight);
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
        e.model.children.forEach((c, ci) => {
          if (ci >= 4) { // Arms
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
          if (c.material) c.material.emissive?.setHex(0xff4444);
          if (c.material) c.material.emissiveIntensity = e.hitFlash;
        });
      } else {
        e.model.children.forEach(c => {
          if (c.material && c.material.emissiveIntensity > 0) c.material.emissiveIntensity = 0;
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
