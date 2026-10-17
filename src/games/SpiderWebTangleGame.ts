import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type WebTheme = 'morning_dew_web' | 'moonlit_silk' | 'crystal_orb_weaver';

interface WebPalette {
  name: string;
  bgTop: string;
  bgBot: string;
  silkColor: string;
}

const THEMES: Record<WebTheme, WebPalette> = {
  morning_dew_web: {
    name: 'Morning Dew Garden Web',
    bgTop: '#064e3b',
    bgBot: '#022c22',
    silkColor: '#e2e8f0',
  },
  moonlit_silk: {
    name: 'Moonlit Silver Silk',
    bgTop: '#1e1b4b',
    bgBot: '#090d16',
    silkColor: '#38bdf8',
  },
  crystal_orb_weaver: {
    name: 'Golden Orb-Weaver Canopy',
    bgTop: '#451a03',
    bgBot: '#1c1917',
    silkColor: '#fbbf24',
  },
};

const THEME_KEYS: WebTheme[] = ['morning_dew_web', 'moonlit_silk', 'crystal_orb_weaver'];

interface SilkStrand {
  ownerId: PlayerId;
  color: string;
  spoke: number;
  ring: number;
  ttl: number;
}

interface WebScarab {
  spoke: number;
  ring: number;
  golden: boolean;
}

interface SpiderWeaver {
  id: PlayerId;
  color: string;
  isBot: boolean;
  spoke: number; // 0..7 radial spokes
  ring: number; // 1..4 concentric rings
  x: number;
  y: number;
  moveCooldown: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  stunTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class SpiderWebTangleGame extends BaseGame {
  private spiders: SpiderWeaver[] = [];
  private strands: SilkStrand[] = [];
  private scarabs: WebScarab[] = [];
  private timeElapsed = 0;
  private roundTime = 45;
  private suddenDeath = false;
  private hitStopTimer = 0;
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private themeIdx = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    if (typeof window !== 'undefined' && !this.keyHandler) {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
          this.audio.playTap();
        } else if (e.key === '1') this.themeIdx = 0;
        else if (e.key === '2') this.themeIdx = 1;
        else if (e.key === '3') this.themeIdx = 2;
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  private nodePos(width: number, height: number, spoke: number, ring: number): { x: number; y: number } {
    const cx = width * 0.5;
    const cy = height * 0.54;
    const r = ring * 46;
    const a = (spoke * Math.PI) / 4;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.spiders = [];
    this.strands = [];
    this.scarabs = [];

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const sp = (idx * 2) % 8;
      const rg = 2;
      const pos = this.nodePos(width, height, sp, rg);
      this.spiders.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        spoke: sp,
        ring: rg,
        x: pos.x,
        y: pos.y,
        moveCooldown: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        stunTimer: 0,
        underdog: false,
        botTimer: 0.24,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });

