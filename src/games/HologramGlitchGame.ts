import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ThemeId = 'nexus_terminal' | 'holo_magenta' | 'golden_citadel';

interface ThemePalette {
  id: ThemeId;
  name: string;
  floorTop: string;
  floorMid: string;
  floorBot: string;
  holoClean: string;
  holoGlitch: string;
  accent: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'nexus_terminal',
    name: 'Nexus Security Terminal',
    floorTop: '#050712',
    floorMid: '#0f172a',
    floorBot: '#020617',
    holoClean: '#38bdf8',
    holoGlitch: '#f43f5e',
    accent: '#38bdf8',
  },
  {
    id: 'holo_magenta',
    name: 'Synth Hologram Deck',
    floorTop: '#160d29',
    floorMid: '#2e1065',
    floorBot: '#090514',
    holoClean: '#c084fc',
    holoGlitch: '#fb7185',
    accent: '#f472b6',
  },
  {
    id: 'golden_citadel',
    name: 'Sovereign Archive',
    floorTop: '#1c1917',
    floorMid: '#292524',
    floorBot: '#0c0a09',
    holoClean: '#facc15',
    holoGlitch: '#ef4444',
    accent: '#facc15',
  },
];

interface HoloPedestal {
  id: number;
  x: number;
  y: number;
  isGlitching: boolean;
  glitchTimer: number;
  pulse: number;
}

interface MemoryShard {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'shard' | 'nexus_core';
  value: number;
}

interface Inquisitor {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  comboTimer: number;
  charging: boolean;
  charge: number;
  scannerTimer: number;
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

export class HologramGlitchGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  private agents: Map<PlayerId, Inquisitor> = new Map();
  public holos: HoloPedestal[] = [];
  private shards: MemoryShard[] = [];
  private shockwaves: Shockwave[] = [];
  private nextShardId = 1;
  private glitchSpawnTimer = 0.8;
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
    this.agents.clear();
    this.holos = [];
    this.shards = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.glitchSpawnTimer = 0.6;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const rx = Math.min(width * 0.28, 220);
    const ry = Math.min(height * 0.21, 115);

    const coords = [
      { x: cx - rx, y: cy - ry },
      { x: cx, y: cy - ry },
      { x: cx + rx, y: cy - ry },
      { x: cx - rx, y: cy + ry },
      { x: cx, y: cy + ry },
      { x: cx + rx, y: cy + ry },
    ];

