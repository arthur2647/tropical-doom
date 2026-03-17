import * as THREE from 'three';
import { getTerrainHeightFast } from './world.js';

const ITEM_DEFS = {
  coconut: { name: 'Coconut', icon: '\u{1F965}', color: 0x8B6914, category: 'consumable',
    desc: 'A fresh coconut. Restores health and stamina.' },
  buko_juice: { name: 'Buko Juice', icon: '\u{1F964}', color: 0xAADDFF, category: 'consumable',
    desc: 'Sweet coconut water. Great for stamina recovery.' },
  adobo: { name: 'Adobo', icon: '\u{1F356}', color: 0x8B5E3C, category: 'consumable',
    desc: 'Hearty adobo dish. Major health restoration.' },
  herbs: { name: 'Medicinal Herbs', icon: '\u{1F33F}', color: 0x33AA33, category: 'consumable',
    desc: 'Healing herbs from the jungle.' },
  bandage: { name: 'Bandage', icon: '\u{1FA79}', color: 0xEEDDCC, category: 'consumable',
    desc: 'A makeshift bandage. Restores health.' },
  energy_drink: { name: 'Energy Drink', icon: '\u{1F9CB}', color: 0x44FF44, category: 'consumable',
    desc: 'Found in the resort vending machines. Full stamina restore.' },
  antidote: { name: 'Antidote', icon: '\u{1F48A}', color: 0x8844FF, category: 'consumable',
    desc: 'Cures poison and restores some health.' },
  bangkaw: { name: 'Bangkaw (Spear)', icon: '\u{1F531}', color: 0x8B9B55, category: 'consumable',
    desc: 'A throwing spear. Deals 40 damage at range.' },
  scrap_metal: { name: 'Scrap Metal', icon: '\u{1F529}', color: 0x888888, category: 'material',
    desc: 'Rusty metal scraps. Useful for crafting weapons.' },
  cloth_rag: { name: 'Cloth Rag', icon: '\u{1F9F5}', color: 0xCCBBAA, category: 'material',
    desc: 'Torn cloth. Used for wrapping weapons.' },
  sharp_bone: { name: 'Sharp Bone', icon: '\u{1F9B4}', color: 0xEEDDCC, category: 'material',
    desc: 'A sharpened bone fragment from a defeated creature.' },
  dark_essence: { name: 'Dark Essence', icon: '\u{1F30C}', color: 0x6600AA, category: 'material',
    desc: 'Mysterious dark energy crystallized from fallen creatures.' },
  thick_hide: { name: 'Thick Hide', icon: '\u{1F9BE}', color: 0x6B4226, category: 'material',
    desc: 'Tough creature hide. Can reinforce weapons.' },
  bat_wing: { name: 'Bat Wing', icon: '\u{1F987}', color: 0x332233, category: 'material',
    desc: 'A leathery wing from a Manananggal.' },
  horse_hair: { name: 'Horse Hair', icon: '\u{1F412}', color: 0x2D1B0F, category: 'material',
    desc: 'Coarse hair from a Tikbalang.' },
  ancient_wood: { name: 'Ancient Wood', icon: '\u{1FAB5}', color: 0x4A3728, category: 'material',
    desc: 'Wood infused with ancient energy.' },
  sacred_crystal: { name: 'Sacred Crystal', icon: '\u{1F48E}', color: 0xAA44FF, category: 'material',
    desc: 'A crystal pulsing with divine energy.' },
  wire: { name: 'Wire', icon: '\u{1F50C}', color: 0xAAAAAA, category: 'material',
    desc: 'Electrical wire from the resort.' },
  duct_tape: { name: 'Duct Tape', icon: '\u{1F4DC}', color: 0x999999, category: 'material',
    desc: 'The universal repair tool.' },
  battery: { name: 'Battery', icon: '\u{1F50B}', color: 0x44AA44, category: 'material',
    desc: 'A partially charged battery.' },
  // Armor items
  woven_vest: { name: 'Woven Vest', icon: '\u{1F9E5}', color: 0xBBAA77, category: 'armor',
    desc: 'A vest woven from cloth. Light protection.', defense: 3, durability: 80 },
  reinforced_vest: { name: 'Reinforced Vest', icon: '\u{1F9E5}', color: 0x999988, category: 'armor',
    desc: 'Cloth vest reinforced with scrap metal. Decent protection.', defense: 5, durability: 120 },
  hide_armor: { name: 'Hide Armor', icon: '\u{1F9BE}', color: 0x6B4226, category: 'armor',
    desc: 'Thick creature hide shaped into armor. Strong protection.', defense: 8, durability: 150 },
  spirit_armor: { name: 'Spirit Armor', icon: '\u{1F6E1}\uFE0F', color: 0x8844FF, category: 'armor',
    desc: 'Armor infused with dark essence. Superior protection with a faint glow.', defense: 12, durability: 200 },

  sacred_amulet: { name: 'Sacred Amulet', icon: '\u{1F4FF}', color: 0xFF8800, category: 'quest',
    desc: 'One of the three sacred relics.' },
  sacred_shell: { name: 'Sacred Shell', icon: '\u{1F41A}', color: 0xFF88CC, category: 'quest',
    desc: 'One of the three sacred relics.' },
  sacred_flame: { name: 'Sacred Flame', icon: '\u{1F525}', color: 0xFF4400, category: 'quest',
    desc: 'One of the three sacred relics.' },
};

