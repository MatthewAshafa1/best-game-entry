// Starlight Salvage — tuning constants.
// One place for every number that shapes how the game feels, so balancing
// never means hunting through the simulation code.

export const VIEW = {
  width: 1280,
  height: 800,
  // The playfield is larger than the screen; the camera follows the ship.
  worldWidth: 2000,
  worldHeight: 1400,
};

export const PLAYER = {
  radius: 16,
  accel: 900, // px per second squared
  maxSpeed: 330,
  drag: 0.92, // velocity kept each frame at 60fps, as a per-frame factor
  maxHull: 100,
  fireCooldown: 0.16, // seconds between blaster shots
  bulletSpeed: 640,
  bulletDamage: 1,
  magnetRadius: 90, // scrap drifts toward the ship inside this radius
  pickupRadius: 26,
  invulnerableAfterHit: 0.9, // seconds of flashing safety after a hit
};

export const SCRAP = {
  radius: 7,
  // Credits a single piece of scrap is worth, by tier.
  value: { small: 5, chunk: 12, relic: 60 },
  // How long a piece floats before it blinks out, in seconds.
  lifetime: 26,
  driftSpeed: 24,
};

export const ASTEROID = {
  radius: { small: 14, medium: 24, large: 38 },
  // Hull damage on impact, by size.
  damage: { small: 8, medium: 14, large: 22 },
  // Scrap pieces released when one is blasted apart, by size.
  scrapYield: { small: 1, medium: 2, large: 4 },
  // Points for destroying one, by size.
  score: { small: 25, medium: 50, large: 100 },
  speed: { min: 26, max: 78 },
  spin: 1.4, // radians per second, at most
};

export const DRONE = {
  radius: 15,
  hull: 2, // blaster hits to destroy
  speed: 130,
  keepDistance: 260, // it strafes at about this range
  fireCooldown: 2.1, // seconds between its shots
  bulletSpeed: 300,
  bulletDamage: 10,
  score: 150,
  scrapYield: 3,
};

export const WAVES = {
  // Scrap pieces the player must collect to clear each wave.
  // Wave n asks for quota(n) pieces; the field always holds a few extra.
  quota: (n) => 6 + n * 3,
  asteroids: (n) => Math.min(4 + n * 2, 26),
  drones: (n) => (n < 2 ? 0 : Math.min(n - 1, 6)),
  // Seconds between hazard spawns while a wave runs.
  spawnInterval: (n) => Math.max(1.1, 2.6 - n * 0.18),
};

// Combo: collecting scrap within this window of the last piece raises the
// multiplier by one step, up to COMBO_MAX. The multiplier applies to score.
export const COMBO = { window: 3.0, max: 8, stepScore: 10 };

// Between-wave dock upgrades. Cost grows with the level already owned.
export const UPGRADES = [
  {
    id: 'hull',
    name: 'Hull Plating',
    blurb: '+25 max hull, and repair 25 now',
    maxLevel: 4,
    baseCost: 40,
    costStep: 35,
  },
  {
    id: 'magnet',
    name: 'Magnet Coil',
    blurb: '+45 salvage magnet radius',
    maxLevel: 4,
    baseCost: 35,
    costStep: 30,
  },
  {
    id: 'thrusters',
    name: 'Ion Thrusters',
    blurb: '+12% top speed and acceleration',
    maxLevel: 4,
    baseCost: 35,
    costStep: 30,
  },
  {
    id: 'blaster',
    name: 'Twin Blaster',
    blurb: 'Fire rate +25% and +1 damage',
    maxLevel: 5,
    baseCost: 50,
    costStep: 40,
  },
  {
    id: 'shield',
    name: 'Shield Cell',
    blurb: 'Regenerate 1 hull every 2 seconds',
    maxLevel: 3,
    baseCost: 60,
    costStep: 45,
  },
];

export const SCORE = {
  waveClearBonus: (n) => 100 * n,
  relicBonus: 250,
};

export const AUDIO = {
  masterVolume: 0.5,
};
