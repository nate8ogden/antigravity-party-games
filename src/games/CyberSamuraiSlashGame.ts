import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'neo_shinjuku' | 'sakura_cyber' | 'arasaka_penthouse';

interface ThemePalette {
  id: ThemeId;
  name: string;
  skyTop: string;
  skyMid: string;
  floorCol: string;
  neonGrid: string;
  bladeGlow: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'neo_shinjuku',
    name: 'Neo-Shinjuku Rain Rooftop',
    skyTop: '#070412',
    skyMid: '#150c2a',
    floorCol: '#0f172a',
    neonGrid: 'rgba(56, 189, 248, 0.14)',
    bladeGlow: '#38bdf8',
    accent: '#f43f5e',
  },
  {
    id: 'sakura_cyber',
    name: 'Hologram Sakura Shrine',
    skyTop: '#1a0826',
    skyMid: '#3b0f4c',
    floorCol: '#1e102b',
    neonGrid: 'rgba(244, 114, 182, 0.16)',
    bladeGlow: '#f472b6',
    accent: '#f472b6',
  },
  {
    id: 'arasaka_penthouse',
    name: 'Crimson Zaibatsu Helipad',
    skyTop: '#180609',
    skyMid: '#380d14',
    floorCol: '#171717',
    neonGrid: 'rgba(250, 204, 21, 0.14)',
    bladeGlow: '#facc15',
    accent: '#facc15',
  },
];

interface DojoTarget {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'kanji_orb' | 'shogun_relic' | 'shuriken_drone';
  value: number;
  pulse: number;
}

interface SlashTrail {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  alpha: number;
}

interface CyberSamurai {
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
  slashAnim: number;
  charging: boolean;
  charge: number;
  iaidoTimer: number;
  staggerTimer: number;
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

export class CyberSamuraiSlashGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public samurais: Map<PlayerId, CyberSamurai> = new Map();
  private targets: DojoTarget[] = [];
  private slashTrails: SlashTrail[] = [];
  private shockwaves: Shockwave[] = [];
  private nextTargetId = 1;
  private spawnTimer = 1.2;
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
    this.samurais.clear();
    this.targets = [];
    this.slashTrails = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.spawnTimer = 1.0;

    const active = this.getActivePlayers();
    const spawns = [
      { x: width * 0.30, y: height * 0.45, fx: 1 },
      { x: width * 0.70, y: height * 0.45, fx: -1 },
      { x: width * 0.30, y: height * 0.68, fx: 1 },
      { x: width * 0.70, y: height * 0.68, fx: -1 },
    ];

