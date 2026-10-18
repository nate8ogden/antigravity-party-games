import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type RiverTheme = 'amazon_rapids' | 'moonlit_bayou' | 'golden_cenote';

interface RiverPalette {
  name: string;
  waterTop: string;
  waterBot: string;
  logColor: string;
  bankColor: string;
}

const THEMES: Record<RiverTheme, RiverPalette> = {
  amazon_rapids: {
    name: 'Amazon Whitewater Rapids',
    waterTop: '#0369a1',
    waterBot: '#0c4a6e',
    logColor: '#78350f',
    bankColor: '#15803d',
  },
  moonlit_bayou: {
    name: 'Bioluminescent Mangrove River',
    waterTop: '#1e1b4b',
    waterBot: '#090d16',
    logColor: '#4c1d95',
    bankColor: '#047857',
  },
  golden_cenote: {
    name: 'Sunlit Mayan Cenote',
    waterTop: '#0d9488',
    waterBot: '#115e59',
    logColor: '#92400e',
    bankColor: '#ca8a04',
  },
};

const THEME_KEYS: RiverTheme[] = ['amazon_rapids', 'moonlit_bayou', 'golden_cenote'];

interface RiverLog {
  id: number;
  lane: number;
  x: number;
  y: number;
  w: number;
  vx: number;
  hasLotus: boolean;
  hasGoldenFrog: boolean;
}

interface LeapingPiranha {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface RiverHopper {
  id: PlayerId;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  charge: number;
  holding: boolean;
  splashShieldTimer: number;
  bittenTimer: number;
  underdog: boolean;
  botTimer: number;
  botChargeGoal: number;
  calloutText: string;
  calloutTimer: number;
}

export class PiranhaRiverHopGame extends BaseGame {
  private hoppers: RiverHopper[] = [];
  private logs: RiverLog[] = [];
  private piranhas: LeapingPiranha[] = [];
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

  public reset(width: number, height: number): void {
    this.timeElapsed = 0;
    this.roundTime = 45;
    this.isFinished = false;
    this.suddenDeath = false;
    this.hitStopTimer = 0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.hoppers = [];
    this.logs = [];
    this.piranhas = [];

    for (let lane = 0; lane < 5; lane++) {
      const y = height * (0.24 + lane * 0.12);
      const dir = lane % 2 === 0 ? 1 : -1;
      for (let k = 0; k < 3; k++) {
        this.logs.push({
          id: lane * 3 + k,
          lane,
          x: width * (0.18 + k * 0.32),
          y,
          w: 115,
          vx: dir * (85 + lane * 14),
          hasLotus: Math.random() < 0.55,
          hasGoldenFrog: Math.random() < 0.22,
        });
      }
    }

    for (let i = 0; i < 4; i++) {
      this.piranhas.push({
        x: width * (0.2 + i * 0.2),
        y: height * (0.28 + (i % 3) * 0.18),
        vx: (i % 2 === 0 ? 1 : -1) * 145,
        vy: 0,
      });
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.hoppers.push({
        id: p.id,
        color: p.color,
        isBot: p.type.startsWith('bot_'),
        x: width * (0.3 + (idx / Math.max(1, active.length - 1)) * 0.4),
        y: height * 0.86,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        charge: 0,
        holding: false,
        splashShieldTimer: 0,
        bittenTimer: 0,
        underdog: false,
        botTimer: 0.22,
        botChargeGoal: 0.82,
        calloutText: '',
        calloutTimer: 0,
      });
    });
  }

  private triggerHitStop(ms: number, shake: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
    this.shakeTimer = Math.max(this.shakeTimer, 0.22);
    this.shakeIntensity = Math.min(18, Math.max(this.shakeIntensity, shake));
  }

