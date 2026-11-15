// Starlight Salvage — entities.
// Plain factory functions and per-frame updates for everything that moves:
// the salvage skiff, scrap, asteroids, rogue drones, bullets, particles and
// floating score text. Entities hold data only; drawing lives in render.js.

import { ASTEROID, DRONE, PLAYER, SCRAP, VIEW } from './config.js';

export function makePlayer() {
  return {
    kind: 'player',
    x: VIEW.worldWidth / 2,
    y: VIEW.worldHeight / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // nose points up at rest
    radius: PLAYER.radius,
    hull: PLAYER.maxHull,
    maxHull: PLAYER.maxHull,
    fireTimer: 0,
    invulnerable: 0,
    thrusting: false,
    // Upgrade levels, keyed by upgrade id.
    upgrades: { hull: 0, magnet: 0, thrusters: 0, blaster: 0, shield: 0 },
    shieldTimer: 0,
    trail: [], // recent positions for the engine trail
  };
}

export function playerStats(player) {
  const level = player.upgrades;
  return {
    maxSpeed: PLAYER.maxSpeed * (1 + 0.12 * level.thrusters),
    accel: PLAYER.accel * (1 + 0.12 * level.thrusters),
    magnetRadius: PLAYER.magnetRadius + 45 * level.magnet,
    fireCooldown: PLAYER.fireCooldown / (1 + 0.25 * level.blaster),
    bulletDamage: PLAYER.bulletDamage + level.blaster,
    shieldRegen: level.shield > 0,
  };
}

export function makeScrap(x, y, tier = 'small') {
  const angle = Math.random() * Math.PI * 2;
  const speed = SCRAP.driftSpeed * (0.4 + Math.random() * 0.8);
  return {
    kind: 'scrap',
    tier,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: tier === 'relic' ? 12 : tier === 'chunk' ? 9 : SCRAP.radius,
    value: SCRAP.value[tier],
    age: 0,
    lifetime: SCRAP.lifetime,
    spin: (Math.random() - 0.5) * 2,
    rotation: Math.random() * Math.PI * 2,
  };
}

export function makeAsteroid(x, y, size = null) {
  const sizes = ['small', 'medium', 'large'];
  const picked = size || sizes[Math.floor(Math.random() * sizes.length)];
  const angle = Math.random() * Math.PI * 2;
  const speed = ASTEROID.speed.min + Math.random() * (ASTEROID.speed.max - ASTEROID.speed.min);
  return {
    kind: 'asteroid',
    size: picked,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: ASTEROID.radius[picked],
    hull: picked === 'large' ? 3 : picked === 'medium' ? 2 : 1,
    maxHull: picked === 'large' ? 3 : picked === 'medium' ? 2 : 1,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 2 * ASTEROID.spin,
    // Irregular outline: a fixed set of radial bumps so each rock looks distinct.
    bumps: Array.from({ length: 9 }, () => 0.78 + Math.random() * 0.42),
  };
}

export function makeDrone(x, y) {
  return {
    kind: 'drone',
    x,
    y,
    vx: 0,
    vy: 0,
    radius: DRONE.radius,
    hull: DRONE.hull,
    maxHull: DRONE.hull,
    angle: 0,
    fireTimer: 1 + Math.random(),
    strafeDir: Math.random() < 0.5 ? -1 : 1,
    strafeTimer: 0,
  };
}

export function makeBullet(x, y, angle, speed, damage, friendly) {
  return {
    kind: 'bullet',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 4,
    damage,
    friendly,
    age: 0,
    lifetime: 1.6,
  };
}

export function makeParticle(x, y, options = {}) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (options.speed ?? 120) * (0.3 + Math.random() * 0.9);
  return {
    kind: 'particle',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 1.5 + Math.random() * (options.size ?? 2.5),
    color: options.color ?? '#ffd166',
    age: 0,
    lifetime: 0.4 + Math.random() * (options.lifetime ?? 0.5),
    drag: 0.94,
  };
}

export function makeFloatText(x, y, text, color = '#ffffff') {
  return { kind: 'floatText', x, y, text, color, age: 0, lifetime: 1.1 };
}

export function burst(particles, x, y, count, options = {}) {
  for (let i = 0; i < count; i++) particles.push(makeParticle(x, y, options));
}

