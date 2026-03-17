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
  const mS = (c, m = 0, r = 0.6) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const skin = 0xC8956C; // Filipino skin tone

  if (def === NPC_DEFS.maria) {
    // Maria - Strong village leader, bolo fighter, practical clothing
    // Torso - red/brown blouse, slightly broad-shouldered
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), mL(0xCC4433));
    torso.position.y = 0.95; torso.castShadow = true;
    group.add(torso);
    // Collar detail
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.18), mL(0xDD5544));
    collar.position.y = 1.22;
    group.add(collar);
    // Belt/sash
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.23), mL(0x664422));
    sash.position.y = 0.72;
    group.add(sash);
    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mL(skin));
    head.position.y = 1.35; head.scale.set(1, 1.1, 0.9);
    group.add(head);
    // Hair - tied back in a bun
    const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), mL(0x1a0a05));
    hairBack.position.set(0, 1.38, -0.04); hairBack.scale.set(1, 0.8, 0.9);
    group.add(hairBack);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mL(0x1a0a05));
    bun.position.set(0, 1.4, -0.14);
    group.add(bun);
    // Eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), mL(0x221100));
      eye.position.set(side*0.05, 1.36, 0.13);
      group.add(eye);
    }
    // Determined mouth
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.01), mL(0x994444));
    mouth.position.set(0, 1.28, 0.15);
    group.add(mouth);
    // Arms - skin with rolled sleeves
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), mL(0xCC4433));
      sleeve.position.set(side*0.27, 1.0, 0);
      group.add(sleeve);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.08), mL(skin));
      arm.position.set(side*0.27, 0.78, 0);
      arm.userData.isArm = true; arm.userData.side = side;
      group.add(arm);
    }
    // Bolo in right hand - curved blade
    const boloShape = new THREE.Shape();
    boloShape.moveTo(0, 0); boloShape.lineTo(0.03, 0.15);
    boloShape.quadraticCurveTo(0.05, 0.28, 0.02, 0.32);
    boloShape.lineTo(-0.01, 0.3); boloShape.lineTo(0, 0.12); boloShape.lineTo(-0.01, 0);
    const bolo = new THREE.Mesh(new THREE.ExtrudeGeometry(boloShape, { depth: 0.015, bevelEnabled: false }), mS(0xaaaaaa, 0.7, 0.3));
    bolo.position.set(0.28, 0.45, 0.08); bolo.rotation.x = -0.3;
    bolo.userData.isWeapon = true;
    group.add(bolo);
    const boloHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.12, 6), mL(0x5a3a1a));
    boloHandle.position.set(0.28, 0.45, 0.08);
    group.add(boloHandle);
    // Legs - dark pants
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), mL(0x3a2a1a));
      leg.position.set(side*0.1, 0.4, 0);
      group.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.14), mL(0x443322));
      foot.position.set(side*0.1, 0.02, 0.02);
      group.add(foot);
    }

  } else if (def === NPC_DEFS.tomas) {
    // Tomas - Elderly healer, hunched, white hair, staff with herbs
    // Torso - loose tunic, slightly hunched
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.2), mL(0x888866));
    torso.position.y = 0.88; torso.rotation.x = 0.1; torso.castShadow = true;
    group.add(torso);
    // Herb pouch on belt
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), mL(0x6B5B3A));
    pouch.position.set(0.15, 0.7, 0.08);
    group.add(pouch);
    // Head - old, thin face
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mL(skin));
    head.position.set(0, 1.28, 0.05); head.scale.set(0.9, 1.1, 0.85);
    group.add(head);
    // White/grey hair - thin, wispy
    for (let i = 0; i < 6; i++) {
      const strand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.01), mL(0xccccbb));
      strand.position.set((i-2.5)*0.035, 1.35, -0.06);
      strand.rotation.x = 0.3;
      group.add(strand);
    }
    // Wrinkled brow
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.05), mL(0xB08060));
    brow.position.set(0, 1.33, 0.1);
    group.add(brow);
    // Squinting eyes
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.01), mL(0x221100));
      eye.position.set(side*0.045, 1.3, 0.12);
      group.add(eye);
    }
    // Thin beard
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04 + Math.random()*0.02, 0.008), mL(0xbbbbaa));
      b.position.set((i-1.5)*0.025, 1.2, 0.13);
      group.add(b);
    }
    // Arms - thin, weathered
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), mL(skin));
      arm.position.set(side*0.24, 0.78, 0.03);
      arm.userData.isArm = true; arm.userData.side = side;
      group.add(arm);
    }
    // Gnarled walking staff with herb bundle
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.8, 6), mL(0x6B5030));
    staff.position.set(0.26, 0.6, 0.06);
    staff.userData.isWeapon = true;
    group.add(staff);
    // Staff knots
    for (let i = 0; i < 2; i++) {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), mL(0x5a4020));
      knot.position.set(0.26, 0.7 + i*0.25, 0.06);
      group.add(knot);
    }
    // Herb bundle at staff top
    const herbs = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), mL(0x44aa33));
    herbs.position.set(0.26, 1.02, 0.06);
    group.add(herbs);
    const herbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0x44ff44, transparent: true, opacity: 0.2 }));
    herbGlow.position.copy(herbs.position);
    group.add(herbGlow);
    // Legs - thin, sandals
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.38, 0.1), mL(0x5a4a30));
      leg.position.set(side*0.09, 0.38, 0);
      group.add(leg);
      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), mL(0x6B5030));
      sandal.position.set(side*0.09, 0.02, 0.02);
      group.add(sandal);
    }

  } else if (def === NPC_DEFS.pedro) {
    // Pedro - Tough fisherman, muscular, tank top, bandana
    // Torso - sleeveless, muscular
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.25), mL(skin));
    torso.position.y = 0.92; torso.castShadow = true;
    group.add(torso);
    // Tank top
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.22), mL(0x4477AA));
    tank.position.y = 0.94;
    group.add(tank);
    // Tank straps
    for (const side of [-1, 1]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.02), mL(0x4477AA));
      strap.position.set(side*0.1, 1.2, 0.1);
      group.add(strap);
    }
    // Head - square jaw, rugged
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 8), mL(skin));
    head.position.y = 1.35; head.scale.set(1, 1.05, 0.9);
    group.add(head);
    // Bandana
    const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.18), mL(0xCC3333));
    bandana.position.y = 1.42;
    group.add(bandana);
    // Bandana tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.02), mL(0xCC3333));
    tail.position.set(0.12, 1.36, -0.12);
    tail.rotation.z = 0.3;
    group.add(tail);
    // Short cropped hair under bandana
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 4), mL(0x1a1a1a));
    hair.position.y = 1.4; hair.scale.set(1, 0.5, 0.9);
    group.add(hair);
    // Stubble jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.1), mL(0xA07858));
    jaw.position.set(0, 1.25, 0.08);
    group.add(jaw);
    // Eyes - tough squint
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 4), mL(0x221100));
      eye.position.set(side*0.055, 1.36, 0.14);
      group.add(eye);
    }
    // Scar on cheek
    const scar = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.01), mL(0xAA8070));
    scar.position.set(0.1, 1.32, 0.14);
    scar.rotation.z = 0.3;
    group.add(scar);
    // Muscular arms
    for (const side of [-1, 1]) {
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.12), mL(skin));
      upper.position.set(side*0.3, 0.98, 0);
      group.add(upper);
      const fore = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), mL(skin));
      fore.position.set(side*0.3, 0.75, 0);
      fore.userData.isArm = true; fore.userData.side = side;
      group.add(fore);
    }
    // Improvised weapon - heavy paddle/oar
    const oarHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.018, 0.5, 6), mL(0x7a5a30));
    oarHandle.position.set(0.3, 0.55, 0.1); oarHandle.rotation.x = -0.2;
    oarHandle.userData.isWeapon = true;
    group.add(oarHandle);
    const oarBlade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.02), mL(0x8a6a40));
    oarBlade.position.set(0.3, 0.35, 0.12);
    group.add(oarBlade);
    // Legs - cargo shorts
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.25, 0.13), mL(0x5a5a44));
      leg.position.set(side*0.11, 0.48, 0);
      group.add(leg);
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.1), mL(skin));
      shin.position.set(side*0.11, 0.27, 0);
      group.add(shin);
      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.14), mL(0x554433));
      sandal.position.set(side*0.11, 0.02, 0.02);
      group.add(sandal);
    }

  } else if (def === NPC_DEFS.lena) {
    // Lena - Resort manager, business casual but disheveled, scared posture
    // Torso - blouse, slightly hunched from fear
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.45, 0.2), mL(0xDDAA88));
    torso.position.y = 0.9; torso.rotation.x = 0.08; torso.castShadow = true;
    group.add(torso);
    // Collar/neckline
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), mL(0xEEBB99));
    collar.position.y = 1.14;
    group.add(collar);
    // Name tag (small rectangle)
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), mL(0xffffff));
    tag.position.set(-0.1, 1.0, 0.11);
    group.add(tag);
    // Head - softer features
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mL(skin));
    head.position.set(0, 1.3, 0.03); head.scale.set(0.95, 1.1, 0.9);
    group.add(head);
    // Hair - shoulder-length, slightly messy
    const hairTop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), mL(0x2a1a0a));
    hairTop.position.set(0, 1.35, -0.01); hairTop.scale.set(1, 0.75, 0.95);
    group.add(hairTop);
    // Hair sides falling to shoulders
    for (const side of [-1, 1]) {
      const strand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.04), mL(0x2a1a0a));
      strand.position.set(side*0.13, 1.2, -0.02);
      group.add(strand);
    }
    // Worried eyes - wider
    for (const side of [-1, 1]) {
      const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 4), mL(0xeeeedd));
      eyeWhite.position.set(side*0.05, 1.32, 0.12);
      group.add(eyeWhite);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), mL(0x332211));
      pupil.position.set(side*0.05, 1.32, 0.14);
      group.add(pupil);
    }
    // Thin eyebrows raised in worry
    for (const side of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.01), mL(0x2a1a0a));
      brow.position.set(side*0.05, 1.36, 0.12);
      brow.rotation.z = side * -0.15;
      group.add(brow);
    }
    // Arms - slender, hugging self slightly
    for (const side of [-1, 1]) {
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.08), mL(0xDDAA88));
      sleeve.position.set(side*0.24, 0.95, side > 0 ? 0.04 : 0);
      group.add(sleeve);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.07), mL(skin));
      arm.position.set(side*0.24, 0.75, side > 0 ? 0.06 : 0.02);
      arm.userData.isArm = true; arm.userData.side = side;
      group.add(arm);
    }
    // Legs - skirt then bare legs
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.25, 8), mL(0x4a4a55));
    skirt.position.y = 0.58;
    group.add(skirt);
    for (const side of [-1, 1]) {
      const shin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), mL(skin));
      shin.position.set(side*0.08, 0.3, 0);
      group.add(shin);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12), mL(0x333333));
      shoe.position.set(side*0.08, 0.02, 0.02);
      group.add(shoe);
    }

  } else {
    // Generic fallback NPC
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.25), mL(def.color));
    body.position.y = 0.9; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mL(skin));
    head.position.y = 1.35;
    group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 8), mL(0x1a1a1a));
    hair.position.y = 1.4; hair.scale.set(1, 0.7, 1);
    group.add(hair);
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.1), mL(skin));
      arm.position.set(side*0.28, 0.85, 0);
      arm.userData.isArm = true; arm.userData.side = side;
      group.add(arm);
    }
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.12), mL(0x4a3520));
      leg.position.set(side*0.1, 0.4, 0);
      group.add(leg);
    }
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
    if (!this.game.touch.enabled) this.game.controls.unlock();
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
      if (!this.game.touch.enabled) this.game.controls.lock();
    } else {
      this.showDialogueLine();
    }
  }
}