  private showCallout(h: RiverHopper, text: string): void {
    h.calloutText = text;
    h.calloutTimer = 1.15;
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
      this.hoppers.forEach((h) => this.showCallout(h, 'FRENZY RAPIDS 2X!'));
    }
    if (remaining <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    for (const lg of this.logs) {
      lg.x += lg.vx * (this.suddenDeath ? 1.3 : 1.0) * dt;
      if (lg.vx > 0 && lg.x - lg.w * 0.5 > width) lg.x = -lg.w * 0.5;
      if (lg.vx < 0 && lg.x + lg.w * 0.5 < 0) lg.x = width + lg.w * 0.5;
    }

    for (const pr of this.piranhas) {
      pr.x += pr.vx * dt;
      if (pr.x < width * 0.1 || pr.x > width * 0.9) pr.vx *= -1;
    }

    this.updateBots(dt, width, height);
    const maxScore = Math.max(0, ...this.hoppers.map((h) => h.score));

    for (const h of this.hoppers) {
      h.underdog = maxScore - h.score >= 150;
      if (h.calloutTimer > 0) h.calloutTimer = Math.max(0, h.calloutTimer - dt);
      if (h.splashShieldTimer > 0) h.splashShieldTimer = Math.max(0, h.splashShieldTimer - dt);
      if (h.bittenTimer > 0) {
        h.bittenTimer = Math.max(0, h.bittenTimer - dt);
        continue;
      }

      const sx = this.input.getSteer(h.id);
      const sy = this.input.getThrottle(h.id);
      const pCfg = this.getPlayer(h.id);
      const isBot = pCfg ? pCfg.type.startsWith('bot_') : false;
      const hasSteer = this.input.hasSteer(h.id);

      const justTap = this.input.justAction(h.id) || (isBot && this.input.justPressed(h.id)) || (!hasSteer && !isBot && this.input.justPressed(h.id));
      const isHold = this.input.isActionPressed(h.id) || (isBot && this.input.isPressed(h.id)) || (!hasSteer && !isBot && this.input.isPressed(h.id));

      const accel = 1350 * (h.underdog ? 1.15 : 1.0);
      h.vx += sx * accel * dt;
      h.vy += (sy !== 0 ? -sy : 0) * accel * dt;
      h.vx *= Math.pow(0.05, dt);
      h.vy *= Math.pow(0.05, dt);

      if (justTap && Math.abs(sy) < 0.2) {
        h.vy -= 260;
        this.audio.playTap();
      }

      // Hold-to-charge Bullfrog Super-Leap & Ripple Shunt (72%-98% Sweet Spot)
      if (isHold) {
        h.holding = true;
        h.charge = Math.min(1, h.charge + dt * 0.92);
      } else if (h.holding) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        if (sweet) {
          h.splashShieldTimer = 2.2;
          h.vy -= 420;
          h.score += 85;
          h.combo = Math.min(4, h.combo + 1);
          this.showCallout(h, 'BULLFROG SUPER-LEAP +85!');
          this.audio.playBoost();
          this.triggerHitStop(45, 11);

          for (const other of this.hoppers) {
            if (other.id !== h.id && Math.hypot(other.x - h.x, other.y - h.y) < 165) {
              const dx = other.x - h.x;
              const dy = other.y - h.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              other.vx += (dx / (d || 0.001)) * 520;
              other.vy += (dy / (d || 0.001)) * 520;
              h.score += 70;
              this.showCallout(h, 'RIVER SPLASH SHUNT +70!');
              this.audio.playBounce();
            }
          }
        } else if (h.charge > 0.98) {
          h.bittenTimer = 0.9;
          h.combo = 1;
          this.showCallout(h, 'BELLY FLOP!');
          this.audio.playStun();
        }
        h.holding = false;
        h.charge = 0;
      }

      h.x = Math.max(width * 0.08, Math.min(width * 0.92, h.x + h.vx * dt));
      h.y = Math.max(height * 0.12, Math.min(height * 0.88, h.y + h.vy * dt));

      // Carry on drifting logs and collect lotus/golden frogs
      for (const lg of this.logs) {
        if (Math.abs(h.y - lg.y) < 24 && Math.abs(h.x - lg.x) < lg.w * 0.55) {
          h.x += lg.vx * dt * 0.65;
          if (lg.hasGoldenFrog) {
            lg.hasGoldenFrog = false;
            const pts = 95 * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            h.combo = Math.min(4, h.combo + 1);
            this.showCallout(h, `GOLDEN FROG +${pts}!`);
            this.audio.playScore();
            setTimeout(() => {
              lg.hasGoldenFrog = true;
            }, 3500);
          } else if (lg.hasLotus) {
            lg.hasLotus = false;
            const pts = 45 * h.combo * (this.suddenDeath ? 2 : 1);
            h.score += pts;
            this.showCallout(h, `RIVER LOTUS +${pts}`);
            this.audio.playTap();
            setTimeout(() => {
              lg.hasLotus = true;
            }, 2500);
          }
        }
      }

      // Reaching top bank awards crossing bonus and resets to bottom bank
      if (h.y <= height * 0.16) {
        const pts = 110 * h.combo * (this.suddenDeath ? 2 : 1);
        h.score += pts;
        h.combo = Math.min(4, h.combo + 1);
        h.y = height * 0.86;
        this.showCallout(h, `BANK CROSSED +${pts}!`);
        this.audio.playChime();
        this.triggerHitStop(45, 11);
      }

      // Piranha hazards
      for (const pr of this.piranhas) {
        if (Math.hypot(h.x - pr.x, h.y - pr.y) < 28 && h.splashShieldTimer <= 0 && !h.underdog) {
          h.bittenTimer = 1.0;
          h.combo = 1;
          h.y = Math.min(height * 0.86, h.y + 70);
          this.showCallout(h, 'PIRANHA NIP!');
          this.audio.playStun();
          this.triggerHitStop(40, 10);
        }
      }
    }

