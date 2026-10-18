import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'royal_clockwork' | 'nuremberg_toy' | 'cyber_foundry';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  beltColor: string;
  beltTrim: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'royal_clockwork',
    name: 'Royal Brass Workshop',
    floorTop: '#1c130d',
    floorMid: '#2b1d14',
    floorBot: '#140d09',
    beltColor: '#17110d',
    beltTrim: '#d97706',
    accent: '#facc15',
  },
  {
    id: 'nuremberg_toy',
    name: 'Nuremberg Toy Guild',
    floorTop: '#1e1b4b',
    floorMid: '#312e81',
    floorBot: '#0f172a',
    beltColor: '#0f172a',
    beltTrim: '#f59e0b',
    accent: '#fbbf24',
  },
  {
    id: 'cyber_foundry',
    name: 'Aether Automaton Forge',
    floorTop: '#091526',
    floorMid: '#11223d',
    floorBot: '#050b14',
    beltColor: '#0f172a',
    beltTrim: '#38bdf8',
    accent: '#38bdf8',
  },
];

interface AutomatonUnit {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: 'soldier' | 'songbird' | 'royal_gold' | 'scrap_bomb';
  assembled: boolean;
  assembledBy: PlayerId | null;
  value: number;
  pulse: number;
}

interface Toymaker {
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
  hammerAnim: number;
  shieldTimer: number;
  stunTimer: number;
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

export class AutomatorAssemblyGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private toymakers: Map<PlayerId, Toymaker> = new Map();
  private units: AutomatonUnit[] = [];
  private shockwaves: Shockwave[] = [];
  private beltYs: number[] = [];
  private nextUnitId = 1;
  private spawnTimer = 0.7;
  private rollerPhase = 0;
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
    this.toymakers.clear();
    this.units = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 0.5;

    this.beltYs = [
      height * 0.30,
      height * 0.52,
      height * 0.74,
    ];