// --- Shaped item models ---
function buildItemMesh(id, def) {
  const m = (color) => new THREE.MeshLambertMaterial({ color });
  const mb = (color) => new THREE.MeshBasicMaterial({ color });

  switch (id) {
    case 'coconut': {
      // Brown oval coconut shape
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), m(0x5C4033));
      shell.scale.set(1, 1.2, 1);
      g.add(shell);
      // Husk fibers
      const husk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), m(0x8B6914));
      husk.scale.set(0.9, 0.6, 0.9);
      husk.position.y = 0.08;
      g.add(husk);
      return g;
    }
    case 'buko_juice': {
      // Coconut shell cut open with straw
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), m(0x5C4033));
      shell.scale.y = 0.7;
      g.add(shell);
      // White inside
      const inside = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8), m(0xEEEEDD));
      inside.rotation.x = -Math.PI / 2;
      inside.position.y = 0.05;
      g.add(inside);
      // Straw
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.25, 4), m(0x33CC33));
      straw.position.set(0.03, 0.15, 0);
      straw.rotation.z = 0.15;
      g.add(straw);
      return g;
    }
    case 'adobo': {
      // Bowl of food
      const g = new THREE.Group();
      // Bowl
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.08, 8), m(0xCC9966));
      g.add(bowl);
      // Food inside
      const food = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), m(0x6B3A2A));
      food.scale.y = 0.4;
      food.position.y = 0.04;
      g.add(food);
      return g;
    }
    case 'herbs': {
      // Bunch of green leaves
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, 0.18),
          new THREE.MeshLambertMaterial({ color: 0x22AA22 + Math.floor(Math.random() * 0x004400), side: THREE.DoubleSide })
        );
        leaf.position.set((Math.random() - 0.5) * 0.08, Math.random() * 0.05, (Math.random() - 0.5) * 0.08);
        leaf.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.3);
        g.add(leaf);
      }
      // Stem bundle
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 4), m(0x336622));
      stem.position.y = -0.05;
      g.add(stem);
      // Subtle green glow
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x33ff33, transparent: true, opacity: 0.12 }));
      g.add(glow);
      return g;
    }
    case 'bandage': {
      // Roll of white cloth
      const g = new THREE.Group();
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), m(0xEEDDCC));
      roll.rotation.z = Math.PI / 2;
      g.add(roll);
      // Red cross
      const cross1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.001), mb(0xCC0000));
      cross1.position.z = 0.061;
      g.add(cross1);
      const cross2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.001), mb(0xCC0000));
      cross2.position.z = 0.061;
      g.add(cross2);
      return g;
    }
    case 'energy_drink': {
      // Can
      const g = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), m(0x22CC22));
      g.add(can);
      // Top
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.02, 8), m(0xCCCCCC));
      top.position.y = 0.08;
      g.add(top);
      return g;
    }
    case 'antidote': {
      // Small bottle/vial
      const g = new THREE.Group();
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6),
        new THREE.MeshLambertMaterial({ color: 0x8844FF, transparent: true, opacity: 0.7 }));
      g.add(bottle);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.03, 6), m(0x8B6914));
      cork.position.y = 0.075;
      g.add(cork);
      return g;
    }
    case 'scrap_metal': {
      // Bent metal pieces
      const g = new THREE.Group();
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), m(0x777777));
      plate.rotation.z = 0.2;
      g.add(plate);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5), m(0x888888));
      pipe.rotation.z = 0.8;
      pipe.position.set(0.03, 0.04, 0);
      g.add(pipe);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 6), m(0x999999));
      bolt.position.set(-0.06, 0.02, 0.04);
      g.add(bolt);
      return g;
    }
    case 'cloth_rag': {
      // Draped cloth
      const g = new THREE.Group();
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.18),
        new THREE.MeshLambertMaterial({ color: 0xCCBBAA, side: THREE.DoubleSide }));
      cloth.rotation.x = -0.3;
      g.add(cloth);
      const fold = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1),
        new THREE.MeshLambertMaterial({ color: 0xBBAA99, side: THREE.DoubleSide }));
      fold.position.set(0.02, 0.03, 0.02);
      fold.rotation.set(-0.5, 0.3, 0);
      g.add(fold);
      return g;
    }
    case 'wire': {
      // Coiled wire
      const g = new THREE.Group();
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12), m(0xAAAAAA));
      g.add(coil);
      const end1 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), m(0xCC8844));
      end1.position.set(0.08, 0, 0);
      end1.rotation.z = 0.5;
      g.add(end1);
      return g;
    }
    case 'duct_tape': {
      // Roll of tape
      const g = new THREE.Group();
      const roll = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.025, 6, 12), m(0x888888));
      roll.rotation.x = Math.PI / 2;
      g.add(roll);
      return g;
    }
    case 'battery': {
      // Battery shape
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.06), m(0x222222));
      g.add(body);
      const label = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.08, 0.062), m(0x44AA44));
      label.position.y = 0.01;
      g.add(label);
      const terminal = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 6), m(0xCCCCCC));
      terminal.position.y = 0.08;
      g.add(terminal);
      return g;
    }
    case 'dark_essence': {
      // Glowing dark crystal
      const g = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0),
        new THREE.MeshLambertMaterial({ color: 0x6600AA, emissive: 0x330066, emissiveIntensity: 0.5 }));
      crystal.scale.y = 1.4;
      g.add(crystal);
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0x8800ff, transparent: true, opacity: 0.15 }));
      g.add(aura);
      return g;
    }
    case 'sharp_bone': {
      // Pointed bone
      const g = new THREE.Group();
      const bone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 5), m(0xEEDDCC));
      bone.rotation.z = 0.4;
      g.add(bone);
      const joint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), m(0xDDCCBB));
      joint.position.set(0, -0.1, 0);
      bone.add(joint);
      return g;
    }
    case 'thick_hide': {
      // Folded leather
      const g = new THREE.Group();
      const hide = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.15), m(0x6B4226));
      g.add(hide);
      const fold = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.13), m(0x7B5236));
      fold.position.y = 0.035;
      g.add(fold);
      return g;
    }
    case 'bat_wing': {
      // Triangular wing membrane
      const g = new THREE.Group();
      const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.lineTo(0.2, 0.1); shape.lineTo(0.15, -0.08);
      shape.lineTo(0.08, 0.02); shape.lineTo(0, -0.05);
      const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape),
        new THREE.MeshLambertMaterial({ color: 0x332233, side: THREE.DoubleSide }));
      wing.rotation.x = -0.3;
      g.add(wing);
      return g;
    }
    case 'ancient_wood': {
      // Gnarled wood piece with glow
      const g = new THREE.Group();
      const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 5), m(0x4A3728));
      wood.rotation.z = 0.3;
      g.add(wood);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), m(0x3A2718));
      knot.position.set(0, 0.04, 0.03);
      g.add(knot);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.1 }));
      g.add(glow);
      return g;
    }
    case 'bangkaw': {
      const g = new THREE.Group();
      // Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.35, 5), m(0x8B9B55));
      shaft.rotation.z = 0.3;
      g.add(shaft);
      // Spearhead
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), m(0xBBBBCC));
      head.position.set(0.1, 0.14, 0);
      head.rotation.z = 0.3;
      g.add(head);
      return g;
    }
    case 'sacred_amulet': case 'sacred_shell': case 'sacred_flame': {
      // Glowing quest relic
      const g = new THREE.Group();
      const colors = { sacred_amulet: 0xFF8800, sacred_shell: 0xFF88CC, sacred_flame: 0xFF4400 };
      const col = colors[id];
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1),
        new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.6 }));
      gem.scale.y = 1.3;
      g.add(gem);
      const aura = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12 }));
      g.add(aura);
      return g;
    }
    default: {
      // Fallback - small colored box
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.2 })));
      return g;
    }
  }
}

