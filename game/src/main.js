// Starlight Salvage — the game itself.
// Owns the state machine (title → playing → dock → playing … → game over),
// the frame loop, collisions, scoring and the camera. Drawing lives in
// render.js; tuning lives in config.js; sound in audio.js.
//
// Screenshot staging: opening the page with ?shot=title, ?shot=play,
// ?shot=dock or ?shot=over jumps straight into a staged scene of the real
// game, so a screenshot shows the game itself, mid-flight, with no editing.

import { ASTEROID, COMBO, DRONE, PLAYER, SCORE, VIEW, WAVES } from './config.js';
import {
  burst,
  distance,
  makeAsteroid,
  makeBullet,
  makeDrone,
  makeFloatText,
  makeParticle,
  makePlayer,
  makeScrap,
  playerStats,
  updateAsteroid,
  updateBullet,
  updateDrone,
  updateFloatText,
  updateParticle,
  updatePlayer,
  updateScrap,
} from './entities.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { sfx, startAmbient, toggleMute, unlockAudio } from './audio.js';
import { createWaveDirector, droneScore, asteroidScore, startWave, updateWave } from './waves.js';
import { buyUpgrade, dockSummary, upgradeList } from './upgrades.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const BEST_KEY = 'starlight-salvage-best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private browsing or blocked storage: the run still counts.
  }
}

function freshState() {
  return {
    phase: 'title', // title | playing | paused | dock | over
    player: makePlayer(),
    scrap: [],
    asteroids: [],
    drones: [],
    bullets: [],
    particles: [],
    floatTexts: [],
    wave: createWaveDirector(),
    score: 0,
    credits: 0,
    combo: { count: 0, timer: 0 },
    wavesCleared: 0,
    totalScrap: 0,
    dronesDowned: 0,
    asteroidsDowned: 0,
    lastWaveBonus: 0,
    best: loadBest(),
    camera: { x: 0, y: 0, shake: 0 },
    time: 0,
  };
}

const state = freshState();
const input = createInput(canvas);

function worldToScreen(x, y) {
  return { x: x - state.camera.x, y: y - state.camera.y };
}

function screenToWorld(x, y) {
  return { x: x + state.camera.x, y: y + state.camera.y };
}

function addShake(amount) {
  state.camera.shake = Math.min(14, state.camera.shake + amount);
}

function startRun() {
  const best = state.best;
  const fresh = freshState();
  Object.assign(state, fresh);
  state.best = best;
  state.phase = 'playing';
  startWave(state.wave, 1, state);
  sfx.waveStart();
}

function openDock() {
  state.phase = 'dock';
  state.lastWaveBonus = SCORE.waveClearBonus(state.wave.number);
  state.score += state.lastWaveBonus;
  state.wavesCleared += 1;
  sfx.waveClear();
}

function nextWave() {
  state.phase = 'playing';
  startWave(state.wave, state.wave.number + 1, state);
  sfx.waveStart();
}

function endRun() {
  state.phase = 'over';
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  sfx.gameOver();
}

function collectScrap(scrap) {
  state.totalScrap += 1;
  state.credits += scrap.value;
  state.wave.collected += 1;
  // Combo: a pickup inside the window raises the multiplier by one step.
  if (state.combo.timer > 0) {
    state.combo.count = Math.min(state.combo.count + 1, COMBO.max);
  } else {
    state.combo.count = 1;
  }
  state.combo.timer = COMBO.window;
  const gained = scrap.value * state.combo.count;
  state.score += gained;
  state.floatTexts.push(
    makeFloatText(scrap.x, scrap.y - 14, `+${gained}  ◈${scrap.value}`, scrap.tier === 'relic' ? '#ff9df5' : '#ffd166'),
  );
  burst(state.particles, scrap.x, scrap.y, scrap.tier === 'relic' ? 16 : 6, {
    color: scrap.tier === 'relic' ? '#ff9df5' : '#ffd166',
    speed: 90,
    lifetime: 0.45,
  });
  if (scrap.tier === 'relic') {
    state.score += SCORE.relicBonus;
    state.floatTexts.push(makeFloatText(scrap.x, scrap.y - 34, `RELIC BONUS +${SCORE.relicBonus}`, '#ff9df5'));
    sfx.relic();
  } else {
    sfx.pickup(state.combo.count);
  }
}

