// Starlight Salvage — rendering.
// Every pixel the player sees is drawn here on one canvas: the parallax
// starfield and nebulae, the ship, scrap, asteroids, drones, bullets and
// particles, the HUD, and the title / dock / pause / game-over screens.
// No image files: the art is canvas shapes, gradients and glow.

import { VIEW } from './config.js';
import { dockSummary } from './upgrades.js';

const PALETTE = {
  bgTop: '#070b1e',
  bgBottom: '#0d1533',
  hull: '#8fd3ff',
  hullDark: '#3d7ea6',
  accent: '#ffd166',
  danger: '#ff5d5d',
  good: '#7dffa8',
  text: '#e8f1ff',
  dim: '#9db4d8',
  panel: 'rgba(10, 18, 40, 0.88)',
  panelEdge: 'rgba(143, 211, 255, 0.35)',
};

// Deterministic starfield: three parallax layers, seeded once.
function buildStars(seed, count, width, height) {
  let s = seed;
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: next() * width,
      y: next() * height,
      size: 0.6 + next() * 1.8,
      twinkle: next() * Math.PI * 2,
      speed: 0.4 + next() * 0.8,
    });
  }
  return stars;
}

const STAR_LAYERS = [
  { stars: buildStars(11, 120, VIEW.worldWidth, VIEW.worldHeight), depth: 0.25 },
  { stars: buildStars(47, 95, VIEW.worldWidth, VIEW.worldHeight), depth: 0.5 },
  { stars: buildStars(83, 60, VIEW.worldWidth, VIEW.worldHeight), depth: 0.8 },
];

const NEBULAE = [
  { x: 420, y: 320, r: 520, color: 'rgba(88, 60, 180, 0.26)' },
  { x: 1650, y: 1050, r: 620, color: 'rgba(20, 120, 140, 0.22)' },
  { x: 1400, y: 260, r: 420, color: 'rgba(180, 60, 110, 0.16)' },
  { x: 300, y: 1150, r: 460, color: 'rgba(20, 120, 140, 0.22)' },
];