function createItemModel(id, def) {
  const group = new THREE.Group();

  // Build shaped mesh
  const itemMesh = buildItemMesh(id, def);
  group.add(itemMesh);

  // Floating name label
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 48;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(8, 6, 240, 36, 8);
  ctx.fill();
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(`${def.icon || '?'}  ${def.name}`, 128, 32);
  const labelTex = new THREE.CanvasTexture(canvas);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
  label.position.y = 0.5;
  label.scale.set(1.8, 0.35, 1);
  group.add(label);

  // Ground glow ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.35, 16),
    new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.35;
  group.add(ring);

  return group;
}

export class ItemManager {
  constructor(game) {
    this.game = game;
    this.items = [];
  }

  scatterItems() {
    // --- CONTEXTUAL PLACEMENT ---

    // Resort: medical supplies on shelves, scrap near broken furniture, wire near walls
    this.placeNear('bandage', -8, -2, 3, 0.9);    // On reception desk
    this.placeNear('bandage', -12, 2, 2, 0.3);     // Near broken furniture
    this.placeNear('bandage', 15, -5, 3, 0.6);     // Tiki bar area
    this.placeNear('energy_drink', 15, -3.8, 2, 0.6); // Behind bar counter
    this.placeNear('energy_drink', -5, 2, 3, 0.3);
    this.placeNear('scrap_metal', -15, 0, 4, 0.2); // Near resort left wall
    this.placeNear('scrap_metal', -1, 0, 4, 0.2);  // Near resort right wall
    this.placeNear('scrap_metal', 8, 5, 5, 0.2);   // Near pool edge
    this.placeNear('scrap_metal', 12, -8, 3, 0.2); // Near workbench
    this.placeNear('scrap_metal', -8, -5, 5, 0.2);
    this.placeNear('wire', -15, 0, 5, 0.2);        // Along walls
    this.placeNear('wire', -1, 0, 5, 0.2);
    this.placeNear('wire', 8, 2, 4, 0.2);
    this.placeNear('cloth_rag', -12, 2, 3, 0.15);  // Near broken furniture
    this.placeNear('cloth_rag', -5, 2, 3, 0.15);
    this.placeNear('cloth_rag', 15, -5, 4, 0.15);
    this.placeNear('cloth_rag', -8, -2, 3, 0.15);
    this.placeNear('battery', 8, 5, 4, 0.2);       // Near pool/machinery
    this.placeNear('battery', -8, -5, 5, 0.2);
    this.placeNear('duct_tape', 12, -8, 3, 0.2);   // Near workbench
    this.placeNear('duct_tape', 15, -5, 3, 0.2);

    // Beach: coconuts at base of palm trees (not random), buko near shore
    // We don't know exact palm positions, so place near beach with small scatter
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 90 + Math.random() * 15; // Near edge where palms are
      this.placeNear('coconut', Math.cos(angle) * r, Math.sin(angle) * r, 3, 0);
    }
    this.placeNear('buko_juice', 0, -38, 4, 0);   // Near beach chairs
    this.placeNear('buko_juice', 20, -45, 4, 0);  // Near wrecked boat
    this.placeNear('buko_juice', -5, -42, 3, 0);  // Near surfboards