function damagePlayer(amount, fromX, fromY) {
  const player = state.player;
  if (player.invulnerable > 0 || state.phase !== 'playing') return;
  player.hull -= amount;
  player.invulnerable = PLAYER.invulnerableAfterHit;
  addShake(9);
  burst(state.particles, player.x, player.y, 18, { color: '#ff5d5d', speed: 200, lifetime: 0.6 });
  sfx.hit();
  // Knock the ship away from whatever hit it.
  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  player.vx += (dx / dist) * 260;
  player.vy += (dy / dist) * 260;
  if (player.hull <= 0) {
    player.hull = 0;
    burst(state.particles, player.x, player.y, 60, { color: '#ffd166', speed: 320, lifetime: 1.1, size: 4 });
    burst(state.particles, player.x, player.y, 30, { color: '#ff5d5d', speed: 220, lifetime: 0.9, size: 3 });
    sfx.explosion(true);
    endRun();
  }
}

function destroyAsteroid(asteroid, index) {
  state.asteroids.splice(index, 1);
  state.asteroidsDowned += 1;
  state.score += asteroidScore(asteroid.size);
  state.floatTexts.push(makeFloatText(asteroid.x, asteroid.y, `+${asteroidScore(asteroid.size)}`, '#e8f1ff'));
  burst(state.particles, asteroid.x, asteroid.y, asteroid.size === 'large' ? 26 : 14, {
    color: '#b09a7a',
    speed: 180,
    lifetime: 0.8,
    size: 3,
  });
  sfx.explosion(asteroid.size === 'large');
  // Shattered rock leaves its salvage behind.
  const yields = { small: 1, medium: 2, large: 4 }[asteroid.size];
  for (let i = 0; i < yields; i++) {
    state.scrap.push(makeScrap(asteroid.x + (Math.random() - 0.5) * 30, asteroid.y + (Math.random() - 0.5) * 30, 'small'));
  }
  addShake(asteroid.size === 'large' ? 7 : 3);
}

function destroyDrone(drone, index) {
  state.drones.splice(index, 1);
  state.dronesDowned += 1;
  state.score += droneScore();
  state.floatTexts.push(makeFloatText(drone.x, drone.y, `+${droneScore()}`, '#ff8fa3'));
  burst(state.particles, drone.x, drone.y, 24, { color: '#ff8fa3', speed: 240, lifetime: 0.8, size: 3 });
  sfx.explosion(false);
  for (let i = 0; i < DRONE.scrapYield; i++) {
    state.scrap.push(makeScrap(drone.x + (Math.random() - 0.5) * 30, drone.y + (Math.random() - 0.5) * 30, 'small'));
  }
  addShake(4);
}

function firePlayerBullet() {
  const player = state.player;
  const stats = playerStats(player);
  if (player.fireTimer > 0) return;
  player.fireTimer = stats.fireCooldown;
  // Aim at the mouse in world space; without a mouse, fire where the nose points.
  let angle = player.angle;
  if (input.mouse.inside) {
    const target = screenToWorld(input.mouse.x, input.mouse.y);
    angle = Math.atan2(target.y - player.y, target.x - player.x);
    player.angle = angle;
  }
  const noseX = player.x + Math.cos(angle) * 20;
  const noseY = player.y + Math.sin(angle) * 20;
  state.bullets.push(makeBullet(noseX, noseY, angle, PLAYER.bulletSpeed, stats.bulletDamage, true));
  state.particles.push(
    makeParticle(noseX, noseY, { color: '#aee6ff', speed: 40, lifetime: 0.15, size: 2 }),
  );
  sfx.shoot();
}

function droneShoot(drone) {
  const player = state.player;
  const angle = Math.atan2(player.y - drone.y, player.x - drone.x);
  state.bullets.push(
    makeBullet(drone.x + Math.cos(angle) * 18, drone.y + Math.sin(angle) * 18, angle, DRONE.bulletSpeed, DRONE.bulletDamage, false),
  );
  sfx.droneShot();
}

// --- Collisions ------------------------------------------------------------