    const active = this.getActivePlayers();
    const spawns = [
      { x: width * 0.32, y: height * 0.41 },
      { x: width * 0.68, y: height * 0.41 },
      { x: width * 0.32, y: height * 0.63 },
      { x: width * 0.68, y: height * 0.63 },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.toymakers.set(p.id, {
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
        hammerAnim: 0,
        shieldTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: width * 0.5,
        botTargetY: height * 0.52,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnConveyorUnit(width, true);
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

  private spawnConveyorUnit(width: number, randomX = false): void {
    if (this.units.length >= 16) return;
    const beltIdx = Math.floor(Math.random() * this.beltYs.length);
    const dir = beltIdx === 1 ? 1 : -1;
    const speed = (125 + Math.random() * 45) * (this.suddenDeath ? 1.25 : 1.0);
    const roll = Math.random();
    const kind = roll < 0.18 ? 'scrap_bomb' : roll < 0.38 ? 'royal_gold' : roll < 0.68 ? 'songbird' : 'soldier';
    const value = kind === 'royal_gold' ? 95 : kind === 'songbird' ? 65 : kind === 'soldier' ? 50 : -25;
    const x = randomX ? 110 + Math.random() * (width - 220) : (dir > 0 ? 45 : width - 45);
    this.units.push({
      id: this.nextUnitId++,
      x,
      y: this.beltYs[beltIdx],
      vx: dir * speed,
      kind,
      assembled: false,
      assembledBy: null,
      value,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: TURBO CONVEYORS 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.toymakers.forEach(t => {
      if (t.score > maxScore) maxScore = t.score;
    });
    this.toymakers.forEach(t => {
      t.underdog = maxScore - t.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.rollerPhase += dt * (this.suddenDeath ? 10 : 6);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.55 : 0.85;
      this.spawnConveyorUnit(width, false);
    }

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.pulse += dt * 6;
      u.x += u.vx * dt;
      if (u.x < 30 || u.x > width - 30) {
        this.units.splice(i, 1);
      }
    }

    this.toymakers.forEach(t => {
      if (t.shieldTimer > 0) t.shieldTimer = Math.max(0, t.shieldTimer - dt);
      if (t.hammerAnim > 0) t.hammerAnim = Math.max(0, t.hammerAnim - dt * 5);
      if (t.comboTimer > 0) {
        t.comboTimer -= dt;
        if (t.comboTimer <= 0) t.combo = 1;
      }

      if (t.stunTimer > 0) {
        t.stunTimer -= dt;
        t.charging = false;
        t.charge = 0;
        t.vx *= 0.9;
        t.vy *= 0.9;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        this.clampToymaker(t, width, height);
        return;
      }

      const move = { x: this.input.getSteer(t.id), y: -this.input.getThrottle(t.id) };
      const speedMult = (t.underdog ? 1.24 : 1.0) * (t.shieldTimer > 0 ? 1.2 : 1.0) * (t.charging ? 0.72 : 1.0);
      const accel = 980 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        t.facingX = nx;
        t.facingY = ny;
        t.vx += nx * accel * dt;
        t.vy += ny * accel * dt;
      }

      // Subtle conveyor belt push if standing right on a belt
      for (let b = 0; b < this.beltYs.length; b++) {
        if (Math.abs(t.y - this.beltYs[b]) < 16) {
          t.vx += (b === 1 ? 1 : -1) * 140 * dt;
        }
      }

      t.vx *= 0.86;
      t.vy *= 0.86;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      this.clampToymaker(t, width, height);

      const pCfg = this.getPlayer(t.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05;

      // Tap: Hydraulic Stamp Hammer
      if (this.input.justAction(t.id) || (isBot && this.input.justPressed(t.id)) || (!hasSteer && !isBot && this.input.justPressed(t.id))) {
        t.hammerAnim = 1.0;
        this.stampNearestUnit(t);
      }

      // Hold-to-charge Master Windup Overdrive & Forge Shunt (72%–98% Sweet Spot)
      const holding = this.input.isActionPressed(t.id) || (isBot && this.input.isPressed(t.id));
      if (holding) {
        t.charging = true;
        t.charge += dt * 0.82;
        if (t.charge >= 1.0) {
          t.charging = false;
          t.charge = 0;
          t.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.particles.emit(t.x, t.y, 14, '#ef4444');
          this.addFloatingText(t.x, t.y - 28, '⚠️ SPRING SNAP!', '#ef4444', 15);
        }
      } else if (t.charging) {
        const pct = t.charge;
        t.charging = false;
        t.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerWindupOverdrive(t);
        } else if (pct >= 0.25) {
          t.vx += t.facingX * 240;
          t.vy += t.facingY * 240;
          this.audio.playWhoosh();
        }
      }
    });

    // Toymaker-to-Toymaker elastic collisions
    const list = Array.from(this.toymakers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const imp = 220;
          a.vx -= nx * imp;
          a.vy -= ny * imp;
          b.vx += nx * imp;
          b.vy += ny * imp;
          this.audio.playBounce();
        }
      }
    }

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

  private clampToymaker(t: Toymaker, width: number, height: number): void {
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (t.x < padX) { t.x = padX; t.vx = Math.abs(t.vx) * 0.5; }
    if (t.x > width - padX) { t.x = width - padX; t.vx = -Math.abs(t.vx) * 0.5; }
    if (t.y < minY) { t.y = minY; t.vy = Math.abs(t.vy) * 0.5; }
    if (t.y > maxY) { t.y = maxY; t.vy = -Math.abs(t.vy) * 0.5; }
  }

  private stampNearestUnit(t: Toymaker): void {
    let best: AutomatonUnit | null = null;
    let bestDist = 52;
    for (const u of this.units) {
      if (u.assembled) continue;
      const d = Math.hypot(u.x - t.x, u.y - t.y);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }

    if (!best) {
      this.audio.playTap();
      return;
    }

    if (best.kind === 'scrap_bomb') {
      if (t.shieldTimer > 0 || t.underdog) {
        best.assembled = true;
        t.score += 55;
        this.audio.playBoost();
        this.addFloatingText(best.x, best.y - 24, '🛡️ BOMB DEFUSED! +55', '#38bdf8', 16);
      } else {
        best.assembled = true;
        t.stunTimer = 0.85;
        t.combo = 1;
        t.score = Math.max(0, t.score - 25);
        this.audio.playExplosion();
        this.addScreenShake(7);
        this.particles.emit(best.x, best.y, 20, '#ef4444');
        this.addFloatingText(best.x, best.y - 24, '💥 SCRAP BOMB! -25', '#ef4444', 16);
      }
      return;
    }

    best.assembled = true;
    best.assembledBy = t.id;
    t.combo = Math.min(3, t.combo + 1);
    t.comboTimer = 4.2;
    const pts = Math.round(best.value * t.combo * (this.suddenDeath ? 2 : 1));
    t.score += pts;
    this.audio.playScore();
    const col = best.kind === 'royal_gold' ? '#facc15' : best.kind === 'songbird' ? '#38bdf8' : '#4ade80';
    const label = best.kind === 'royal_gold' ? `👑 ROYAL AUTOMATON! +${pts}` : best.kind === 'songbird' ? `🐦 SONGBIRD! +${pts}` : `🤖 STAMPED! +${pts} (${t.combo}x)`;
    this.particles.emit(best.x, best.y, 14, col);
    this.addFloatingText(best.x, best.y - 24, label, col, 16);
  }

  private triggerWindupOverdrive(t: Toymaker): void {
    t.shieldTimer = 1.4;
    t.hammerAnim = 1.0;
    t.vx += t.facingX * 350;
    t.vy += t.facingY * 350;
    const bonus = this.suddenDeath ? 160 : 85;
    t.score += bonus;
    this.audio.playBoost();
    this.addScreenShake(8);
    this.shockwaves.push({
      x: t.x,
      y: t.y,
      r: 20,
      maxR: 165,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(t.x, t.y, 24, '#facc15');
    this.addFloatingText(t.x, t.y - 34, `⚙️ MASTER WINDUP OVERDRIVE! +${bonus}`, '#facc15', 18);

    // Stamp all units in 165px radius safely
    for (const u of this.units) {
      if (!u.assembled && Math.hypot(u.x - t.x, u.y - t.y) < 165) {
        u.assembled = true;
        u.assembledBy = t.id;
        t.score += u.kind === 'scrap_bomb' ? 45 : u.value;
        this.particles.emit(u.x, u.y, 10, '#fde047');
      }
    }

    // Forge Shunt rivals
    this.toymakers.forEach(other => {
      if (other.id === t.id) return;
      const dx = other.x - t.x;
      const dy = other.y - t.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        t.score += 70;
        this.addFloatingText(other.x, other.y - 28, '🔨 FORGE SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.toymakers.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let bestUnit: AutomatonUnit | null = null;
      let bestScore = -999;
      for (const u of this.units) {
        if (u.assembled || u.kind === 'scrap_bomb') continue;
        const d = Math.hypot(u.x - bot.x, u.y - bot.y);
        const val = u.value * 1.3 - d * 0.28;
        if (val > bestScore) {
          bestScore = val;
          bestUnit = u;
        }
      }

      if (bestUnit) {
        bot.botTargetX = bestUnit.x + bestUnit.vx * 0.15;
        bot.botTargetY = bestUnit.y;
      } else {
        bot.botTargetX = width * 0.5;
        bot.botTargetY = height * 0.52;
      }

      if (!bot.charging && Math.random() < (difficulty === 'bot_hard' ? 0.28 : 0.14)) {
        bot.botHoldTarget = difficulty === 'bot_hard' ? 0.84 : 0.78;
      }
    }

    const dx = bot.botTargetX - bot.x;
    const dy = bot.botTargetY - bot.y;
    const dist = Math.hypot(dx, dy);
    const steerX = dist > 8 ? dx / dist : 0;
    const throttleY = dist > 8 ? -dy / dist : 0;
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
      for (const u of this.units) {
        if (!u.assembled && u.kind !== 'scrap_bomb' && Math.hypot(u.x - bot.x, u.y - bot.y) < 44) {
          this.input.triggerBotPress(botId);
          break;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.floorTop);
    bg.addColorStop(0.55, theme.floorMid);
    bg.addColorStop(1, theme.floorBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Render 3 Shared 2.5D Brass Conveyor Belts
    for (let b = 0; b < this.beltYs.length; b++) {
      const by = this.beltYs[b];
      ctx.save();
      ctx.fillStyle = theme.beltColor;
      ctx.strokeStyle = theme.beltTrim;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(36, by - 16, width - 72, 32, 8);
      ctx.fill();
      ctx.stroke();

      // Moving brass rollers
      const dir = b === 1 ? 1 : -1;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.25)';
      ctx.lineWidth = 2;
      const offset = ((this.rollerPhase * dir * 24) % 36 + 36) % 36;
      for (let rx = 48 + offset; rx < width - 48; rx += 36) {
        ctx.beginPath();
        ctx.moveTo(rx, by - 13);
        ctx.lineTo(rx, by + 13);
        ctx.stroke();
      }
      ctx.restore();
    }

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

    // Render Automaton Units on Conveyors
    for (const u of this.units) {
      ctx.save();
      ctx.translate(u.x, u.y);

      if (u.kind === 'scrap_bomb') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, -4, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        const bodyCol = u.assembled
          ? '#4ade80'
          : u.kind === 'royal_gold'
            ? '#facc15'
            : u.kind === 'songbird'
              ? '#38bdf8'
              : '#94a3b8';

        ctx.fillStyle = bodyCol;
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = u.assembled ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(-12, -18, 24, 24, 5);
        ctx.fill();
        ctx.stroke();

        // Windup key on assembled automaton
        if (u.assembled) {
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(0, -24, 5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Render Toymakers
    const sorted = Array.from(this.toymakers.values()).sort((a, b) => a.y - b.y);
    for (const t of sorted) {
      const cfg = this.players.find(p => p.id === t.id);
      const color = cfg?.color || '#38bdf8';

      ctx.save();
      ctx.translate(t.x, t.y);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (t.charging) {
        const sweet = t.charge >= 0.72 && t.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + t.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (t.shieldTimer > 0 || t.underdog) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 23, 0, Math.PI * 2);
        ctx.stroke();
      }

      const mood = t.stunTimer > 0 ? 'shocked' : t.charging ? 'focused' : t.combo >= 2 ? 'triumph' : 'idle';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood === 'focused' ? 'focused' : mood === 'shocked' ? 'shocked' : 'happy', 45 - this.roundTimer, 0);

      // Brass Hydraulic Stamp Mallet
      ctx.save();
      ctx.rotate(Math.atan2(t.facingY, t.facingX) + Math.sin(t.hammerAnim * Math.PI) * 1.2);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(10, -4, 15, 8);
      ctx.restore();

      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // Top Header Banner (Respecting top-center timer safe zone y: 12-44)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: RUN FACTORY FLOOR • TAP: STAMP AUTOMATONS • HOLD (72-98%): WINDUP OVERDRIVE SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const t = this.toymakers.get(p.id);
      if (!t) return;
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
      ctx.fillText(`${t.score} PTS`, cardX + 10, cardY + 38);
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
    this.toymakers.forEach((t, id) => scores.set(id, t.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.toymakers.forEach(t => {
      if (t.score > bestScore) {
        bestScore = t.score;
        bestId = t.id;
        tie = false;
      } else if (t.score === bestScore) {
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
