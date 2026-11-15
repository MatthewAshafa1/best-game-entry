// Starlight Salvage — waves.
// The wave director owns the rhythm of a run: what a wave asks for, what
// drifts in while it runs, and when the dock opens. main.js asks it to start
// a wave and then calls update() every frame.

import { ASTEROID, DRONE, SCRAP, VIEW, WAVES } from './config.js';
import { makeAsteroid, makeDrone, makeScrap } from './entities.js';

function randomEdgePoint(margin = 60) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: margin + Math.random() * (VIEW.worldWidth - margin * 2), y: margin };
  if (side === 1) return { x: margin + Math.random() * (VIEW.worldWidth - margin * 2), y: VIEW.worldHeight - margin };
  if (side === 2) return { x: margin, y: margin + Math.random() * (VIEW.worldHeight - margin * 2) };
  return { x: VIEW.worldWidth - margin, y: margin + Math.random() * (VIEW.worldHeight - margin * 2) };
}

function randomFieldPoint(player, minDistance = 320) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let point;
    if (Math.random() < 0.65) {
      // Most spawns land a short flight from the ship, so the player always
      // has something in reach instead of an empty stretch of space.
      const angle = Math.random() * Math.PI * 2;
      const dist = 350 + Math.random() * 600;
      point = {
        x: Math.max(80, Math.min(VIEW.worldWidth - 80, player.x + Math.cos(angle) * dist)),
        y: Math.max(80, Math.min(VIEW.worldHeight - 80, player.y + Math.sin(angle) * dist)),
      };
    } else {
      point = {
        x: 80 + Math.random() * (VIEW.worldWidth - 160),
        y: 80 + Math.random() * (VIEW.worldHeight - 160),
      };
    }
    if (Math.hypot(point.x - player.x, point.y - player.y) >= minDistance) return point;
  }
  return { x: VIEW.worldWidth / 2 + 420, y: VIEW.worldHeight / 2 };
}

export function createWaveDirector() {
  return {
    number: 0,
    phase: 'idle', // idle | running | cleared
    quota: 0,
    collected: 0,
    spawnTimer: 0,
    asteroidsToSpawn: 0,
    dronesToSpawn: 0,
    relicSpawned: false,
  };
}

export function startWave(director, number, state) {
  director.number = number;
  director.phase = 'running';
  director.quota = WAVES.quota(number);
  director.collected = 0;
  director.spawnTimer = 1.2;
  director.asteroidsToSpawn = WAVES.asteroids(number);
  director.dronesToSpawn = WAVES.drones(number);
  director.relicSpawned = false;

  // Seed the field with most of the wave's scrap at once, so the player
  // always has something to chase; the rest trickles in as hazards spawn.
  const seedCount = Math.min(director.quota + 4, 18);
  for (let i = 0; i < seedCount; i++) {
    const point = randomFieldPoint(state.player);
    state.scrap.push(makeScrap(point.x, point.y, 'small'));
  }
  // One chunk of richer scrap per wave, tucked somewhere in the field.
  const chunkPoint = randomFieldPoint(state.player);
  state.scrap.push(makeScrap(chunkPoint.x, chunkPoint.y, 'chunk'));
}

export function updateWave(director, state, dt) {
  if (director.phase !== 'running') return;

  director.spawnTimer -= dt;
  if (director.spawnTimer <= 0) {
    director.spawnTimer = WAVES.spawnInterval(director.number);
    const player = state.player;

    if (director.asteroidsToSpawn > 0) {
      director.asteroidsToSpawn -= 1;
      const point = randomEdgePoint();
      state.asteroids.push(makeAsteroid(point.x, point.y));
    } else if (director.dronesToSpawn > 0) {
      director.dronesToSpawn -= 1;
      const point = randomEdgePoint();
      state.drones.push(makeDrone(point.x, point.y));
    } else if (!director.relicSpawned && director.number >= 2 && Math.random() < 0.35) {
      // A rare relic drifts in on later waves: worth a detour, and risky.
      director.relicSpawned = true;
      const point = randomFieldPoint(player, 420);
      state.scrap.push(makeScrap(point.x, point.y, 'relic'));
    } else if (state.scrap.length < director.quota - director.collected + 2) {
      // Keep enough scrap on the field that the quota stays reachable.
      const point = randomFieldPoint(player);
      state.scrap.push(makeScrap(point.x, point.y, 'small'));
    }
  }

  // The wave is cleared when the player banks the quota of scrap.
  if (director.collected >= director.quota) {
    director.phase = 'cleared';
  }
}

// Points for destroying an asteroid of a given size.
export function asteroidScore(size) {
  return ASTEROID.score[size];
}

export function droneScore() {
  return DRONE.score;
}

export { SCRAP };