function handleCollisions() {
  const player = state.player;

  // Friendly bullets against asteroids and drones.
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    if (!bullet.friendly) continue;
    let consumed = false;
    for (let j = state.asteroids.length - 1; j >= 0; j--) {
      const rock = state.asteroids[j];
      if (distance(bullet, rock) < bullet.radius + rock.radius) {
        rock.hull -= bullet.damage;
        burst(state.particles, bullet.x, bullet.y, 4, { color: '#ffd166', speed: 120, lifetime: 0.3 });
        if (rock.hull <= 0) destroyAsteroid(rock, j);
        consumed = true;
        break;
      }
    }
    if (!consumed) {
      for (let j = state.drones.length - 1; j >= 0; j--) {
        const drone = state.drones[j];
        if (distance(bullet, drone) < bullet.radius + drone.radius) {
          drone.hull -= bullet.damage;
          burst(state.particles, bullet.x, bullet.y, 4, { color: '#ff8fa3', speed: 120, lifetime: 0.3 });
          if (drone.hull <= 0) destroyDrone(drone, j);
          consumed = true;
          break;
        }
      }
    }
    if (consumed) state.bullets.splice(i, 1);
  }

  // Enemy bullets against the player.
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    if (bullet.friendly) continue;
    if (distance(bullet, player) < bullet.radius + player.radius) {
      state.bullets.splice(i, 1);
      damagePlayer(bullet.damage, bullet.x - bullet.vx * 0.05, bullet.y - bullet.vy * 0.05);
    }
  }

  // The player against asteroids: a bump hurts both.
  for (let j = state.asteroids.length - 1; j >= 0; j--) {
    const rock = state.asteroids[j];
    if (distance(player, rock) < player.radius + rock.radius - 2) {
      damagePlayer({ small: 8, medium: 14, large: 22 }[rock.size], rock.x, rock.y);
      rock.hull -= 1;
      // Shove the rock away so the two do not stick together.
      const dx = rock.x - player.x;
      const dy = rock.y - player.y;
      const dist = Math.hypot(dx, dy) || 1;
      rock.vx = (dx / dist) * 120;
      rock.vy = (dy / dist) * 120;
      if (rock.hull <= 0) destroyAsteroid(rock, j);
    }
  }

  // The player against drones: a ram hurts both.
  for (let j = state.drones.length - 1; j >= 0; j--) {
    const drone = state.drones[j];
    if (distance(player, drone) < player.radius + drone.radius - 2) {
      damagePlayer(DRONE.bulletDamage, drone.x, drone.y);
      drone.hull -= 1;
      if (drone.hull <= 0) destroyDrone(drone, j);
    }
  }

  // The player against scrap: bank it.
  for (let i = state.scrap.length - 1; i >= 0; i--) {
    const scrap = state.scrap[i];
    if (distance(player, scrap) < PLAYER.pickupRadius + scrap.radius) {
      state.scrap.splice(i, 1);
      collectScrap(scrap);
    }
  }
}

// --- Per-frame updates ------------------------------------------------------

function updatePlaying(dt) {
  const player = state.player;
  const stats = playerStats(player);
  updatePlayer(player, input, stats, dt, worldToScreen);
  if (input.firing()) firePlayerBullet();

  for (const scrap of state.scrap) updateScrap(scrap, player, stats, dt);
  for (const rock of state.asteroids) updateAsteroid(rock, dt);
  for (const drone of state.drones) updateDrone(drone, player, dt, droneShoot);
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    updateBullet(bullet, dt);
    const outOfWorld =
      bullet.x < -40 || bullet.x > VIEW.worldWidth + 40 || bullet.y < -40 || bullet.y > VIEW.worldHeight + 40;
    if (bullet.age > bullet.lifetime || outOfWorld) state.bullets.splice(i, 1);
  }
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    updateParticle(particle, dt);
    if (particle.age > particle.lifetime) state.particles.splice(i, 1);
  }
  for (let i = state.floatTexts.length - 1; i >= 0; i--) {
    const text = state.floatTexts[i];
    updateFloatText(text, dt);
    if (text.age > text.lifetime) state.floatTexts.splice(i, 1);
  }
  // Old scrap blinks out so the field never clogs.
  for (let i = state.scrap.length - 1; i >= 0; i--) {
    if (state.scrap[i].age > state.scrap[i].lifetime) state.scrap.splice(i, 1);
  }

  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) state.combo.count = 0;
  }

  handleCollisions();
  updateWave(state.wave, state, dt);
  if (state.wave.phase === 'cleared') openDock();

  // Camera follows the ship, clamped inside the world, with shake decay.
  const targetX = Math.max(0, Math.min(VIEW.worldWidth - VIEW.width, player.x - VIEW.width / 2));
  const targetY = Math.max(0, Math.min(VIEW.worldHeight - VIEW.height, player.y - VIEW.height / 2));
  state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5);
  state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5);
  state.camera.shake = Math.max(0, state.camera.shake - dt * 26);
}