    // Village: food in/near huts, herbs in garden area
    this.placeNear('adobo', 60, 20, 4, 0.5);       // Near fire pit (cooking)
    this.placeNear('adobo', 55, 25, 4, 0.5);       // Near Tomas
    this.placeNear('adobo', 65, 15, 5, 0.5);
    this.placeNear('coconut', 60, 20, 8, 0);       // Under village palms
    this.placeNear('coconut', 55, 15, 6, 0);
    this.placeNear('herbs', 65, 30, 5, 0);         // Village herb garden
    this.placeNear('herbs', 60, 28, 4, 0);
    this.placeNear('herbs', 58, 32, 4, 0);

    // Jungle: herbs growing wild, ancient wood on ground, coconuts under palms
    for (let i = 0; i < 6; i++) {
      this.placeNear('herbs', -50 + (Math.random() - 0.5) * 40, 50 + (Math.random() - 0.5) * 40, 2, 0);
    }
    this.placeNear('ancient_wood', -55, 45, 5, 0);
    this.placeNear('ancient_wood', -45, 55, 5, 0);
    this.placeNear('ancient_wood', -60, 50, 5, 0);
    this.placeNear('coconut', -40, 45, 5, 0);
    this.placeNear('coconut', -55, 55, 5, 0);

    // Temple: dark essence near altar, scrap in ruins
    this.placeNear('dark_essence', -60, -60, 5, 0.3);
    this.placeNear('dark_essence', -55, -55, 5, 0.3);
    this.placeNear('dark_essence', -65, -65, 5, 0.3);
    this.placeNear('dark_essence', -58, -62, 4, 0.3);
    this.placeNear('scrap_metal', -52, -55, 5, 0.2);
    this.placeNear('scrap_metal', -68, -58, 5, 0.2);
    this.placeNear('scrap_metal', -60, -50, 4, 0.2);

