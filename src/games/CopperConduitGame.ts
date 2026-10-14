import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'copper_foundry' | 'dwarven_forge' | 'plasma_refinery';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  pipeCopper: string;
  moltenGlow: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'copper_foundry',
    name: 'Royal Copper Foundry',
    floorTop: '#1c100c',
    floorMid: '#291812',
    floorBot: '#120a07',
    pipeCopper: '#b45309',
    moltenGlow: '#f97316',
    accent: '#fb923c',
  },
  {
    id: 'dwarven_forge',
    name: 'Obsidian Gold Smelter',
    floorTop: '#171717',
    floorMid: '#262626',
    floorBot: '#0a0a0a',
    pipeCopper: '#eab308',
    moltenGlow: '#facc15',
    accent: '#facc15',
  },
  {
    id: 'plasma_refinery',
    name: 'Aether Alloy Crucible',
    floorTop: '#0f172a',
    floorMid: '#1e1b4b',
    floorBot: '#090d16',
    pipeCopper: '#38bdf8',
    moltenGlow: '#38bdf8',
    accent: '#38bdf8',
  },
];

interface SmeltCrucible {
  id: number;
  x: number;
  y: number;
  heat: number; // 0..100
  valveAligned: boolean;
}

interface FoundryIngot {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'copper' | 'royal_gold' | 'slag_puddle';
  value: number;
  pulse: number;
}

interface FoundrySmith {
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

export class CopperConduitGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private smiths: Map<PlayerId, FoundrySmith> = new Map();
  private crucibles: SmeltCrucible[] = [];
  private ingots: FoundryIngot[] = [];
  private shockwaves: Shockwave[] = [];
  private nextIngotId = 1;
  private spawnTimer = 1.3;
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
    this.smiths.clear();
    this.crucibles = [];
    this.ingots = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 1.1;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const rx = Math.min(width * 0.28, 220);
    const ry = Math.min(height * 0.22, 120);

    const coords = [
      { x: cx, y: cy },
      { x: cx - rx, y: cy - ry * 0.72 },
      { x: cx + rx, y: cy - ry * 0.72 },
      { x: cx - rx, y: cy + ry * 0.82 },
      { x: cx + rx, y: cy + ry * 0.82 },
    ];

    coords.forEach((c, idx) => {
      this.crucibles.push({
        id: idx + 1,
        x: c.x,
        y: c.y,
        heat: 50 + idx * 10,
        valveAligned: idx % 2 === 0,
      });
    });