function updateAmbient(dt) {
  // Particles and floating text keep drifting on the dock and game-over
  // screens, so those scenes stay alive behind their panels.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const particle = state.particles[i];
    updateParticle(particle, dt);
    if (particle.age > particle.lifetime) state.particles.splice(i, 1);
  }
  for (let i = state.floatTexts.length - 1; i >= 0; i--) {
    const text = state.floatTexts[i];
    updateFloatText(text, dt);
    if (text.age > text.lifetime) state.floatTexts.splice(i, 1);
  }
}

// --- Input routing by phase --------------------------------------------------

function handlePhaseInput() {
  if (input.wasPressed('m')) {
    const muted = toggleMute();
    state.floatTexts.push(
      makeFloatText(state.player.x, state.player.y - 30, muted ? 'Sound off' : 'Sound on', '#9db4d8'),
    );
  }

  if (state.phase === 'title') {
    if (input.wasPressed('Enter') || input.mouse.down) {
      unlockAudio();
      startAmbient();
      sfx.click();
      startRun();
    }
    return;
  }

  if (state.phase === 'playing') {
    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      state.phase = 'paused';
      sfx.click();
    }
    return;
  }

  if (state.phase === 'paused') {
    if (input.wasPressed('p') || input.wasPressed('Escape') || input.wasPressed('Enter')) {
      state.phase = 'playing';
      sfx.click();
    }
    return;
  }

  if (state.phase === 'dock') {
    const rows = dockSummary(state.player);
    for (let i = 0; i < rows.length; i++) {
      if (input.wasPressed(String(i + 1))) {
        const bought = buyUpgrade(state.player, upgradeList()[i], state);
        if (bought) sfx.buy();
        else sfx.denied();
      }
    }
    if (input.wasPressed('Enter')) {
      sfx.click();
      nextWave();
    }
    return;
  }

  if (state.phase === 'over') {
    if (input.wasPressed('r') || input.wasPressed('Enter') || input.mouse.down) {
      unlockAudio();
      sfx.click();
      startRun();
    }
  }
}

// --- Screenshot staging ------------------------------------------------------
// ?shot=play / dock / over builds a lively, real scene of the game so the
// screenshots show the loop honestly: the same code, the same simulation,
// just started part-way in.

