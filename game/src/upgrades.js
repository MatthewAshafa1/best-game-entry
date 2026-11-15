// Starlight Salvage — the between-wave dock.
// Upgrades are bought with the credits banked from scrap. This module owns
// the catalogue math (costs, levels, applying an effect); the shop panel
// itself is drawn by render.js and driven by main.js.

import { PLAYER, UPGRADES } from './config.js';

export function upgradeList() {
  return UPGRADES;
}

export function upgradeLevel(player, id) {
  return player.upgrades[id] ?? 0;
}

export function upgradeCost(definition, level) {
  return definition.baseCost + definition.costStep * level;
}

export function canBuy(player, definition, credits) {
  const level = upgradeLevel(player, definition.id);
  if (level >= definition.maxLevel) return false;
  return credits >= upgradeCost(definition, level);
}

export function buyUpgrade(player, definition, state) {
  const level = upgradeLevel(player, definition.id);
  if (level >= definition.maxLevel) return false;
  const cost = upgradeCost(definition, level);
  if (state.credits < cost) return false;
  state.credits -= cost;
  player.upgrades[definition.id] = level + 1;
  if (definition.id === 'hull') {
    player.maxHull += 25;
    player.hull = Math.min(player.maxHull, player.hull + 25);
  }
  return true;
}

// A fresh dock visit starts with these derived numbers, for the panel.
export function dockSummary(player) {
  return UPGRADES.map((definition) => {
    const level = upgradeLevel(player, definition.id);
    return {
      id: definition.id,
      name: definition.name,
      blurb: definition.blurb,
      level,
      maxLevel: definition.maxLevel,
      cost: level >= definition.maxLevel ? null : upgradeCost(definition, level),
      maxed: level >= definition.maxLevel,
    };
  });
}

export { PLAYER };