    coords.forEach((c, idx) => {
      this.holos.push({
        id: idx,
        x: c.x,
        y: c.y,
        isGlitching: idx % 2 === 0,
        glitchTimer: idx % 2 === 0 ? 3.5 : 0,
        pulse: idx * 0.9,
      });
    });

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.agents.set(p.id, {
        id: p.id,
        x: cx + (idx - (active.length - 1) * 0.5) * 80,
        y: cy,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        comboTimer: 0,
        charging: false,
        charge: 0,
        scannerTimer: 0,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.16 + Math.random() * 0.14,
        botTargetX: cx,
        botTargetY: cy,
        botHoldTarget: 0,
      });
    });
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

  private spawnShard(x: number, y: number): void {
    if (this.shards.length >= 14) return;
    const kind = Math.random() < 0.35 ? 'nexus_core' : 'shard';
    this.shards.push({
      id: this.nextShardId++,
      x,
      y,
      vx: (Math.random() - 0.5) * 90,
      vy: (Math.random() - 0.5) * 90,
      kind,
      value: kind === 'nexus_core' ? 95 : 50,
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
      this.addFloatingText(width * 0.5, 110, '⚡ SUDDEN DEATH: ROGUE REPLICA SURGE 2X! ⚡', '#facc15', 20);
    }

    let maxScore = 0;
    this.agents.forEach(a => {
      if (a.score > maxScore) maxScore = a.score;
    });
    this.agents.forEach(a => {
      a.underdog = maxScore - a.score >= 150;
    });

    this.updateBots(dt, width, height);

    for (const h of this.holos) {
      h.pulse += dt * 7;
      if (h.isGlitching) {
        h.glitchTimer -= dt;
        if (h.glitchTimer <= 0) {
          h.isGlitching = false;
        }
      }
    }

    this.glitchSpawnTimer -= dt;
    if (this.glitchSpawnTimer <= 0) {
      this.glitchSpawnTimer = this.suddenDeath ? 0.65 : 1.05;
      const clean = this.holos.filter(h => !h.isGlitching);
      if (clean.length > 0) {
        const pick = clean[Math.floor(Math.random() * clean.length)];
        pick.isGlitching = true;
        pick.glitchTimer = 3.6;
      }
    }

    for (const s of this.shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.9;
      s.vy *= 0.9;
    }

    this.agents.forEach(a => {
      if (a.scannerTimer > 0) a.scannerTimer = Math.max(0, a.scannerTimer - dt);
      if (a.comboTimer > 0) {
        a.comboTimer -= dt;
        if (a.comboTimer <= 0) a.combo = 1;
      }

      if (a.stunTimer > 0) {
        a.stunTimer -= dt;
        a.charging = false;
        a.charge = 0;
        a.vx *= 0.9;
        a.vy *= 0.9;
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        this.clampAgent(a, width, height);
        return;
      }

      const move = { x: this.input.getSteer(a.id), y: -this.input.getThrottle(a.id) };
      const speedMult = (a.underdog ? 1.24 : 1.0) * (a.scannerTimer > 0 ? 1.22 : 1.0) * (a.charging ? 0.72 : 1.0);
      const accel = 980 * speedMult;

      a.vx += move.x * accel * dt;
      a.vy += move.y * accel * dt;
      a.vx *= 0.86;
      a.vy *= 0.86;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      this.clampAgent(a, width, height);

      const pCfg = this.getPlayer(a.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;

      if (this.input.justAction(a.id) || (isBot && this.input.justPressed(a.id))) {
        this.purgeNearestHolo(a);
      }

      const holding = this.input.isActionPressed(a.id) || (isBot && this.input.isPressed(a.id));
      if (holding) {
        a.charging = true;
        a.charge += dt * 0.84;
        if (a.charge >= 1.0) {
          a.charging = false;
          a.charge = 0;
          a.stunTimer = 0.75;
          this.audio.playBuzzer();
          this.addFloatingText(a.x, a.y - 28, '⚠️ SCANNER OVERLOAD!', '#ef4444', 15);
        }
      } else if (a.charging) {
        const pct = a.charge;
        a.charging = false;
        a.charge = 0;
        if (pct >= 0.72 && pct <= 0.98) {
          this.triggerChromaticPurgeWave(a);
        }
      }

      for (let i = this.shards.length - 1; i >= 0; i--) {
        const s = this.shards[i];
        if (Math.hypot(s.x - a.x, s.y - a.y) < 30) {
          const pts = Math.round(s.value * (this.suddenDeath ? 2 : 1));
          a.score += pts;
          this.audio.playScore();
          const col = s.kind === 'nexus_core' ? '#facc15' : '#38bdf8';
          const label = s.kind === 'nexus_core' ? `👑 NEXUS CORE! +${pts}` : `💾 MEMORY SHARD! +${pts}`;
          this.particles.emit(s.x, s.y, 12, col);
          this.addFloatingText(s.x, s.y - 22, label, col, 16);
          this.shards.splice(i, 1);
        }
      }
    });

    // Agent-to-Agent collisions
    const list = Array.from(this.agents.values());
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

  private clampAgent(a: Inquisitor, width: number, height: number): void {
    const padX = 54;
    const minY = 96;
    const maxY = height - 62;
    if (a.x < padX) { a.x = padX; a.vx = Math.abs(a.vx) * 0.5; }
    if (a.x > width - padX) { a.x = width - padX; a.vx = -Math.abs(a.vx) * 0.5; }
    if (a.y < minY) { a.y = minY; a.vy = Math.abs(a.vy) * 0.5; }
    if (a.y > maxY) { a.y = maxY; a.vy = -Math.abs(a.vy) * 0.5; }
  }

  private purgeNearestHolo(a: Inquisitor): void {
    let best: HoloPedestal | null = null;
    let bestDist = 72;
    for (const h of this.holos) {
      const d = Math.hypot(h.x - a.x, h.y - a.y);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    if (!best) return;

    if (best.isGlitching) {
      best.isGlitching = false;
      a.combo = Math.min(3, a.combo + 1);
      a.comboTimer = 4.2;
      const pts = Math.round(65 * a.combo * (this.suddenDeath ? 2 : 1));
      a.score += pts;
      this.audio.playScore();
      this.particles.emit(best.x, best.y, 18, '#38bdf8');
      this.addFloatingText(best.x, best.y - 32, `⚡ GLITCH PURGED! +${pts} (${a.combo}x)`, '#facc15', 17);
      this.spawnShard(best.x, best.y + 28);
    } else if (!a.underdog && a.scannerTimer <= 0) {
      a.stunTimer = 0.75;
      a.combo = 1;
      a.score = Math.max(0, a.score - 20);
      this.audio.playBuzzer();
      this.addFloatingText(best.x, best.y - 28, '🚨 CIVILIAN HOLO! -20', '#ef4444', 15);
    }
  }

  private triggerChromaticPurgeWave(a: Inquisitor): void {
    a.scannerTimer = 1.45;
    const pts = this.suddenDeath ? 170 : 85;
    a.score += pts;
    this.audio.playBoost();
    this.shockwaves.push({
      x: a.x,
      y: a.y,
      r: 20,
      maxR: 175,
      alpha: 1,
      color: '#38bdf8',
    });
    this.particles.emit(a.x, a.y, 24, '#38bdf8');
    this.addFloatingText(a.x, a.y - 34, `👁️ CHROMATIC PURGE WAVE! +${pts}`, '#facc15', 18);

    for (const h of this.holos) {
      if (h.isGlitching && Math.hypot(h.x - a.x, h.y - a.y) < 175) {
        h.isGlitching = false;
        a.score += 60;
        this.spawnShard(h.x, h.y + 26);
      }
    }

    this.agents.forEach(other => {
      if (other.id === a.id) return;
      const dist = Math.hypot(other.x - a.x, other.y - a.y);
      if (dist < 150) {
        const nx = (other.x - a.x) / (dist || 1);
        const ny = (other.y - a.y) / (dist || 1);
        other.vx += nx * 420;
        other.vy += ny * 420;
        other.stunTimer = 0.7;
        a.score += 70;
        this.addFloatingText(other.x, other.y - 28, '⚡ EMP SHUNT! +70', '#38bdf8', 17);
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
    const bot = this.agents.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.12 : difficulty === 'bot_normal' ? 0.22 : 0.35;

      const glitching = this.holos.find(h => h.isGlitching);
      if (glitching) {
        bot.botTargetX = glitching.x;
        bot.botTargetY = glitching.y + 24;
      } else if (this.shards.length > 0) {
        bot.botTargetX = this.shards[0].x;
        bot.botTargetY = this.shards[0].y;
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
      for (const h of this.holos) {
        if (h.isGlitching && Math.hypot(h.x - bot.x, h.y - bot.y) < 56) {
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

    for (const sh of this.shards) {
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.fillStyle = sh.kind === 'nexus_core' ? '#facc15' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6 Hologram Pedestals
    for (const h of this.holos) {
      ctx.save();
      ctx.translate(h.x, h.y);

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = h.isGlitching ? theme.holoGlitch : theme.holoClean;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 24, 28, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const jitter = h.isGlitching ? (Math.random() - 0.5) * 9 : 0;
      ctx.fillStyle = h.isGlitching ? theme.holoGlitch : theme.holoClean;
      ctx.fillRect(-10 + jitter, -12, 20, 26);
      ctx.beginPath();
      ctx.arc(jitter, -21, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Agents
    const sorted = Array.from(this.agents.values()).sort((a, b) => a.y - b.y);
    for (const a of sorted) {
      const cfg = this.players.find(p => p.id === a.id);
      ctx.save();
      ctx.translate(a.x, a.y);

      if (a.charging) {
        const sweet = a.charge >= 0.72 && a.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = sweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI * 0.5, -Math.PI * 0.5 + a.charge * Math.PI * 2);
        ctx.stroke();
      }

      const mood = a.stunTimer > 0 ? 'shocked' : a.charging ? 'focused' : 'happy';
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
    ctx.fillStyle = '#bae6fd';
    ctx.font = '800 12px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('STEER: PATROL CHAMBER • TAP GLITCHING HOLO: PURGE • HOLD (72-98%): CHROMATIC WAVE SHUNT', width * 0.5, 68);
    ctx.restore();

    // Corner Player Cards
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const a = this.agents.get(p.id);
      if (!a) return;
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
      ctx.fillText(`${a.score} PTS`, cardX + 10, cardY + 38);
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
      mvpHighlight: winnerId ? `${winnerId} purged every rogue replica!` : 'Chamber secured!',
    };
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.agents.forEach((a, id) => scores.set(id, a.score));
    return scores;
  }

  public getWinner(): PlayerId | null {
    let bestId: PlayerId | null = null;
    let bestScore = -1;
    let tie = false;
    this.agents.forEach(a => {
      if (a.score > bestScore) {
        bestScore = a.score;
        bestId = a.id;
        tie = false;
      } else if (a.score === bestScore) {
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