    // Elastic Hopper-to-Hopper Bumping
    for (let i = 0; i < this.hoppers.length; i++) {
      for (let j = i + 1; j < this.hoppers.length; j++) {
        const a = this.hoppers[i];
        const b = this.hoppers[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 36) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 280;
          a.vy -= ny * 280;
          b.vx += nx * 280;
          b.vy += ny * 280;
          this.audio.playBounce();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.hoppers.find((h) => h.id === botId);
    if (!bot || bot.bittenTimer > 0) return;

    bot.botTimer -= dt;
    if (bot.botTimer <= 0) {
      bot.botTimer = difficulty === 'bot_hard' ? 0.18 : 0.26;
      bot.botChargeGoal = 0.76 + Math.random() * 0.18;
    }

    // Move upward toward top bank while steering toward nearest log
    bot.vy -= 920 * dt;
    const aheadLog = this.logs.find((lg) => Math.abs(lg.y - (bot.y - 45)) < 45);
    if (aheadLog) {
      bot.vx += Math.sign(aheadLog.x - bot.x) * 880 * dt;
    }

    const hold = !bot.holding || bot.charge < bot.botChargeGoal;
    this.input.setBotState(botId, hold);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[THEME_KEYS[this.themeIdx]];
    ctx.save();

    if (this.shakeTimer > 0) {
      const s = this.shakeIntensity * (this.shakeTimer / 0.22);
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, pal.waterTop);
    bg.addColorStop(1, pal.waterBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Top & Bottom Jungle Riverbanks
    ctx.fillStyle = pal.bankColor;
    ctx.fillRect(0, 46, width, height * 0.12);
    ctx.fillRect(0, height * 0.82, width, height * 0.18);

    // Drifting Logs
    for (const lg of this.logs) {
      ctx.save();
      ctx.translate(lg.x, lg.y);
      ctx.fillStyle = pal.logColor;
      ctx.beginPath();
      ctx.roundRect(-lg.w * 0.5, -14, lg.w, 28, 12);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (lg.hasGoldenFrog) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
      } else if (lg.hasLotus) {
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Leaping Piranhas
    for (const pr of this.piranhas) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐟', pr.x, pr.y + 4);
    }

    // Hoppers
    for (const h of this.hoppers) {
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.holding && h.charge > 0.05) {
        const sweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = sweet ? '#4ade80' : '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + h.charge * Math.PI * 2);
        ctx.stroke();
      }
      const mood = h.bittenTimer > 0 ? 'shocked' : h.splashShieldTimer > 0 ? 'triumph' : h.holding ? 'focused' : 'happy';
      this.drawPlayerMascot(ctx, h.id, 0, 0, 16, mood, this.timeElapsed, h.vx * 0.0005);
      if (h.calloutTimer > 0 && h.calloutText) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(h.calloutText, 0, -28);
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
      `🐸 PIRANHA RIVER HOP • ${pal.name} [T/1-3] • ${remaining}s ${this.suddenDeath ? '🔥 2X RAPIDS' : ''}`,
      width * 0.5,
      19
    );

    this.hoppers.forEach((h, idx) => {
      ctx.fillStyle = h.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`P${h.id}: ${Math.round(h.score)} pts (${h.combo}x)`, 90 + idx * 170, 38);
    });

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.hoppers].sort((a, b) => b.score - a.score);
    return {
      winnerId: sorted[0]?.id ?? 0,
      rankings: sorted.map((h, i) => ({
        playerId: h.id,
        score: Math.round(h.score),
        place: i + 1,
      })),
      mvpHighlight: `Rapids Crossing Champion ${Math.round(sorted[0]?.score ?? 0)} pts!`,
    };
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): boolean {
    if (this.isFinished) return false;
    if (y <= 48) {
      this.themeIdx = (this.themeIdx + 1) % THEME_KEYS.length;
      this.audio.playTap();
      return true;
    }
    const midX = width / 2;
    const active = this.hoppers.filter((h) => {
      const pCfg = this.getPlayer(h.id);
      return pCfg && !pCfg.type.startsWith('bot_');
    });
    const hopper = active.find((h) => (h.id === 0 ? x < midX : x >= midX)) || active[0];
    if (hopper && hopper.bittenTimer <= 0) {
      const dx = x - hopper.x;
      const dy = y - hopper.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      hopper.vx += (dx / (dist || 0.001)) * 440;
      hopper.vy += (dy / (dist || 0.001)) * 440;
      this.audio.playTap();
      return true;
    }
    return false;
  }
}