export function keepInWorld(entity, margin = 0) {
  const minX = margin;
  const minY = margin;
  const maxX = VIEW.worldWidth - margin;
  const maxY = VIEW.worldHeight - margin;
  if (entity.x < minX) {
    entity.x = minX;
    entity.vx = Math.abs(entity.vx);
  } else if (entity.x > maxX) {
    entity.x = maxX;
    entity.vx = -Math.abs(entity.vx);
  }
  if (entity.y < minY) {
    entity.y = minY;
    entity.vy = Math.abs(entity.vy);
  } else if (entity.y > maxY) {
    entity.y = maxY;
    entity.vy = -Math.abs(entity.vy);
  }
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// --- Per-frame updates -------------------------------------------------

export function updatePlayer(player, input, stats, dt, worldToScreen) {
  const move = input.moveVector();
  player.thrusting = move.x !== 0 || move.y !== 0;
  player.vx += move.x * stats.accel * dt;
  player.vy += move.y * stats.accel * dt;
  // Drag keeps the ship from sliding forever; applied per frame.
  const dragFactor = Math.pow(PLAYER.drag, dt * 60);
  player.vx *= dragFactor;
  player.vy *= dragFactor;
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > stats.maxSpeed) {
    player.vx = (player.vx / speed) * stats.maxSpeed;
    player.vy = (player.vy / speed) * stats.maxSpeed;
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  keepInWorld(player, player.radius);

  // The nose follows the mouse when it is over the canvas, else the motion.
  if (input.mouse.inside) {
    const screen = worldToScreen(player.x, player.y);
    player.angle = Math.atan2(input.mouse.y - screen.y, input.mouse.x - screen.x);
  } else if (speed > 30) {
    player.angle = Math.atan2(player.vy, player.vx);
  }

  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.fireTimer > 0) player.fireTimer -= dt;

  // Shield Cell: slow regeneration while the ship is intact enough to run it.
  if (stats.shieldRegen && player.hull < player.maxHull) {
    player.shieldTimer += dt;
    if (player.shieldTimer >= 2) {
      player.shieldTimer = 0;
      player.hull = Math.min(player.maxHull, player.hull + 1);
    }
  }

  // Engine trail: remember recent positions, newest first.
  player.trail.unshift({ x: player.x, y: player.y });
  if (player.trail.length > 14) player.trail.pop();
}

export function updateScrap(scrap, player, stats, dt) {
  scrap.age += dt;
  const dx = player.x - scrap.x;
  const dy = player.y - scrap.y;
  const dist = Math.hypot(dx, dy);
  if (dist < stats.magnetRadius && dist > 1) {
    // Magnet pull grows stronger as the scrap gets closer.
    const pull = 620 * (1 - dist / stats.magnetRadius) + 120;
    scrap.vx += (dx / dist) * pull * dt;
    scrap.vy += (dy / dist) * pull * dt;
  }
  scrap.vx *= Math.pow(0.985, dt * 60);
  scrap.vy *= Math.pow(0.985, dt * 60);
  scrap.x += scrap.vx * dt;
  scrap.y += scrap.vy * dt;
  scrap.rotation += scrap.spin * dt;
  keepInWorld(scrap, scrap.radius);
}

export function updateAsteroid(asteroid, dt) {
  asteroid.x += asteroid.vx * dt;
  asteroid.y += asteroid.vy * dt;
  asteroid.rotation += asteroid.spin * dt;
  keepInWorld(asteroid, asteroid.radius);
}

export function updateDrone(drone, player, dt, onShoot) {
  const dx = player.x - drone.x;
  const dy = player.y - drone.y;
  const dist = Math.hypot(dx, dy) || 1;
  drone.angle = Math.atan2(dy, dx);
  // Strafe sideways at range, close in when too far, back off when too near.
  drone.strafeTimer -= dt;
  if (drone.strafeTimer <= 0) {
    drone.strafeTimer = 1.2 + Math.random() * 1.4;
    drone.strafeDir *= -1;
  }
  const radial = dist > DRONE.keepDistance + 60 ? 1 : dist < DRONE.keepDistance - 60 ? -1 : 0;
  const strafeX = -dy / dist;
  const strafeY = dx / dist;
  drone.vx = (dx / dist) * radial * DRONE.speed + strafeX * drone.strafeDir * DRONE.speed * 0.7;
  drone.vy = (dy / dist) * radial * DRONE.speed + strafeY * drone.strafeDir * DRONE.speed * 0.7;
  drone.x += drone.vx * dt;
  drone.y += drone.vy * dt;
  keepInWorld(drone, drone.radius);

  drone.fireTimer -= dt;
  if (drone.fireTimer <= 0 && dist < 560) {
    drone.fireTimer = DRONE.fireCooldown * (0.85 + Math.random() * 0.3);
    onShoot(drone);
  }
}

export function updateBullet(bullet, dt) {
  bullet.age += dt;
  bullet.x += bullet.vx * dt;
  bullet.y += bullet.vy * dt;
}

export function updateParticle(particle, dt) {
  particle.age += dt;
  particle.vx *= Math.pow(particle.drag, dt * 60);
  particle.vy *= Math.pow(particle.drag, dt * 60);
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
}

export function updateFloatText(text, dt) {
  text.age += dt;
  text.y -= 34 * dt;
}