    // Swamp: herbs growing in muck, bat wings on ground
    for (let i = 0; i < 4; i++) {
      this.placeNear('herbs', 40 + (Math.random() - 0.5) * 20, 70 + (Math.random() - 0.5) * 20, 2, 0);
    }
    this.placeNear('bat_wing', 42, 68, 5, 0);
    this.placeNear('bat_wing', 38, 72, 5, 0);

    // Cove: scrap from boats, cloth from sails
    this.placeNear('scrap_metal', 85, -65, 5, 0.2);
    this.placeNear('scrap_metal', 87, -70, 4, 0.2);
    this.placeNear('scrap_metal', 83, -63, 4, 0.2);
    this.placeNear('cloth_rag', 85, -67, 4, 0.15);
    this.placeNear('cloth_rag', 88, -63, 4, 0.15);

    // Quest items at specific meaningful locations
    this.spawnQuestItem('sacred_amulet', new THREE.Vector3(-50, 0, 52),
      'Press E - Pick up Sacred Amulet', 'found_amulet');
    this.spawnQuestItem('sacred_shell', new THREE.Vector3(90, 0, -67),
      'Press E - Pick up Sacred Shell', 'found_shell');
    this.spawnQuestItem('sacred_flame', new THREE.Vector3(45, 0, 75),
      'Press E - Take the Sacred Flame', 'found_flame');
  }

  placeNear(id, cx, cz, scatter, elevation) {
    const x = cx + (Math.random() - 0.5) * scatter;
    const z = cz + (Math.random() - 0.5) * scatter;
    const gy = getTerrainHeightFast(x, z);
    this.spawnItem(id, new THREE.Vector3(x, gy + (elevation || 0.4), z));
  }

  spawnItem(id, position) {
    const def = ITEM_DEFS[id];
    if (!def) return;

    const model = createItemModel(id, def);
    model.position.copy(position);

    model.userData = {
      interactable: true,
      type: 'item',
      itemId: id,
      promptText: `Press E - ${def.name}`
    };

    this.game.scene.add(model);
    this.game.interactables.push(model);
    this.items.push({ id, model, def, time: Math.random() * 5 });
  }

  spawnQuestItem(id, position, prompt, questEvent) {
    const def = ITEM_DEFS[id];
    if (!def) return;

    const model = createItemModel(id, def);
    const gy = getTerrainHeightFast(position.x, position.z);
    model.position.set(position.x, gy + 0.6, position.z);

    const glow = new THREE.PointLight(def.color, 1.5, 8);
    glow.position.y = 0.5;
    model.add(glow);

    model.userData = {
      interactable: true,
      type: 'item',
      itemId: id,
      questEvent,
      promptText: prompt
    };

    this.game.scene.add(model);
    this.game.interactables.push(model);
    this.items.push({ id, model, def, time: 0, quest: true });
  }

  spawnWeaponDrop(weapon, position) {
    const group = new THREE.Group();

    // Glowing weapon pickup visual
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0),
      new THREE.MeshLambertMaterial({ color: 0xffaa33, emissive: 0xcc8822, emissiveIntensity: 0.5 }));
    gem.scale.y = 0.7;
    group.add(gem);

    // Label
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(8, 6, 240, 36, 8);
    ctx.fill();
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#ffcc44';
    ctx.textAlign = 'center';
    ctx.fillText(`${weapon.icon || '\u2694\uFE0F'} ${weapon.name}`, 128, 32);
    const labelTex = new THREE.CanvasTexture(canvas);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
    label.position.y = 0.5;
    label.scale.set(1.8, 0.35, 1);
    group.add(label);

    // Glow ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.35, 16),
      new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    group.add(ring);

    // Point light
    const light = new THREE.PointLight(0xffaa33, 0.8, 5);
    light.position.y = 0.3;
    group.add(light);

    const gy = getTerrainHeightFast(position.x, position.z);
    group.position.set(position.x, gy + 0.5, position.z);

    group.userData = {
      interactable: true,
      type: 'weapon_drop',
      weapon: weapon,
      promptText: `Press E - Pick up ${weapon.name}`
    };

    this.game.scene.add(group);
    this.game.interactables.push(group);
    this.items.push({ id: 'weapon_drop', model: group, def: { color: 0xffaa33 }, time: 0 });
  }

  pickup(itemObj) {
    const data = itemObj.userData;
    const id = data.itemId;
    const def = ITEM_DEFS[id];
    if (!def) return;

    if (data.questEvent) {
      this.game.questManager.triggerEvent(data.questEvent);
      this.game.ui.addMessage(`Found ${def.name}!`, 'quest');
    } else {
      this.game.player.addItem(id);
      this.game.ui.addMessage(`Picked up ${def.name}`, 'loot');
      this.game.questManager.triggerEvent('collect_' + id);
    }

    this.game.scene.remove(itemObj);
    const iIdx = this.game.interactables.indexOf(itemObj);
    if (iIdx >= 0) this.game.interactables.splice(iIdx, 1);
    const itemIdx = this.items.findIndex(i => i.model === itemObj);
    if (itemIdx >= 0) this.items.splice(itemIdx, 1);
  }

  update(dt) {
    for (const item of this.items) {
      item.time += dt;
      // Gentle bob, slow rotation
      const child = item.model.children[0];
      if (child) {
        child.position.y = Math.sin(item.time * 1.5) * 0.04;
        child.rotation.y += dt * 0.8;
      }
    }
  }
}

export { ITEM_DEFS };
