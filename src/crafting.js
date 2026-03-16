export const RECIPES = [
  {
    id: 'reinforced_paddle',
    name: 'Reinforced Paddle',
    icon: '\u{1F3CF}',
    desc: 'A paddle reinforced with scrap metal. Hits harder, lasts longer.',
    materials: { scrap_metal: 2, duct_tape: 1 },
    result: {
      type: 'weapon',
      weapon: {
        id: 'reinforced_paddle', name: 'Reinforced Paddle', icon: '\u{1F3CF}',
        damage: 14, speed: 0.5, range: 2.5, durability: 130, maxDurability: 130,
        type: 'melee', heavy: 22, desc: 'Metal-reinforced paddle. Sturdy and reliable.',
        staminaCost: 9, heavyStaminaCost: 22
      }
    }
  },
  {
    id: 'spiked_bat',
    name: 'Spiked Bat',
    icon: '\u{1F3CF}',
    desc: 'A bat studded with nails and sharp bones. Brutal.',
    materials: { scrap_metal: 3, sharp_bone: 2, duct_tape: 1 },
    result: {
      type: 'weapon',
      weapon: {
        id: 'spiked_bat', name: 'Spiked Bat', icon: '\u{1F3CF}',
        damage: 22, speed: 0.55, range: 2.5, durability: 100, maxDurability: 100,
        type: 'melee', heavy: 38, desc: 'Covered in spikes. Each swing draws blood.',
        staminaCost: 12, heavyStaminaCost: 25
      }
    }
  },
  {
    id: 'electro_blade',
    name: 'Electro Blade',
    icon: '\u2694\uFE0F',
    desc: 'A bolo wired to a battery. Shocks on hit.',
    materials: { wire: 2, battery: 1, scrap_metal: 2 },
    requires: 'bolo',
    result: {
      type: 'weapon',
      weapon: {
        id: 'electro_blade', name: 'Electro Blade', icon: '\u2694\uFE0F',
        damage: 28, speed: 0.4, range: 2.8, durability: 80, maxDurability: 80,
        type: 'melee', heavy: 45, desc: 'Electrified bolo. Stuns enemies on heavy attacks.',
        staminaCost: 10, heavyStaminaCost: 22
      }
    }
  },
  {
    id: 'poison_blade',
    name: 'Venomous Machete',
    icon: '\u{1FA93}',
    desc: 'A bolo coated in dark essence. Poisons enemies.',
    materials: { dark_essence: 3, herbs: 2 },
    requires: 'bolo',
    result: {
      type: 'weapon',
      weapon: {
        id: 'poison_blade', name: 'Venomous Machete', icon: '\u{1FA93}',
        damage: 25, speed: 0.4, range: 2.8, durability: 90, maxDurability: 90,
        type: 'melee', heavy: 40, desc: 'Dark-infused blade. Enemies take damage over time.',
        staminaCost: 10, heavyStaminaCost: 20
      }
    }
  },
  {
    id: 'molotov',
    name: 'Molotov Cocktail',
    icon: '\u{1F525}',
    desc: 'A bottle of fire. Throw to create a burning area.',
    materials: { cloth_rag: 2, buko_juice: 1 },
    result: {
      type: 'consumable',
      item: 'molotov',
      count: 2
    }
  },
  {
    id: 'bandage_craft',
    name: 'Bandage',
    icon: '\u{1FA79}',
    desc: 'A clean bandage for healing wounds.',
    materials: { cloth_rag: 2 },
    result: {
      type: 'consumable',
      item: 'bandage',
      count: 2
    }
  },
  {
    id: 'antidote_craft',
    name: 'Antidote',
    icon: '\u{1F48A}',
    desc: 'Herbal antidote. Cures poison and heals.',
    materials: { herbs: 3, buko_juice: 1 },
    result: {
      type: 'consumable',
      item: 'antidote',
      count: 1
    }
  },
  {
    id: 'spirit_ward',
    name: 'Spirit Ward',
    icon: '\u{1F4FF}',
    desc: 'Ancient protection charm. Temporarily reduces damage taken.',
    materials: { dark_essence: 2, ancient_wood: 1, horse_hair: 1 },
    result: {
      type: 'buff',
      effect: 'defense_up',
      duration: 120
    }
  },
];

export class CraftingSystem {
  constructor(game) {
    this.game = game;
  }

  canCraft(recipe) {
    const player = this.game.player;
    // Check materials
    for (const [matId, count] of Object.entries(recipe.materials)) {
      if (!player.hasItem(matId, count)) return false;
    }
    // Check weapon requirement
    if (recipe.requires) {
      if (!player.weapons.some(w => w.id === recipe.requires)) return false;
    }
    return true;
  }

  craft(recipe) {
    if (!this.canCraft(recipe)) {
      this.game.ui.addMessage('Not enough materials!', 'system');
      return false;
    }

    const player = this.game.player;

    // Consume materials
    for (const [matId, count] of Object.entries(recipe.materials)) {
      player.removeItem(matId, count);
    }

    // Give result
    if (recipe.result.type === 'weapon') {
      player.addWeapon({ ...recipe.result.weapon });
    } else if (recipe.result.type === 'consumable') {
      player.addItem(recipe.result.item, recipe.result.count);
      this.game.ui.addMessage(`Crafted ${recipe.name} x${recipe.result.count}`, 'loot');
    } else if (recipe.result.type === 'buff') {
      // Apply timed buff
      if (recipe.result.effect === 'defense_up') {
        player.defense += 5;
        this.game.ui.addMessage(`Spirit Ward active! Defense +5 for ${recipe.result.duration}s.`, 'quest');
        setTimeout(() => {
          player.defense = Math.max(0, player.defense - 5);
          this.game.ui.addMessage('Spirit Ward fades...', 'system');
        }, recipe.result.duration * 1000);
      }
    }

    return true;
  }
}
