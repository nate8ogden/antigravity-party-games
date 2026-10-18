import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'ironworks_foundry' | 'brass_locomotive' | 'aether_reactor';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  gridColor: string;
  pipeColor: string;
  boilerHull: string;
  boilerTrim: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'ironworks_foundry',
    name: 'Royal Ironworks Foundry',
    floorTop: '#14110f',
    floorMid: '#241b15',
    floorBot: '#120e0b',
    gridColor: 'rgba(245, 158, 11, 0.12)',
    pipeColor: '#78350f',
    boilerHull: '#292524',
    boilerTrim: '#d97706',
    accent: '#f59e0b',
  },
  {
    id: 'brass_locomotive',
    name: 'Orient Express Engine Room',
    floorTop: '#0f172a',
    floorMid: '#1e293b',
    floorBot: '#090d16',
    gridColor: 'rgba(250, 204, 21, 0.12)',
    pipeColor: '#92400e',
    boilerHull: '#1e293b',
    boilerTrim: '#eab308',
    accent: '#facc15',
  },
  {
    id: 'aether_reactor',
    name: 'Victorian Aether Core',
    floorTop: '#160f29',
    floorMid: '#261844',
    floorBot: '#0d0818',
    gridColor: 'rgba(56, 189, 248, 0.14)',
    pipeColor: '#4c1d95',
    boilerHull: '#1e1b4b',
    boilerTrim: '#38bdf8',
    accent: '#38bdf8',
  },
];

interface SteamBoiler {
  id: number;
  x: number;
  y: number;
  radius: number;
  pressure: number; // 0..100
  heatRate: number;
  blowoutTimer: number;
  ventFlash: number;
  whistlePhase: number;
}

interface BoilerPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'coal' | 'steam_core' | 'golden_valve';
  value: number;
  life: number;
  pulse: number;
}

interface Engineer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  score: number;
  combo: number;
  comboTimer: number;
  charging: boolean;
  charge: number;
  shieldTimer: number;
  stunTimer: number;
  wrenchSwing: number;
  underdog: boolean;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

interface Shockwave {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
  color: string;
}