    active.forEach((p, idx) => {
      const sp = spawns[idx % spawns.length];
      this.samurais.set(p.id, {
        id: p.id,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        facingX: sp.fx,
        facingY: 0,
        score: 0,
        combo: 1,
        comboTimer: 0,
        slashAnim: 0,
        charging: false,
        charge: 0,
        iaidoTimer: 0,
        staggerTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: width * 0.5,
        botTargetY: height * 0.54,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnTarget(width, height);
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

  private spawnTarget(width: number, height: number, x?: number, y?: number, forcedKind?: 'kanji_orb' | 'shogun_relic' | 'shuriken_drone'): void {
    if (this.targets.length >= 14) return;
    const roll = Math.random();
    const kind = forcedKind ?? (roll < 0.24 ? 'shuriken_drone' : roll < 0.44 ? 'shogun_relic' : 'kanji_orb');
    this.targets.push({
      id: this.nextTargetId++,
      x: x ?? (95 + Math.random() * (width - 190)),
      y: y ?? (115 + Math.random() * (height - 195)),
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      kind,
      value: kind === 'shogun_relic' ? 95 : kind === 'kanji_orb' ? 50 : 60,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: RONIN OVERDRIVE 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.samurais.forEach(s => {
      if (s.score > maxScore) maxScore = s.score;
    });
    this.samurais.forEach(s => {
      s.underdog = maxScore - s.score >= 150;
    });

    this.updateBots(dt, width, height);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.85 : 1.35;
      this.spawnTarget(width, height);
    }

    for (const t of this.targets) {
      t.pulse += dt * 7;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < 65 || t.x > width - 65) t.vx *= -1;
      if (t.y < 100 || t.y > height - 70) t.vy *= -1;
    }

    this.samurais.forEach(s => {
      if (s.iaidoTimer > 0) s.iaidoTimer = Math.max(0, s.iaidoTimer - dt);
      if (s.slashAnim > 0) s.slashAnim = Math.max(0, s.slashAnim - dt * 5);
      if (s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 1;
      }

      if (s.staggerTimer > 0) {
        s.staggerTimer -= dt;
        s.charging = false;
        s.charge = 0;
        s.vx *= 0.9;
        s.vy *= 0.9;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        this.clampSamurai(s, width, height);
        return;
      }

      const move = { x: this.input.getSteer(s.id), y: -this.input.getThrottle(s.id) };
      const speedMult = (s.underdog ? 1.24 : 1.0) * (s.iaidoTimer > 0 ? 1.35 : 1.0) * (s.charging ? 0.72 : 1.0);
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
      this.clampSamurai(s, width, height);

      if (this.input.justPressed(s.id) || this.input.justAction(s.id)) {
        this.performKatanaSlash(s, width, height);
      }

      const holding = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);
      if (holding) {
        s.charging = true;
        s.charge += dt * 0.85;
        if (s.charge >= 1.0) {
          s.charging = false;
          s.charge = 0;
          s.staggerTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(s.x, s.y - 28, '⚠️ BLADE OVERCHARGE!', '#ef4444', 15);
        }
      } else if (s.charging) {
        const pct = s.charge;
        s.charging = false;
        s.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerIaidoFlashStep(s, width, height);
        } else if (pct >= 0.25) {
          s.vx += s.facingX * 260;
          s.vy += s.facingY * 260;
          this.audio.playWhoosh();
        }
      }

      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i];
        if (Math.hypot(t.x - s.x, t.y - s.y) < 30) {
          if (t.kind === 'shuriken_drone') {
            if (s.slashAnim > 0 || s.iaidoTimer > 0 || s.underdog) {
              const pts = this.suddenDeath ? 120 : 60;
              s.score += pts;
              this.audio.playScore();
              this.particles.emit(t.x, t.y, 14, '#38bdf8');
              this.addFloatingText(t.x, t.y - 22, `⚔️ DRONE SLICED! +${pts}`, '#38bdf8', 16);
            } else {
              s.staggerTimer = 0.8;
              s.combo = 1;
              s.score = Math.max(0, s.score - 25);
              this.audio.playBuzzer();
              this.particles.emit(t.x, t.y, 14, '#ef4444');
              this.addFloatingText(t.x, t.y - 22, '💥 SHURIKEN HIT! -25', '#ef4444', 16);
            }
          } else {
            const pts = Math.round(t.value * (this.suddenDeath ? 2 : 1));
            s.score += pts;
            this.audio.playScore();
            const col = t.kind === 'shogun_relic' ? '#facc15' : '#38bdf8';
            const label = t.kind === 'shogun_relic' ? `👑 SHOGUN RELIC! +${pts}` : `💠 KANJI ORB! +${pts}`;
            this.particles.emit(t.x, t.y, 12, col);
            this.addFloatingText(t.x, t.y - 22, label, col, 16);
          }
          this.targets.splice(i, 1);
        }
      }
    });

    // Samurai-to-Samurai elastic collisions
    const list = Array.from(this.samurais.values());
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

    for (let i = this.slashTrails.length - 1; i >= 0; i--) {
      this.slashTrails[i].alpha -= dt * 2.5;
      if (this.slashTrails[i].alpha <= 0) this.slashTrails.splice(i, 1);
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

  private clampSamurai(s: CyberSamurai, width: number, height: number): void {
    const padX = 56;
    const minY = 96;
    const maxY = height - 62;
    if (s.x < padX) { s.x = padX; s.vx = Math.abs(s.vx) * 0.5; }
    if (s.x > width - padX) { s.x = width - padX; s.vx = -Math.abs(s.vx) * 0.5; }
    if (s.y < minY) { s.y = minY; s.vy = Math.abs(s.vy) * 0.5; }
    if (s.y > maxY) { s.y = maxY; s.vy = -Math.abs(s.vy) * 0.5; }
  }

  private performKatanaSlash(s: CyberSamurai, width: number, height: number): void {
    s.slashAnim = 1.0;
    s.vx += s.facingX * 190;
    s.vy += s.facingY * 190;
    this.audio.playWhoosh();

    // Slice nearby drones & orbs
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      if (Math.hypot(t.x - s.x, t.y - s.y) < 72) {
        s.combo = Math.min(3, s.combo + 1);
        s.comboTimer = 4.0;
        const pts = Math.round(t.value * s.combo * (this.suddenDeath ? 2 : 1));
        s.score += pts;
        this.audio.playScore();
        this.particles.emit(t.x, t.y, 14, '#facc15');
        this.addFloatingText(t.x, t.y - 22, `⚔️ KATANA CLEAVE! +${pts}`, '#facc15', 16);
        this.targets.splice(i, 1);
      }
    }

    // Strike or clash with rival samurais
    this.samurais.forEach(other => {
      if (other.id === s.id) return;
      const dist = Math.hypot(other.x - s.x, other.y - s.y);
      if (dist < 76) {
        if (other.charging || other.slashAnim > 0.3) {
          // Sparks-flying Blade Clash Parry!
          s.score += 65;
          other.score += 65;
          this.audio.playBounce();
          this.particles.emit((s.x + other.x) * 0.5, (s.y + other.y) * 0.5, 22, '#38bdf8');
          this.addFloatingText((s.x + other.x) * 0.5, s.y - 30, '⚡ BLADE CLASH PARRY! +65', '#38bdf8', 17);
        } else {
          const pts = this.suddenDeath ? 110 : 55;
          s.score += pts;
          other.staggerTimer = 0.65;
          const nx = (other.x - s.x) / (dist || 1);
          const ny = (other.y - s.y) / (dist || 1);
          other.vx += nx * 360;
          other.vy += ny * 360;
          this.audio.playScore();
          this.particles.emit(other.x, other.y, 18, '#f43f5e');
          this.addFloatingText(other.x, other.y - 28, `⚔️ KATANA STRIKE! +${pts}`, '#facc15', 17);
          this.spawnTarget(width, height, other.x, other.y + 24, 'kanji_orb');
        }
      }
    });
  }

  private triggerIaidoFlashStep(s: CyberSamurai, width: number, height: number): void {
    const startX = s.x;
    const startY = s.y;
    s.iaidoTimer = 1.4;
    s.slashAnim = 1.0;
    s.x += s.facingX * 165;
    s.y += s.facingY * 165;
    this.clampSamurai(s, width, height);

    const cfg = this.players.find(p => p.id === s.id);
    this.slashTrails.push({
      x1: startX,
      y1: startY,
      x2: s.x,
      y2: s.y,
      color: cfg?.color || '#38bdf8',
      alpha: 1,
    });

    const pts = this.suddenDeath ? 170 : 85;
    s.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: s.x,
      y: s.y,
      r: 20,
      maxR: 155,
      alpha: 1,
      color: '#facc15',
    });
    this.particles.emit(s.x, s.y, 24, '#facc15');
    this.addFloatingText(s.x, s.y - 34, `⚡ IAIDO FLASH-STEP! +${pts}`, '#facc15', 18);