    const active = this.getActivePlayers();
    const spawns = [
      { x: cx - rx * 0.52, y: cy + 8 },
      { x: cx + rx * 0.52, y: cy + 8 },
      { x: cx - rx * 0.52, y: cy + ry * 0.48 },
      { x: cx + rx * 0.52, y: cy + ry * 0.48 },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.smiths.set(p.id, {
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
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 5; i++) {
      this.spawnIngot(width, height);
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    void width;
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playTap();
      return true;
    }
    return false;
  }

  private spawnIngot(width: number, height: number, x?: number, y?: number, forcedKind?: 'copper' | 'royal_gold' | 'slag_puddle'): void {
    if (this.ingots.length >= 15) return;
    const roll = Math.random();
    const kind = forcedKind ?? (roll < 0.2 ? 'slag_puddle' : roll < 0.42 ? 'royal_gold' : 'copper');
    this.ingots.push({
      id: this.nextIngotId++,
      x: x ?? (105 + Math.random() * (width - 210)),
      y: y ?? (115 + Math.random() * (height - 195)),
      vx: (Math.random() - 0.5) * 55,
      vy: (Math.random() - 0.5) * 55,
      kind,
      value: kind === 'royal_gold' ? 95 : kind === 'copper' ? 50 : -25,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: MOLTEN GOLD POUR 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.smiths.forEach(s => {
      if (s.score > maxScore) maxScore = s.score;
    });
    this.smiths.forEach(s => {
      s.underdog = maxScore - s.score >= 150;
    });

    this.updateBots(dt, width, height);

    for (const c of this.crucibles) {
      c.heat += (this.suddenDeath ? 32 : 22) * dt;
      if (c.heat >= 100) {
        c.heat = 25;
        if (c.valveAligned) {
          this.spawnIngot(width, height, c.x + (Math.random() - 0.5) * 45, c.y + 38, Math.random() < 0.35 ? 'royal_gold' : 'copper');
        } else {
          this.spawnIngot(width, height, c.x + (Math.random() - 0.5) * 45, c.y + 38, 'slag_puddle');
        }
        c.valveAligned = Math.random() < 0.5;
      }
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 1.0 : 1.55;
      this.spawnIngot(width, height);
    }

    for (const ing of this.ingots) {
      ing.pulse += dt * 5;
      ing.x += ing.vx * dt;
      ing.y += ing.vy * dt;
      ing.vx *= 0.9;
      ing.vy *= 0.9;
    }

    this.smiths.forEach(s => {
      if (s.shieldTimer > 0) s.shieldTimer = Math.max(0, s.shieldTimer - dt);
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 1;
      }

      if (s.stunTimer > 0) {
        s.stunTimer -= dt;
        s.charging = false;
        s.charge = 0;
        s.vx *= 0.9;
        s.vy *= 0.9;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        this.clampSmith(s, width, height);
        return;
      }

      const move = { x: this.input.getSteer(s.id), y: -this.input.getThrottle(s.id) };
      const speedMult = (s.underdog ? 1.24 : 1.0) * (s.shieldTimer > 0 ? 1.22 : 1.0) * (s.charging ? 0.72 : 1.0);
      const accel = 980 * speedMult;

      if (Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05) {
        const len = Math.hypot(move.x, move.y) || 1;
        const nx = move.x / len;
        const ny = move.y / len;
        s.facingX = nx;
        s.facingY = ny;
        s.vx += nx * accel * dt;
        s.vy += ny * accel * dt;
      }

      s.vx *= 0.86;
      s.vy *= 0.86;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.clampSmith(s, width, height);

      if (this.input.justPressed(s.id) || this.input.justAction(s.id)) {
        this.alignNearestCrucible(s, width, height);
      }

      const holding = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);
      if (holding) {
        s.charging = true;
        s.charge += dt * 0.84;
        if (s.charge >= 1.0) {
          s.charging = false;
          s.charge = 0;
          s.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(s.x, s.y - 28, '⚠️ TONGS OVERHEAT!', '#ef4444', 15);
        }
      } else if (s.charging) {
        const pct = s.charge;
        s.charging = false;
        s.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerCrucibleSurge(s, width, height);
        } else if (pct >= 0.25) {
          s.vx += s.facingX * 240;
          s.vy += s.facingY * 240;
          this.audio.playWhoosh();
        }
      }

      for (let i = this.ingots.length - 1; i >= 0; i--) {
        const ing = this.ingots[i];
        if (Math.hypot(ing.x - s.x, ing.y - s.y) < 30) {
          if (ing.kind === 'slag_puddle') {
            if (s.shieldTimer > 0 || s.underdog) {
              s.score += 50;
              this.audio.playBoost();
              this.addFloatingText(ing.x, ing.y - 22, '🛡️ SLAG SMELTED! +50', '#38bdf8', 16);
            } else {
              s.stunTimer = 0.8;
              s.combo = 1;
              s.score = Math.max(0, s.score - 25);
              this.audio.playBuzzer();
              this.particles.emit(ing.x, ing.y, 16, '#ef4444');
              this.addFloatingText(ing.x, ing.y - 22, '🔥 MOLTEN SLAG! -25', '#ef4444', 16);
            }
          } else {
            s.combo = Math.min(3, s.combo + 1);
            s.comboTimer = 4.0;
            const pts = Math.round(ing.value * s.combo * (this.suddenDeath ? 2 : 1));
            s.score += pts;
            this.audio.playScore();
            const col = ing.kind === 'royal_gold' ? '#facc15' : '#fb923c';
            const label = ing.kind === 'royal_gold' ? `👑 ROYAL INGOT! +${pts}` : `🧱 COPPER INGOT! +${pts}`;
            this.particles.emit(ing.x, ing.y, 12, col);
            this.addFloatingText(ing.x, ing.y - 22, label, col, 16);
          }
          this.ingots.splice(i, 1);
        }
      }
    });

    // Smith-to-Smith collisions
    const list = Array.from(this.smiths.values());
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

  private clampSmith(s: FoundrySmith, width: number, height: number): void {
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (s.x < padX) { s.x = padX; s.vx = Math.abs(s.vx) * 0.5; }
    if (s.x > width - padX) { s.x = width - padX; s.vx = -Math.abs(s.vx) * 0.5; }
    if (s.y < minY) { s.y = minY; s.vy = Math.abs(s.vy) * 0.5; }
    if (s.y > maxY) { s.y = maxY; s.vy = -Math.abs(s.vy) * 0.5; }
  }

  private alignNearestCrucible(s: FoundrySmith, width: number, height: number): void {
    let best: SmeltCrucible | null = null;
    let bestDist = 78;
    for (const c of this.crucibles) {
      const d = Math.hypot(c.x - s.x, c.y - s.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (!best) return;

    best.valveAligned = true;
    const pts = this.suddenDeath ? 90 : 45;
    s.score += pts;
    this.audio.playScore();
    this.particles.emit(best.x, best.y, 14, '#facc15');
    this.addFloatingText(best.x, best.y - 28, `⚙️ CONDUIT CAST! +${pts}`, '#facc15', 16);
    this.spawnIngot(width, height, best.x + (Math.random() - 0.5) * 40, best.y + 34, 'copper');
  }

  private triggerCrucibleSurge(s: FoundrySmith, width: number, height: number): void {
    s.shieldTimer = 1.45;
    s.vx += s.facingX * 350;
    s.vy += s.facingY * 350;
    const pts = this.suddenDeath ? 170 : 85;
    s.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: s.x,
      y: s.y,
      r: 20,
      maxR: 160,
      alpha: 1,
      color: '#fb923c',
    });
    this.particles.emit(s.x, s.y, 24, '#fb923c');
    this.addFloatingText(s.x, s.y - 34, `🔥 CRUCIBLE SMELT SURGE! +${pts}`, '#facc15', 18);

    for (const c of this.crucibles) {
      if (Math.hypot(c.x - s.x, c.y - s.y) < 160) {
        c.valveAligned = true;
        this.spawnIngot(width, height, c.x, c.y + 34, 'royal_gold');
      }
    }

    this.smiths.forEach(other => {
      if (other.id === s.id) return;
      const dx = other.x - s.x;
      const dy = other.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 150) {
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        s.score += 70;
        this.addFloatingText(other.x, other.y - 28, '🌋 SLAG SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.smiths.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let bestIng: FoundryIngot | null = null;
      let bestScore = -999;
      for (const ing of this.ingots) {
        if (ing.kind === 'slag_puddle') continue;
        const d = Math.hypot(ing.x - bot.x, ing.y - bot.y);
        const val = ing.value * 1.3 - d * 0.25;
        if (val > bestScore) {
          bestScore = val;
          bestIng = ing;
        }
      }

      if (bestIng) {
        bot.botTargetX = bestIng.x;
        bot.botTargetY = bestIng.y;
      } else {
        const c = this.crucibles[0];
        bot.botTargetX = c ? c.x : width * 0.5;
        bot.botTargetY = c ? c.y : height * 0.54;
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
    bot.vx += steerX * 620 * dt;
    bot.vy += -throttleY * 620 * dt;

    if (bot.botHoldTarget > 0) {
      if (bot.charge < bot.botHoldTarget) {
        this.input.setBotState(botId, true);
      } else {
        bot.botHoldTarget = 0;
        this.input.setBotState(botId, false);
      }
    } else {
      this.input.setBotState(botId, false);
      for (const c of this.crucibles) {
        if (!c.valveAligned && Math.hypot(c.x - bot.x, c.y - bot.y) < 58) {
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

    // Crucibles
    for (const c of this.crucibles) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#292524';
      ctx.strokeStyle = c.valveAligned ? '#4ade80' : '#ef4444';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = theme.moltenGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 16 * (c.heat / 100), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Ingots & Slag
    for (const ing of this.ingots) {
      ctx.save();
      ctx.translate(ing.x, ing.y);
      if (ing.kind === 'slag_puddle') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = ing.kind === 'royal_gold' ? '#facc15' : '#fb923c';
        ctx.fillRect(-12, -7, 24, 14);
      }
      ctx.restore();
    }

    // Smiths
    const sorted = Array.from(this.smiths.values()).sort((a, b) => a.y - b.y);
    for (const s of sorted) {
      const cfg = this.players.find(p => p.id === s.id);
      ctx.save();
      ctx.translate(s.x, s.y);

      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 16, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      if (s.charging) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + s.charge * Math.PI * 2);
        ctx.stroke();
      }

      const mood = s.stunTimer > 0 ? 'shocked' : s.charging ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, cfg?.id || 1, 0, -2, 15, mood, 45 - this.roundTimer, 0);
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // Top Header Banner
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 54, 520, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: RUN FOUNDRY • TAP: ALIGN CRUCIBLE & CAST INGOT • HOLD (72-98%): SMELT SURGE SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.smiths.get(p.id);
      if (!s) return;
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
      ctx.fillText(`${s.score} PTS`, cardX + 10, cardY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} forged the purest Royal Ingots!` : 'Foundry cooled!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.smiths.forEach((s, id) => scores.set(id, s.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.smiths.forEach(s => {
      if (s.score > bestScore) {
        bestScore = s.score;
        bestId = s.id;
        tie = false;
      } else if (s.score === bestScore) {
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
}