function stageScene(kind) {
  if (kind === 'title') {
    state.phase = 'title';
    // A few drifting rocks and gems behind the title panel.
    for (let i = 0; i < 5; i++) {
      state.asteroids.push(makeAsteroid(300 + Math.random() * 700, 120 + Math.random() * 560, 'medium'));
    }
    for (let i = 0; i < 8; i++) {
      state.scrap.push(makeScrap(200 + Math.random() * 880, 100 + Math.random() * 600, 'small'));
    }
    return;
  }

  startRun();
  if (kind === 'play') {
    // Mid-wave-two action: the quota is half done, hazards are in, and the
    // ship is firing with a combo running.
    state.wave.number = 2;
    state.wave.quota = 12;
    state.wave.collected = 7;
    state.score = 2840;
    state.credits = 96;
    state.combo.count = 4;
    state.combo.timer = 2.2;
    state.player.x = 1150;
    state.player.y = 760;
    state.player.vx = 120;
    state.player.vy = -60;
    state.player.upgrades.blaster = 1;
    state.player.upgrades.magnet = 1;
    for (let i = 0; i < 6; i++) {
      const rock = makeAsteroid(700 + Math.random() * 1000, 350 + Math.random() * 700);
      state.asteroids.push(rock);
    }
    const droneA = makeDrone(1500, 500);
    const droneB = makeDrone(900, 1050);
    state.drones.push(droneA, droneB);
    for (let i = 0; i < 10; i++) {
      state.scrap.push(makeScrap(750 + Math.random() * 900, 300 + Math.random() * 750, 'small'));
    }
    state.scrap.push(makeScrap(1450, 420, 'chunk'));
    state.scrap.push(makeScrap(820, 900, 'relic'));
    // A volley already in flight and a fresh explosion, so the frame reads
    // as a moment of play rather than a posed still.
    state.bullets.push(makeBullet(1200, 740, -0.4, PLAYER.bulletSpeed, 2, true));
    state.bullets.push(makeBullet(1220, 770, 0.3, PLAYER.bulletSpeed, 2, true));
    burst(state.particles, 1500, 620, 22, { color: '#ffd166', speed: 220, lifetime: 0.9, size: 3 });
    state.floatTexts.push(makeFloatText(1500, 590, '+150', '#ff8fa3'));
    state.floatTexts.push(makeFloatText(1180, 700, '+48  ◈12', '#ffd166'));
    state.camera.x = 560;
    state.camera.y = 360;
    return;
  }

  if (kind === 'dock') {
    state.wave.number = 3;
    state.wave.phase = 'cleared';
    state.wave.quota = WAVES.quota(3);
    state.wave.collected = WAVES.quota(3);
    state.score = 5210;
    state.credits = 148;
    state.lastWaveBonus = 300;
    state.wavesCleared = 3;
    state.totalScrap = 41;
    state.player.upgrades.hull = 1;
    state.player.upgrades.magnet = 1;
    state.player.maxHull = 125;
    state.player.hull = 88;
    state.player.x = 1200;
    state.player.y = 800;
    for (let i = 0; i < 4; i++) {
      state.asteroids.push(makeAsteroid(500 + Math.random() * 1200, 200 + Math.random() * 900, 'small'));
    }
    for (let i = 0; i < 6; i++) {
      state.scrap.push(makeScrap(600 + Math.random() * 1000, 250 + Math.random() * 800, 'small'));
    }
    state.camera.x = 560;
    state.camera.y = 400;
    openDock();
    return;
  }

  if (kind === 'over') {
    state.wave.number = 4;
    state.score = 7480;
    state.credits = 210;
    state.wavesCleared = 3;
    state.totalScrap = 63;
    state.dronesDowned = 7;
    state.asteroidsDowned = 18;
    state.player.hull = 0;
    state.player.x = 1200;
    state.player.y = 800;
    for (let i = 0; i < 5; i++) {
      state.asteroids.push(makeAsteroid(500 + Math.random() * 1200, 200 + Math.random() * 900));
    }
    burst(state.particles, 1200, 800, 40, { color: '#ffd166', speed: 280, lifetime: 1.0, size: 4 });
    state.camera.x = 560;
    state.camera.y = 400;
    endRun();
  }
}

// --- Frame loop ---------------------------------------------------------------

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  state.time += dt;

  handlePhaseInput();
  if (state.phase === 'playing') updatePlaying(dt);
  else updateAmbient(dt);

  // Camera shake: a small random offset that decays with the shake value.
  const shakeX = state.camera.shake > 0 ? (Math.random() - 0.5) * state.camera.shake : 0;
  const shakeY = state.camera.shake > 0 ? (Math.random() - 0.5) * state.camera.shake : 0;
  const viewCamera = { x: state.camera.x + shakeX, y: state.camera.y + shakeY };

  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  render(ctx, state, viewCamera, state.time);
  input.endFrame();
  requestAnimationFrame(frame);
}

// Unlock audio on the first gesture anywhere, so the title screen can sing.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('blur', () => {
  if (state.phase === 'playing') state.phase = 'paused';
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageScene(shot);
} else {
  // A quiet drift of rocks and gems behind the title screen.
  for (let i = 0; i < 4; i++) {
    state.asteroids.push(makeAsteroid(300 + Math.random() * 700, 120 + Math.random() * 560, 'medium'));
  }
  for (let i = 0; i < 6; i++) {
    state.scrap.push(makeScrap(200 + Math.random() * 880, 100 + Math.random() * 600, 'small'));
  }
}

requestAnimationFrame(frame);