    this.samurais.forEach(other => {
      if (other.id === s.id) return;
      const dist = Math.hypot(other.x - s.x, other.y - s.y);
      if (dist < 150) {
        const nx = (other.x - s.x) / (dist || 1);
        const ny = (other.y - s.y) / (dist || 1);
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.staggerTimer = 0.75;
        s.score += 70;
        this.addFloatingText(other.x, other.y - 28, '⚔️ IAIDO BLADE SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.samurais.get(botId);
    if (!bot || bot.staggerTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      let bestX = width * 0.5;
      let bestY = height * 0.54;
      let bestVal = -999;

      for (const t of this.targets) {
        const d = Math.hypot(t.x - bot.x, t.y - bot.y);
        const val = t.value * 1.3 - d * 0.25;
        if (val > bestVal) {
          bestVal = val;
          bestX = t.x;
          bestY = t.y;
        }
      }

      this.samurais.forEach(other => {
        if (other.id === botId) return;
        const d = Math.hypot(other.x - bot.x, other.y - bot.y);
        const val = 100 - d * 0.22;
        if (val > bestVal) {
          bestVal = val;
          bestX = other.x;
          bestY = other.y;
        }
      });

      bot.botTargetX = bestX;
      bot.botTargetY = bestY;

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
    if (dist > 8) {
      bot.facingX = steerX;
      bot.facingY = -throttleY;
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
      if (dist < 68 && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.22)) {
        this.input.triggerBotPress(botId);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.skyTop);
    bg.addColorStop(0.55, theme.skyMid);
    bg.addColorStop(1, theme.floorCol);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.strokeStyle = theme.neonGrid;
    ctx.lineWidth = 1;
    for (let x = 50; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 90);
      ctx.lineTo(x, height - 45);
      ctx.stroke();
    }
    ctx.restore();

    for (const tr of this.slashTrails) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, tr.alpha);
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(tr.x1, tr.y1);
      ctx.lineTo(tr.x2, tr.y2);
      ctx.stroke();
      ctx.restore();
    }

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

    for (const t of this.targets) {
      ctx.save();
      ctx.translate(t.x, t.y);
      if (t.kind === 'shuriken_drone') {
        ctx.rotate(t.pulse);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-11, -3, 22, 6);
        ctx.fillRect(-3, -11, 6, 22);
      } else if (t.kind === 'shogun_relic') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const sorted = Array.from(this.samurais.values()).sort((a, b) => a.y - b.y);
    for (const s of sorted) {
      const cfg = this.players.find(p => p.id === s.id);
      const color = cfg?.color || '#38bdf8';

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
        ctx.arc(0, 0, 27, -Math.PI * 0.5, -Math.PI * 0.5 + s.charge * Math.PI * 2);
        ctx.stroke();
      }

      if (s.slashAnim > 0) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 5;
        const a = Math.atan2(s.facingY, s.facingX);
        ctx.beginPath();
        ctx.arc(0, 0, 38, a - 0.9, a + 0.9);
        ctx.stroke();
      }

      const mood = s.staggerTimer > 0 ? 'shocked' : s.charging ? 'focused' : 'happy';
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
    ctx.fillStyle = '#f472b6';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: STALK ROOFTOP 2D • TAP: KATANA SLASH & PARRY • HOLD (72-98%): IAIDO FLASH-STEP', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.samurais.get(p.id);
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
      mvpHighlight: winnerId ? `${winnerId} mastered the Cyber-Katana!` : 'Blades clashed!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.samurais.forEach((s, id) => scores.set(id, s.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.samurais.forEach(s => {
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