function drawBackground(ctx, camera, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  gradient.addColorStop(0, PALETTE.bgTop);
  gradient.addColorStop(1, PALETTE.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const nebula of NEBULAE) {
    const glow = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
    glow.addColorStop(0, nebula.color);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(nebula.x - nebula.r, nebula.y - nebula.r, nebula.r * 2, nebula.r * 2);
  }
  for (const layer of STAR_LAYERS) {
    for (const star of layer.stars) {
      const sx = star.x * layer.depth + camera.x * (1 - layer.depth);
      const sy = star.y * layer.depth + camera.y * (1 - layer.depth);
      if (sx < camera.x - 20 || sx > camera.x + VIEW.width + 20) continue;
      if (sy < camera.y - 20 || sy > camera.y + VIEW.height + 20) continue;
      const alpha = 0.45 + 0.55 * Math.abs(Math.sin(time * star.speed + star.twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#dfeaff';
      ctx.fillRect(sx, sy, star.size, star.size);
    }
  }
  ctx.globalAlpha = 1;

  // World boundary: a faint dotted fence so the player can see the edge.
  ctx.strokeStyle = 'rgba(157, 180, 216, 0.25)';
  ctx.setLineDash([6, 14]);
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, VIEW.worldWidth - 8, VIEW.worldHeight - 8);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawShip(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);

  // Engine trail, fading back along the recent path.
  if (player.thrusting && player.trail.length > 1) {
    for (let i = 0; i < player.trail.length; i++) {
      const point = player.trail[i];
      const fade = 1 - i / player.trail.length;
      ctx.globalAlpha = fade * 0.5;
      ctx.fillStyle = i % 2 === 0 ? '#ffb347' : '#7dd7ff';
      ctx.beginPath();
      ctx.arc(point.x - player.x, point.y - player.y, 3.5 * fade + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.rotate(player.angle);
  // Flicker while invulnerable after a hit.
  if (player.invulnerable > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.35;

  // Hull: a swept dart with a cockpit and side fins.
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-14, -4);
  ctx.lineTo(-14, 4);
  ctx.lineTo(-6, 5);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  const hullGradient = ctx.createLinearGradient(-14, 0, 20, 0);
  hullGradient.addColorStop(0, PALETTE.hullDark);
  hullGradient.addColorStop(1, PALETTE.hull);
  ctx.fillStyle = hullGradient;
  ctx.fill();
  ctx.strokeStyle = 'rgba(232, 241, 255, 0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Cockpit.
  ctx.beginPath();
  ctx.arc(7, 0, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffe9a8';
  ctx.fill();

  // Engine flame when thrusting.
  if (player.thrusting) {
    const flicker = 8 + Math.random() * 7;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-14 - flicker, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fillStyle = '#ffb347';
    ctx.fill();
  }
  ctx.restore();
}

function drawScrap(ctx, scrap, time) {
  ctx.save();
  ctx.translate(scrap.x, scrap.y);
  ctx.rotate(scrap.rotation);
  const blink = scrap.age > scrap.lifetime - 4 ? (Math.floor(time * 6) % 2 === 0 ? 0.35 : 1) : 1;
  ctx.globalAlpha = blink;
  const color = scrap.tier === 'relic' ? '#ff9df5' : scrap.tier === 'chunk' ? PALETTE.accent : '#c9e6ff';
  const size = scrap.radius;
  if (scrap.tier === 'relic') {
    // A pulsing halo marks the relic as special.
    const halo = 14 + Math.sin(time * 4) * 3;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, halo);
    glow.addColorStop(0, 'rgba(255, 157, 245, 0.5)');
    glow.addColorStop(1, 'rgba(255, 157, 245, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-halo, -halo, halo * 2, halo * 2);
  }
  // A little faceted gem: a rotated square with a bright core.
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.7, 0);
  ctx.lineTo(0, size);
  ctx.lineTo(-size * 0.7, 0);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fill();
  ctx.restore();
}

function drawAsteroid(ctx, asteroid) {
  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.rotation);
  ctx.beginPath();
  const points = asteroid.bumps.length;
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = asteroid.radius * asteroid.bumps[i % points];
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const shade = asteroid.size === 'large' ? '#6b5a49' : asteroid.size === 'medium' ? '#7a6a58' : '#8a7a68';
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = 'rgba(20, 14, 8, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Craters.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(-asteroid.radius * 0.3, -asteroid.radius * 0.2, asteroid.radius * 0.22, 0, Math.PI * 2);
  ctx.arc(asteroid.radius * 0.35, asteroid.radius * 0.3, asteroid.radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  // Damage cracks when it has been hit.
  if (asteroid.hull < asteroid.maxHull) {
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-asteroid.radius * 0.5, 0);
    ctx.lineTo(0, asteroid.radius * 0.3);
    ctx.lineTo(asteroid.radius * 0.5, -asteroid.radius * 0.2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDrone(ctx, drone, time) {
  ctx.save();
  ctx.translate(drone.x, drone.y);
  ctx.rotate(drone.angle);
  // Spinning warning ring while it charges a shot.
  if (drone.fireTimer < 0.5) {
    ctx.strokeStyle = `rgba(255, 93, 93, ${0.5 + 0.5 * Math.sin(time * 20)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, drone.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -12);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-8, 12);
  ctx.closePath();
  ctx.fillStyle = '#c65b7c';
  ctx.fill();
  ctx.strokeStyle = '#ff8fa3';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Glowing eye.
  ctx.beginPath();
  ctx.arc(5, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ff2e4d';
  ctx.fill();
  ctx.restore();
}

function drawBullets(ctx, bullets) {
  for (const bullet of bullets) {
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(Math.atan2(bullet.vy, bullet.vx));
    ctx.fillStyle = bullet.friendly ? '#aee6ff' : '#ff7a7a';
    ctx.shadowColor = bullet.friendly ? '#7dd7ff' : '#ff5d5d';
    ctx.shadowBlur = 8;
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
  }
  ctx.shadowBlur = 0;
}

function drawParticles(ctx, particles) {
  for (const particle of particles) {
    const fade = 1 - particle.age / particle.lifetime;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * fade + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloatTexts(ctx, texts) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 15px system-ui, sans-serif';
  for (const text of texts) {
    const fade = 1 - text.age / text.lifetime;
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.globalAlpha = 1;
}

function drawWorld(ctx, state, camera, time) {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const scrap of state.scrap) drawScrap(ctx, scrap, time);
  for (const asteroid of state.asteroids) drawAsteroid(ctx, asteroid);
  for (const drone of state.drones) drawDrone(ctx, drone, time);
  drawBullets(ctx, state.bullets);
  drawShip(ctx, state.player, time);
  drawParticles(ctx, state.particles);
  drawFloatTexts(ctx, state.floatTexts);
  ctx.restore();
}

// --- HUD -----------------------------------------------------------------

function drawBar(ctx, x, y, width, height, fraction, fill, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = '#1a2742';
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 6, y + height - 4);
}

export function drawHud(ctx, state) {
  const player = state.player;
  const wave = state.wave;
  ctx.save();

  // Top-left: hull and wave progress.
  const hullFraction = player.hull / player.maxHull;
  const hullColor = hullFraction > 0.5 ? PALETTE.good : hullFraction > 0.25 ? PALETTE.accent : PALETTE.danger;
  drawBar(ctx, 18, 16, 220, 20, hullFraction, hullColor, `HULL ${Math.ceil(player.hull)} / ${player.maxHull}`);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  const quotaText = `WAVE ${wave.number}  ·  SALVAGE ${wave.collected} / ${wave.quota}`;
  ctx.fillText(quotaText, 18, 62);
  // Wave progress pips.
  const pips = Math.min(wave.quota, 12);
  for (let i = 0; i < pips; i++) {
    ctx.fillStyle = i < wave.collected ? PALETTE.accent : 'rgba(157,180,216,0.3)';
    ctx.beginPath();
    ctx.arc(24 + i * 18, 78, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top-right: score, credits, combo.
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`SCORE ${state.score.toLocaleString()}`, VIEW.width - 18, 34);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.accent;
  ctx.fillText(`◈ ${state.credits} credits`, VIEW.width - 18, 58);
  if (state.combo.count > 1) {
    ctx.fillStyle = '#ff9df5';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`COMBO ×${state.combo.count}`, VIEW.width - 18, 84);
  }

  // Bottom-left: controls reminder, quiet and small.
  ctx.textAlign = 'left';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = PALETTE.dim;
  ctx.fillText('WASD move · mouse aim · hold click / Space to fire · P pause · M mute', 18, VIEW.height - 16);

  // Low-hull warning.
  if (hullFraction <= 0.25 && state.phase === 'playing') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = Math.floor(performance.now() / 400) % 2 === 0 ? PALETTE.danger : '#ffb3b3';
    ctx.fillText('⚠ HULL CRITICAL ⚠', VIEW.width / 2, 96);
  }
  ctx.restore();
}

// --- Screens ---------------------------------------------------------------

function dimScreen(ctx, alpha = 0.55) {
  ctx.fillStyle = `rgba(4, 7, 18, ${alpha})`;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);
}

function centerText(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW.width / 2, y);
}

export function drawTitle(ctx, state, time) {
  dimScreen(ctx, 0.45);
  const bob = Math.sin(time * 1.4) * 6;
  centerText(ctx, 'STARLIGHT', 210 + bob, 'bold 84px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'SALVAGE', 290 + bob, 'bold 84px system-ui, sans-serif', PALETTE.accent);
  centerText(ctx, 'Pilot the skiff Kestrel through the debris field. Bank the scrap,', 350, '19px system-ui, sans-serif', PALETTE.dim);
  centerText(ctx, 'dodge the rocks, outgun the rogue drones — and spend your credits wisely.', 378, '19px system-ui, sans-serif', PALETTE.dim);

  panel(ctx, VIEW.width / 2 - 300, 420, 600, 148);
  centerText(ctx, 'WASD / ARROWS — fly', 458, '17px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'MOUSE — aim      CLICK / SPACE — fire', 488, '17px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Collect the wave quota of scrap to open the dock', 518, '17px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'P — pause      M — mute', 548, '17px system-ui, sans-serif', PALETTE.dim);

  const pulse = 0.65 + 0.35 * Math.sin(time * 3);
  ctx.globalAlpha = pulse;
  centerText(ctx, '▶  CLICK OR PRESS ENTER TO LAUNCH  ◀', 630, 'bold 24px system-ui, sans-serif', PALETTE.good);
  ctx.globalAlpha = 1;

  if (state.best > 0) {
    centerText(ctx, `Best salvage run: ${state.best.toLocaleString()} points`, 680, '16px system-ui, sans-serif', PALETTE.dim);
  }
  centerText(ctx, 'A complete game in one file of static code — no downloads, no sign-up.', 740, '14px system-ui, sans-serif', PALETTE.dim);
}

export function drawDock(ctx, state) {
  dimScreen(ctx, 0.6);
  centerText(ctx, `WAVE ${state.wave.number} CLEARED`, 130, 'bold 44px system-ui, sans-serif', PALETTE.good);
  centerText(ctx, `Wave bonus +${state.lastWaveBonus}  ·  ${state.credits} credits in the hold`, 178, '19px system-ui, sans-serif', PALETTE.accent);

  const rows = dockSummary(state.player);
  const panelX = VIEW.width / 2 - 340;
  const panelY = 210;
  const rowHeight = 74;
  panel(ctx, panelX, panelY, 680, rows.length * rowHeight + 30);

  rows.forEach((row, index) => {
    const y = panelY + 18 + index * rowHeight;
    const key = String(index + 1);
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`[${key}] ${row.name}`, panelX + 24, y + 22);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(row.blurb, panelX + 24, y + 46);
    // Level pips.
    for (let i = 0; i < row.maxLevel; i++) {
      ctx.fillStyle = i < row.level ? PALETTE.accent : 'rgba(157,180,216,0.3)';
      ctx.beginPath();
      ctx.arc(panelX + 430 + i * 20, y + 16, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.font = 'bold 18px system-ui, sans-serif';
    if (row.maxed) {
      ctx.fillStyle = PALETTE.good;
      ctx.fillText('MAXED', panelX + 656, y + 24);
    } else {
      ctx.fillStyle = state.credits >= row.cost ? PALETTE.accent : PALETTE.danger;
      ctx.fillText(`◈ ${row.cost}`, panelX + 656, y + 24);
    }
    if (index < rows.length - 1) {
      ctx.strokeStyle = 'rgba(157,180,216,0.15)';
      ctx.beginPath();
      ctx.moveTo(panelX + 20, y + 58);
      ctx.lineTo(panelX + 660, y + 58);
      ctx.stroke();
    }
  });

  centerText(ctx, 'Press 1–5 to buy, or ENTER to launch the next wave', 210 + rows.length * rowHeight + 62, 'bold 20px system-ui, sans-serif', PALETTE.text);
}

export function drawPause(ctx) {
  dimScreen(ctx, 0.6);
  centerText(ctx, 'PAUSED', 330, 'bold 56px system-ui, sans-serif', PALETTE.text);
  centerText(ctx, 'Press P or Esc to keep flying', 390, '19px system-ui, sans-serif', PALETTE.dim);
}

export function drawGameOver(ctx, state) {
  dimScreen(ctx, 0.65);
  centerText(ctx, 'THE KESTREL IS LOST', 240, 'bold 56px system-ui, sans-serif', PALETTE.danger);
  centerText(ctx, 'The debris field keeps its salvage — this time.', 292, '19px system-ui, sans-serif', PALETTE.dim);

  panel(ctx, VIEW.width / 2 - 260, 330, 520, 210);
  const rows = [
    ['Final score', state.score.toLocaleString()],
    ['Best score', state.best.toLocaleString()],
    ['Waves cleared', String(state.wavesCleared)],
    ['Scrap banked', String(state.totalScrap)],
    ['Drones downed', String(state.dronesDowned)],
    ['Asteroids shattered', String(state.asteroidsDowned)],
  ];
  rows.forEach(([label, value], i) => {
    const y = 372 + i * 30;
    ctx.textAlign = 'left';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(label, VIEW.width / 2 - 230, y);
    ctx.textAlign = 'right';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(value, VIEW.width / 2 + 230, y);
  });

  if (state.score >= state.best && state.score > 0) {
    centerText(ctx, '★ NEW BEST RUN ★', 590, 'bold 24px system-ui, sans-serif', PALETTE.accent);
  }
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 300);
  ctx.globalAlpha = pulse;
  centerText(ctx, 'Press R or click to fly again', 640, 'bold 22px system-ui, sans-serif', PALETTE.good);
  ctx.globalAlpha = 1;
}

export function render(ctx, state, camera, time) {
  drawBackground(ctx, camera, time);
  drawWorld(ctx, state, camera, time);
  if (state.phase === 'playing' || state.phase === 'paused' || state.phase === 'dock') {
    drawHud(ctx, state);
  }
  if (state.phase === 'title') drawTitle(ctx, state, time);
  else if (state.phase === 'dock') drawDock(ctx, state);
  else if (state.phase === 'paused') drawPause(ctx);
  else if (state.phase === 'over') drawGameOver(ctx, state);
}