export class SteamBoilerReliefGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private engineers: Map<PlayerId, Engineer> = new Map();
  private boilers: SteamBoiler[] = [];
  private pickups: BoilerPickup[] = [];
  private shockwaves: Shockwave[] = [];
  private nextPickupId = 1;
  private pickupSpawnTimer = 1.6;
  private themeIndex = 0;
  private suddenDeath = false;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIndex = (this.themeIndex + 1) % THEMES.length;
          this.audio.playTap();
        } else if (e.key === '1') {
          this.themeIndex = 0;
          this.audio.playTap();
        } else if (e.key === '2') {
          this.themeIndex = 1;
          this.audio.playTap();
        } else if (e.key === '3') {
          this.themeIndex = 2;
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.suddenDeath = false;
    this.engineers.clear();
    this.boilers = [];
    this.pickups = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.pickupSpawnTimer = 1.4;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const rx = Math.min(width * 0.28, 220);
    const ry = Math.min(height * 0.22, 125);

    const coords = [
      { x: cx, y: cy, heat: 21 },
      { x: cx - rx, y: cy - ry * 0.72, heat: 18 },
      { x: cx + rx, y: cy - ry * 0.72, heat: 19 },
      { x: cx - rx, y: cy + ry * 0.82, heat: 20 },
      { x: cx + rx, y: cy + ry * 0.82, heat: 18.5 },
    ];

    coords.forEach((c, idx) => {
      this.boilers.push({
        id: idx + 1,
        x: c.x,
        y: c.y,
        radius: idx === 0 ? 42 : 36,
        pressure: 45 + (idx * 11) % 35,
        heatRate: c.heat,
        blowoutTimer: 0,
        ventFlash: 0,
        whistlePhase: idx * 1.1,
      });
    });

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: cx - rx * 0.55, y: cy + 10 },
      { x: cx + rx * 0.55, y: cy + 10 },
      { x: cx - rx * 0.55, y: cy + ry * 0.45 },
      { x: cx + rx * 0.55, y: cy + ry * 0.45 },
    ];

    active.forEach((p, idx) => {
      const sp = spawnOffsets[idx % spawnOffsets.length];
      this.engineers.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        facingX: idx % 2 === 0 ? 1 : -1,
        facingY: 0,
        score: 0,
        combo: 1,
        comboTimer: 0,
        charging: false,
        charge: 0,
        shieldTimer: 0,
        stunTimer: 0,
        wrenchSwing: 0,
        underdog: false,
        botTimer: 0.18 + Math.random() * 0.15,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnPickup(width, height);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnPickup(width: number, height: number, x?: number, y?: number, forcedKind?: 'coal' | 'steam_core' | 'golden_valve'): void {
    if (this.pickups.length >= 12) return;
    const roll = Math.random();
    const kind = forcedKind ?? (roll < 0.2 ? 'golden_valve' : roll < 0.58 ? 'steam_core' : 'coal');
    const px = x ?? (120 + Math.random() * (width - 240));
    const py = y ?? (125 + Math.random() * (height - 220));
    const value = kind === 'golden_valve' ? 90 : kind === 'steam_core' ? 50 : 35;
    this.pickups.push({
      id: this.nextPickupId++,
      x: px,
      y: py,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      kind,
      value,
      life: 14,
      pulse: Math.random() * Math.PI * 2,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    if (!this.suddenDeath && this.roundTimer <= 15.0) {
      this.suddenDeath = true;
      this.audio.playFanfare();
      this.addScreenShake(8);
      this.addFloatingText(width * 0.5, 112, '⚡ SUDDEN DEATH: OVERDRIVE FURNACE 2X! ⚡', '#facc15', 20);
    }

    // Update underdog status
    let maxScore = 0;
    this.engineers.forEach(e => {
      if (e.score > maxScore) maxScore = e.score;
    });
    this.engineers.forEach(e => {
      e.underdog = maxScore - e.score >= 150;
    });

    this.updateBots(dt, width, height);

    // Update boilers
    const heatMult = this.suddenDeath ? 1.45 : 1.0;
    for (const b of this.boilers) {
      b.whistlePhase += dt * (b.pressure >= 75 ? 12 : 4);
      if (b.ventFlash > 0) b.ventFlash = Math.max(0, b.ventFlash - dt * 2.5);

      if (b.blowoutTimer > 0) {
        b.blowoutTimer -= dt;
        b.pressure = Math.max(25, b.pressure - dt * 38);
        if (Math.random() < 0.35) {
          this.particles.emit(b.x + (Math.random() - 0.5) * 30, b.y - 24, 2, '#64748b');
        }
        continue;
      }

      b.pressure += b.heatRate * heatMult * dt;
      if (b.pressure >= 75 && b.pressure <= 95 && Math.random() < 0.25) {
        this.particles.emit(b.x, b.y - b.radius - 8, 1, '#fde047');
      }

      if (b.pressure >= 100) {
        b.pressure = 100;
        b.blowoutTimer = 2.0;
        this.audio.playExplosion();
        this.addScreenShake(11);
        this.shockwaves.push({
          x: b.x,
          y: b.y,
          r: b.radius,
          maxR: 125,
          alpha: 1,
          color: '#ef4444',
        });
        this.particles.emit(b.x, b.y, 28, '#f97316');
        this.addFloatingText(b.x, b.y - 36, '💥 BOILER BLOWOUT!', '#ef4444', 17);

        // Spawn 2 loose coal chunks from the blowout
        this.spawnPickup(width, height, b.x - 28, b.y + 18, 'coal');
        this.spawnPickup(width, height, b.x + 28, b.y + 18, 'coal');

        // Knockback & scald nearby unprotected engineers
        this.engineers.forEach(eng => {
          const dx = eng.x - b.x;
          const dy = eng.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 125) {
            const nx = dist > 0.01 ? dx / dist : 1;
            const ny = dist > 0.01 ? dy / dist : 0;
            eng.vx += nx * 360;
            eng.vy += ny * 360;
            if (eng.shieldTimer <= 0 && !eng.underdog) {
              eng.stunTimer = 0.95;
              eng.combo = 1;
              eng.score = Math.max(0, eng.score - 30);
              this.addFloatingText(eng.x, eng.y - 26, '🔥 SCALDED! -30', '#ef4444', 15);
            } else {
              this.addFloatingText(eng.x, eng.y - 26, '🛡️ BLAST SHIELDED!', '#38bdf8', 15);
            }
          }
        });
      }
    }

    // Spawn pickups periodically
    this.pickupSpawnTimer -= dt;
    if (this.pickupSpawnTimer <= 0) {
      this.pickupSpawnTimer = this.suddenDeath ? 1.2 : 1.9;
      this.spawnPickup(width, height);
    }

    // Update pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.pulse += dt * 5;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      if (p.life <= 0) {
        this.pickups.splice(i, 1);
      }
    }

    // Update engineers
    this.engineers.forEach(eng => {
      if (eng.shieldTimer > 0) eng.shieldTimer = Math.max(0, eng.shieldTimer - dt);
      if (eng.wrenchSwing > 0) eng.wrenchSwing = Math.max(0, eng.wrenchSwing - dt * 4);
      if (eng.comboTimer > 0) {
        eng.comboTimer -= dt;
        if (eng.comboTimer <= 0) eng.combo = 1;
      }

      if (eng.stunTimer > 0) {
        eng.stunTimer -= dt;
        eng.charging = false;
        eng.charge = 0;
        eng.vx *= 0.9;
        eng.vy *= 0.9;
        eng.x += eng.vx * dt;
        eng.y += eng.vy * dt;
        this.clampEngineer(eng, width, height);
        return;
      }

      const move = { x: this.input.getSteer(eng.id), y: -this.input.getThrottle(eng.id) };
      const speedMult = (eng.underdog ? 1.22 : 1.0) * (eng.charging ? 0.72 : 1.0) * (eng.shieldTimer > 0 ? 1.18 : 1.0);
      const accel = 980 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        eng.facingX = nx;
        eng.facingY = ny;
        eng.vx += nx * accel * dt;
        eng.vy += ny * accel * dt;
      }

      eng.vx *= 0.86;
      eng.vy *= 0.86;
      eng.x += eng.vx * dt;
      eng.y += eng.vy * dt;

      // Keep outside solid boiler cores while allowing close proximity interaction
      for (const b of this.boilers) {
        const dx = eng.x - b.x;
        const dy = eng.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b.radius + 18;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          eng.x = b.x + nx * minDist;
          eng.y = b.y + ny * minDist;
        }
      }

      this.clampEngineer(eng, width, height);

      const pCfg = this.getPlayer(eng.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      // Tap interaction: Wrench Vent or Coal Stoke
      if (this.input.justAction(eng.id) || (isBot && this.input.justPressed(eng.id))) {
        eng.wrenchSwing = 1.0;
        this.interactWithNearestBoiler(eng, width, height);
      }

      // Hold-to-charge Super-Steam Whistle Blast & Boiler Shunt (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(eng.id) || (isBot && this.input.isPressed(eng.id));
      if (holding) {
        eng.charging = true;
        eng.charge += dt * 0.82;
        if (eng.charge >= 1.0) {
          // Overcharge blowback
          eng.charging = false;
          eng.charge = 0;
          eng.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.particles.emit(eng.x, eng.y, 14, '#ef4444');
          this.addFloatingText(eng.x, eng.y - 28, '⚠️ VALVE OVERCHARGE!', '#ef4444', 15);
        }
      } else if (eng.charging) {
        const pct = eng.charge;
        eng.charging = false;
        eng.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerSweetSpotBlast(eng, width, height);
        } else if (pct >= 0.28) {
          // Light steam hop
          eng.vx += eng.facingX * 240;
          eng.vy += eng.facingY * 240;
          this.audio.playWhoosh();
        }
      }

      // Collect pickups
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (Math.hypot(p.x - eng.x, p.y - eng.y) < 30) {
          const pts = Math.round(p.value * (this.suddenDeath ? 2 : 1));
          eng.score += pts;
          this.audio.playScore();
          const col = p.kind === 'golden_valve' ? '#facc15' : p.kind === 'steam_core' ? '#38bdf8' : '#fb923c';
          const label = p.kind === 'golden_valve' ? `👑 GOLDEN VALVE! +${pts}` : p.kind === 'steam_core' ? `💨 STEAM CORE! +${pts}` : `🔥 COAL! +${pts}`;
          this.particles.emit(p.x, p.y, 12, col);
          this.addFloatingText(p.x, p.y - 20, label, col, 16);
          this.pickups.splice(i, 1);
        }
      }
    });

    // Engineer-to-engineer elastic collisions
    const list = Array.from(this.engineers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 36;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          const impulse = 210;
          a.vx -= nx * impulse;
          a.vy -= ny * impulse;
          b.vx += nx * impulse;
          b.vy += ny * impulse;
          this.audio.playBounce();
          this.particles.emit((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, 8, '#facc15');
        }
      }
    }

    // Update shockwaves & floating texts
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.r += (s.maxR - s.r) * dt * 7;
      s.alpha -= dt * 1.9;
      if (s.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.alpha -= dt * 0.95;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private clampEngineer(eng: Engineer, width: number, height: number): void {
    const padX = 56;
    const minY = 98;
    const maxY = height - 64;
    if (eng.x < padX) { eng.x = padX; eng.vx = Math.abs(eng.vx) * 0.5; }
    if (eng.x > width - padX) { eng.x = width - padX; eng.vx = -Math.abs(eng.vx) * 0.5; }
    if (eng.y < minY) { eng.y = minY; eng.vy = Math.abs(eng.vy) * 0.5; }
    if (eng.y > maxY) { eng.y = maxY; eng.vy = -Math.abs(eng.vy) * 0.5; }
  }

  private interactWithNearestBoiler(eng: Engineer, width: number, height: number): void {
    let nearest: SteamBoiler | null = null;
    let bestDist = 84;
    for (const b of this.boilers) {
      const d = Math.hypot(b.x - eng.x, b.y - eng.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = b;
      }
    }
    if (!nearest || nearest.blowoutTimer > 0) return;

    if (nearest.pressure >= 75 && nearest.pressure <= 96) {
      // Gold Sweet-Spot Superheated Vent!
      eng.combo = Math.min(3, eng.combo + 1);
      eng.comboTimer = 4.5;
      const pts = Math.round(65 * eng.combo * (this.suddenDeath ? 2 : 1));
      eng.score += pts;
      nearest.pressure = 38;
      nearest.ventFlash = 1.0;
      this.audio.playScore();
      this.addScreenShake(5);
      this.shockwaves.push({
        x: nearest.x,
        y: nearest.y,
        r: nearest.radius,
        maxR: 95,
        alpha: 0.9,
        color: '#facc15',
      });
      this.particles.emit(nearest.x, nearest.y - nearest.radius, 18, '#fef08a');
      this.addFloatingText(nearest.x, nearest.y - 36, `⚙️ SUPERHEATED VENT! +${pts} (${eng.combo}x)`, '#facc15', 17);
      this.spawnPickup(width, height, nearest.x + (Math.random() - 0.5) * 50, nearest.y + 38, 'steam_core');
    } else if (nearest.pressure < 75) {
      // Stoke furnace with coal to push toward Gold Zone (or sabotage rival!)
      nearest.pressure = Math.min(98, nearest.pressure + 18);
      const pts = this.suddenDeath ? 50 : 25;
      eng.score += pts;
      this.audio.playTap();
      this.particles.emit(nearest.x, nearest.y + 12, 10, '#fb923c');
      this.addFloatingText(nearest.x, nearest.y - 28, `🔥 STOKE FURNACE! +${pts}`, '#fb923c', 15);
    } else {
      // Emergency relief at 96..99 PSI!
      const pts = Math.round(90 * (this.suddenDeath ? 2 : 1));
      eng.score += pts;
      nearest.pressure = 42;
      nearest.ventFlash = 1.0;
      this.audio.playBoost();
      this.particles.emit(nearest.x, nearest.y - nearest.radius, 22, '#38bdf8');
      this.addFloatingText(nearest.x, nearest.y - 38, `🚨 CLUTCH RELIEF SAVE! +${pts}`, '#38bdf8', 18);
    }
  }

  private triggerSweetSpotBlast(eng: Engineer, width: number, height: number): void {
    eng.shieldTimer = 1.35;
    eng.vx += eng.facingX * 360;
    eng.vy += eng.facingY * 360;
    const basePts = this.suddenDeath ? 160 : 85;
    eng.score += basePts;
    this.audio.playBoost();
    this.addScreenShake(8);
    this.shockwaves.push({
      x: eng.x,
      y: eng.y,
      r: 20,
      maxR: 155,
      alpha: 1,
      color: '#38bdf8',
    });
    this.particles.emit(eng.x, eng.y, 24, '#38bdf8');
    this.addFloatingText(eng.x, eng.y - 34, `🚂 WHISTLE OVERDRIVE! +${basePts}`, '#facc15', 18);

    // Automatically vent any Gold-Zone boiler in 155px radius
    for (const b of this.boilers) {
      if (b.blowoutTimer <= 0 && Math.hypot(b.x - eng.x, b.y - eng.y) < 155 && b.pressure >= 70) {
        b.pressure = 35;
        b.ventFlash = 1.0;
        eng.score += 55;
        this.spawnPickup(width, height, b.x, b.y + 34, 'steam_core');
      }
    }

    // Shunt rival engineers within 145px
    this.engineers.forEach(other => {
      if (other.id === eng.id) return;
      const dx = other.x - eng.x;
      const dy = other.y - eng.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 145) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        eng.score += 70;
        this.addFloatingText(other.x, other.y - 28, '💥 BOILER SHUNT! +70', '#38bdf8', 17);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.engineers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.36;

      // Priority 1: Gold-zone boiler
      let bestBoiler: SteamBoiler | null = null;
      let bestScore = -999;
      for (const b of this.boilers) {
        if (b.blowoutTimer > 0) continue;
        const d = Math.hypot(b.x - bot.x, b.y - bot.y);
        let val = -d * 0.2;
        if (b.pressure >= 75 && b.pressure <= 95) val += 140;
        else if (b.pressure >= 96) val -= 200; // flee imminent explosion
        else val += b.pressure * 0.7;
        if (val > bestScore) {
          bestScore = val;
          bestBoiler = b;
        }
      }

      if (bestBoiler) {
        const angle = Math.atan2(bot.y - bestBoiler.y, bot.x - bestBoiler.x);
        bot.botTargetX = bestBoiler.x + Math.cos(angle) * (bestBoiler.radius + 26);
        bot.botTargetY = bestBoiler.y + Math.sin(angle) * (bestBoiler.radius + 26);
      } else if (this.pickups.length > 0) {
        bot.botTargetX = this.pickups[0].x;
        bot.botTargetY = this.pickups[0].y;
      } else {
        bot.botTargetX = width * 0.5;
        bot.botTargetY = height * 0.54;
      }

      if (!bot.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        bot.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = bot.botTargetX - bot.x;
    const dy = bot.botTargetY - bot.y;
    const dist = Math.hypot(dx, dy);
    const moveScale = dist > 14 ? 1 : 0;
    const steerX = dist > 1 ? (dx / dist) * moveScale : 0;
    const throttleY = dist > 1 ? -(dy / dist) * moveScale : 0;
    const actor: any = (this as any).engineers?.get(botId) || (this as any).zeppelins?.get(botId) || (this as any).harvesters?.get(botId) || (this as any).toymakers?.get(botId) || (this as any).dispatchers?.get(botId) || (this as any).flyers?.get(botId);
    if (actor) {
      actor.vx += steerX * 620 * dt;
      actor.vy += -throttleY * 620 * dt;
      if (typeof actor.angle === 'number' && (Math.abs(steerX) > 0.01 || Math.abs(throttleY) > 0.01)) actor.angle = Math.atan2(-throttleY, steerX);
    }

    if (bot.botHoldTarget > 0) {
      if (bot.charge < bot.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        bot.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      // Tap when close to a boiler
      for (const b of this.boilers) {
        if (b.blowoutTimer <= 0 && Math.hypot(b.x - bot.x, b.y - bot.y) < b.radius + 42) {
          if ((b.pressure >= 75 && b.pressure <= 96) || (b.pressure < 70 && Math.random() < 0.25)) {
            this.input.triggerBotPress(botId);
            break;
          }
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    // 2.5D Industrial Foundry Floor
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.floorTop);
    bg.addColorStop(0.55, theme.floorMid);
    bg.addColorStop(1, theme.floorBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Copper steam pipe grid
    ctx.save();
    ctx.strokeStyle = theme.gridColor;
    ctx.lineWidth = 1;
    for (let x = 60; x < width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 85);
      ctx.lineTo(x, height - 40);
      ctx.stroke();
    }
    for (let y = 100; y < height - 40; y += 56) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 40, y);
      ctx.stroke();
    }

    // Interconnecting overhead brass steam pipes between boilers
    if (this.boilers.length >= 5) {
      ctx.strokeStyle = theme.pipeColor;
      ctx.lineWidth = 10;
      for (let i = 1; i < this.boilers.length; i++) {
        ctx.beginPath();
        ctx.moveTo(this.boilers[0].x, this.boilers[0].y);
        ctx.lineTo(this.boilers[i].x, this.boilers[i].y);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Shockwaves
    for (const s of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.alpha);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Pickups
    for (const p of this.pickups) {
      const bob = Math.sin(p.pulse) * 3;
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 10, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      if (p.kind === 'golden_valve') {
        ctx.fillStyle = '#facc15';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (p.kind === 'steam_core') {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.roundRect(-9, -8, 18, 16, 4);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render 5 2.5D Steam Boilers
    for (const b of this.boilers) {
      const isGold = b.pressure >= 75 && b.pressure <= 95 && b.blowoutTimer <= 0;
      const isDanger = b.pressure > 95 && b.blowoutTimer <= 0;

      ctx.save();
      ctx.translate(b.x, b.y);

      // Floor shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, b.radius * 0.72, b.radius * 1.12, b.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gold or Danger Outer Aura Ring
      if (isGold || isDanger) {
        ctx.strokeStyle = isGold ? 'rgba(250, 204, 21, 0.65)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, b.radius + 9 + Math.sin(b.whistlePhase) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2.5D Boiler Cylindrical Tank
      ctx.fillStyle = b.blowoutTimer > 0 ? '#451a1a' : theme.boilerHull;
      ctx.strokeStyle = isGold ? '#facc15' : isDanger ? '#ef4444' : theme.boilerTrim;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Brass whistle stack on top
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-7, -b.radius - 12, 14, 14);

      // Analog PSI Gauge Dial
      ctx.fillStyle = '#fefce8';
      ctx.beginPath();
      ctx.arc(0, -3, b.radius * 0.56, 0, Math.PI * 2);
      ctx.fill();

      const startA = Math.PI * 0.75;
      const totalA = Math.PI * 1.5;
      const needleA = startA + (Math.min(100, b.pressure) / 100) * totalA;
      ctx.strokeStyle = isDanger ? '#dc2626' : isGold ? '#ca8a04' : '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(Math.cos(needleA) * (b.radius * 0.44), -3 + Math.sin(needleA) * (b.radius * 0.44));
      ctx.stroke();

      // PSI Readout
      ctx.fillStyle = isGold ? '#fef08a' : isDanger ? '#fca5a5' : '#e2e8f0';
      ctx.font = '900 11px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        b.blowoutTimer > 0 ? 'BLOWN!' : `${Math.round(b.pressure)} PSI`,
        0,
        b.radius + 15
      );
      ctx.restore();
    }

    // Render Engineers
    const sorted = Array.from(this.engineers.values()).sort((a, b) => a.y - b.y);
    for (const eng of sorted) {
      const cfg = this.players.find(p => p.id === eng.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(eng.x, eng.y);

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Charge ring (72%–98% Sweet Spot)
      if (eng.charging) {
        const sweet = eng.charge >= 0.72 && eng.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + eng.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (eng.shieldTimer > 0 || eng.underdog) {
        ctx.strokeStyle = eng.underdog ? '#facc15' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Character sprite
      const mood = eng.stunTimer > 0 ? 'shocked' : eng.charging ? 'focused' : eng.combo >= 2 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood === 'focused' ? 'focused' : mood === 'shocked' ? 'shocked' : 'happy', 45 - this.roundTimer, 0);

      // Brass Wrench
      ctx.save();
      ctx.rotate(Math.atan2(eng.facingY, eng.facingX) + Math.sin(eng.wrenchSwing * Math.PI) * 1.1);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(10, -3, 14, 5);
      ctx.restore();

      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // Top Header Banner (Respecting top-center timer safe zone y: 12-44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 265, 54, 530, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: RUN FOUNDRY • TAP: VENT GOLD BOILERS (75-95 PSI) / STOKE • HOLD (72-98%): WHISTLE SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards (safe y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const eng = this.engineers.get(p.id);
      if (!eng) return;
      const isLeft = idx % 2 === 0;
      const cardX = isLeft ? 18 : width - 148;
      const cardY = height - 128 - Math.floor(idx / 2) * 56;

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = p.color;
      ctx.font = '800 12px "Outfit", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 15px "Outfit", sans-serif';
      ctx.fillText(`${eng.score} PTS`, cardX + 10, cardY + 38);
      ctx.restore();
    });

    // Bottom-Left Theme Pill
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 11px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎨 ${theme.name} [T]`, 105, height - 28);
    ctx.restore();
  }

  
  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getScores();
    const rankings = Array.from(scores.entries())
      .map(([playerId, score]) => ({ playerId, score: Math.floor(score), place: 1 }))
      .sort((a, b) => b.score - a.score);
    rankings.forEach((r, idx) => { r.place = idx + 1; });
    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} dominated the arena!` : "Photo finish!",
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.engineers.forEach((e, id) => scores.set(id, e.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.engineers.forEach(e => {
      if (e.score > bestScore) {
        bestScore = e.score;
        bestId = e.id;
        tie = false;
      } else if (e.score === bestScore) {
        tie = true;
      }
    });
    return tie ? null : bestId;
  }

  public cleanup(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  private addScreenShake(amt: number): void {
    void amt;
  }

}