    for (let i = 0; i < 6; i++) {
      this.scarabs.push({
        spoke: Math.floor(Math.random() * 8),
        ring: 1 + Math.floor(Math.random() * 4),
        golden: i % 2 === 0,
      });
    }
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(s: SpiderWeaver, text: string): void {
    s.calloutText = text;
    s.calloutTimer = 1.15;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.shakeTimer > 0) this.shakeTimer = Math.max(0, this.shakeTimer - dt);
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    this.timeElapsed += dt;
    const remaining = Math.max(0, this.roundTime - this.timeElapsed);
    if (remaining <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBuzzer();
      this.spiders.forEach((s) => this.showCallout(s, 'SILK SNARE 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const st of this.strands) st.ttl -= dt;
    this.strands = this.strands.filter((st) => st.ttl > 0);

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.spiders.map((s) => s.score));

    for (const s of this.spiders) {
      s.underdog = maxScore - s.score >= 150;
      if (s.calloutTimer > 0) s.calloutTimer = Math.max(0, s.calloutTimer - dt);
      if (s.moveCooldown > 0) s.moveCooldown = Math.max(0, s.moveCooldown - dt);
      if (s.stunTimer > 0) {
        s.stunTimer = Math.max(0, s.stunTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(s.id);
      const sy = this.input.getThrottle(s.id);
      const justTap = this.input.justAction(s.id);
      const isHold = this.input.isActionPressed(s.id);

      if (s.moveCooldown <= 0) {
        if (Math.abs(sx) > 0.45) {
          s.spoke = (s.spoke + (sx > 0 ? 1 : 7)) % 8;
          s.moveCooldown = 0.16;
          this.spinStrand(s);
        } else if (Math.abs(sy) > 0.45 || justTap) {
          s.ring = s.ring === 4 ? 1 : s.ring + 1;
          s.moveCooldown = 0.16;
          this.spinStrand(s);
        }
      }

      const targetPos = this.nodePos(width, height, s.spoke, s.ring);
      s.x += (targetPos.x - s.x) * Math.min(1, dt * 14);
      s.y += (targetPos.y - s.y) * Math.min(1, dt * 14);

      // Hold-to-charge Radial Web-Twang Pulse & Snare Shunt (72%-98% Sweet Spot)
      if (isHold) {
        s.holding = true;
        s.charge = Math.min(1, s.charge + dt * 0.92);
      } else if (s.holding) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        if (sweet) {
          s.score += 85;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, 'RADIAL SILK SNARE +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          // Spin a full ring of silk strands!
          for (let sp = 0; sp < 8; sp++) {
            this.strands.push({ ownerId: s.id, color: s.color, spoke: sp, ring: s.ring, ttl: 5.0 });
          }

          for (const other of this.spiders) {
            if (other.id !== s.id && other.ring === s.ring) {
              other.ring = 4;
              s.score += 70;
              this.showCallout(s, 'WEB-TWANG SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (s.charge > 0.98) {
          s.stunTimer = 0.85;
          s.combo = 1;
          this.showCallout(s, 'SILK TANGLE!');
          this.audio.playStun();
        }
        s.holding = false;
        s.charge = 0;
      }

      // Check scarab captures on radial nodes
      for (const sc of this.scarabs) {
        if (sc.spoke === s.spoke && sc.ring === s.ring) {
          const base = sc.golden ? 95 : 55;
          const pts = base * s.combo * (this.suddenDeath ? 2 : 1);
          s.score += pts;
          s.combo = Math.min(4, s.combo + 1);
          this.showCallout(s, sc.golden ? `GOLDEN SCARAB +${pts}!` : `SCARAB +${pts}`);
          this.audio.playScore();
          this.particles.spawnSparks(s.x, s.y, '#fbbf24', 10);
          sc.spoke = Math.floor(Math.random() * 8);
          sc.ring = 1 + Math.floor(Math.random() * 4);
          sc.golden = Math.random() < 0.35;
        }
      }
    }
  }

  private spinStrand(s: SpiderWeaver): void {
    this.strands.push({
      ownerId: s.id,
      color: s.color,
      spoke: s.spoke,
      ring: s.ring,
      ttl: 4.5,
    });
    s.score += 12;
    this.audio.playTap();
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.spiders.find((s) => s.id === botId);
    if (!bot || bot.stunTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.22 : 0.32;
      const target = this.scarabs[0];
      if (target) {
        if (bot.spoke !== target.spoke) {
          bot.spoke = (bot.spoke + 1) % 8;
        } else if (bot.ring !== target.ring) {
          bot.ring = target.ring;
        }
        this.spinStrand(bot);
      }
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotInput(botId, hold, 0, 0, hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.bgTop);
    bg.addColorStop(1, pal.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.54;
    ctx.strokeStyle = pal.silkColor;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      ctx.arc(cx, cy, ring * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let sp = 0; sp < 8; sp++) {
      const a = (sp * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 195, cy + Math.sin(a) * 195);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Player-Spun Colored Silk Tripwires
    for (const st of this.strands) {
      const p1 = this.nodePos(width, height, st.spoke, st.ring);
      const p2 = this.nodePos(width, height, (st.spoke + 1) % 8, st.ring);
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Scarabs on Web Nodes
    for (const sc of this.scarabs) {
      const p = this.nodePos(width, height, sc.spoke, sc.ring);
      ctx.fillStyle = sc.golden ? '#fbbf24' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, sc.golden ? 15 : 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spiders
    for (const s of this.spiders) {
      ctx.save();
      ctx.translate(s.x, s.y);
      if (s.holding && s.charge > 0.05) {
        const sweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + s.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = s.stunTimer > 0 ? 'shocked' : s.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, s.id, 0, 0, 16, mood, this.timeElapsed, 0);
      if (s.calloutTimer > 0 && s.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.calloutText, 0, -28);
      }
      ctx.restore();
    }

    // HUD
    const remaining = Math.max(0, Math.ceil(this.roundTime - this.timeElapsed));
    ctx.fillStyle = 'rgba(15,23,42,0.82)';
    ctx.fillRect(0, 0, width, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🕸️ SPIDER WEB TANGLE • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X SILK' : ''}`,
      width * 0.5,
      19
    );

    this.spiders.forEach((s, idx) => {
      ctx.fillStyle = s.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${s.id}: ${Math.round(s.score)} pts (${s.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.spiders].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((s, i) => ({
        playerId: s.id,
        score: Math.round(s.score),
        place: i + 1,
      })),
      mvpHighlight: `Radial Silk Weaver ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    const p1 = this.spiders.find(s => s.id === 0);
    if (!p1 || p1.stunTimer > 0) return false;

    const cx = width * 0.5;
    const cy = height * 0.54;
    const ang = Math.atan2(y - cy, x - cx);
    const spoke = ((Math.round((ang / (Math.PI * 2)) * 8) % 8) + 8) % 8;
    const dist = Math.hypot(x - cx, y - cy);
    const ring = Math.max(1, Math.min(4, Math.round(dist / 44)));

    p1.spoke = spoke;
    p1.ring = ring;
    this.spinStrand(p1);
    this.audio.playTap();
    return true;
  }
}
