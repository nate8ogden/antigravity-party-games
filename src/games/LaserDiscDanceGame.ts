import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type PadDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface StagePad {
  dir: PadDirection;
  x: number;
  y: number;
  color: string;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface DancerPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  combo: number;
  stunTimer: number;
  charge: number;
  isCharging: boolean;
  scoredCurrentBeat: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetX: number;
  botTargetY: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bg: string;
  discAccent: string;
  ringColor: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'disco_1982',
    name: '1982 Holographic LaserDisc',
    bg: '#090416',
    discAccent: '#ec4899',
    ringColor: '#38bdf8'
  },
  {
    id: 'tokyo_ddr',
    name: 'Shibuya Neon Stage',
    bg: '#02091c',
    discAccent: '#22c55e',
    ringColor: '#fde047'
  },
  {
    id: 'gold_vinyl',
    name: 'Studio 54 Gold Vinyl',
    bg: '#170b02',
    discAccent: '#f59e0b',
    ringColor: '#fbbf24'
  }
];

export class LaserDiscDanceGame extends BaseGame {
  private playersState: Map<PlayerId, DancerPlayer> = new Map();
  private pads: StagePad[] = [];
  private callouts: FloatingCallout[] = [];
  private discAngle = 0;
  private activeDir: PadDirection = 'UP';
  private goldenDir: PadDirection = 'RIGHT';
  private beatProgress = 0; // 0.0 -> 1.0
  private beatSpeed = 0.72;
  private hitStopTimer = 0;
  private suddenDeath = false;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeHotkeys();
    this.reset(width, height);
  }

  private setupThemeHotkeys(): void {
    if (typeof window === 'undefined' || this.keyHandler) return;
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      } else if (e.key === '1') {
        this.themeIndex = 0;
      } else if (e.key === '2') {
        this.themeIndex = 1;
      } else if (e.key === '3') {
        this.themeIndex = 2;
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.playersState.clear();
    this.callouts = [];
    this.discAngle = 0;
    this.beatProgress = 0;
    this.beatSpeed = 0.75;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const cx = width / 2;
    const cy = height / 2 + 12;
    const padDist = Math.min(width, height) * 0.31;

    this.pads = [
      { dir: 'UP', x: cx, y: cy - padDist, color: '#38bdf8' },
      { dir: 'DOWN', x: cx, y: cy + padDist, color: '#ec4899' },
      { dir: 'LEFT', x: cx - padDist * 1.25, y: cy, color: '#22c55e' },
      { dir: 'RIGHT', x: cx + padDist * 1.25, y: cy, color: '#fbbf24' }
    ];

    this.pickNextBeat();

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ang = (idx / Math.max(1, active.length)) * Math.PI * 2;
      const sx = cx + Math.cos(ang) * 50;
      const sy = cy + Math.sin(ang) * 50;
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        score: 0,
        combo: 1,
        stunTimer: 0,
        charge: 0,
        isCharging: false,
        scoredCurrentBeat: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: sx,
        botTargetY: sy
      });
    });
  }

  private pickNextBeat(): void {
    const dirs: PadDirection[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    this.activeDir = dirs[Math.floor(Math.random() * dirs.length)];
    const others = dirs.filter((d) => d !== this.activeDir);
    this.goldenDir = others[Math.floor(Math.random() * others.length)];
    for (const ps of this.playersState.values()) {
      ps.scoredCurrentBeat = false;
    }
  }

  private addCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, vy: -38, text, color, life: 0.9 });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.beatSpeed = 1.05;
      this.audio.playBoost();
      this.addCallout(width / 2, height * 0.2, 'ENCORE FEVER! 2X GROOVE!', '#fde047');
    }

    this.updateBots(dt, width, height);
    this.discAngle += dt * (this.suddenDeath ? 5.2 : 3.4);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 100;
    }

    // Advance expanding LaserDisc Beat Ring
    this.beatProgress += this.beatSpeed * dt;
    if (this.beatProgress >= 1.0) {
      this.beatProgress = 0;
      // Auto-score any player standing on the active pad at beat impact!
      const activePad = this.pads.find((p) => p.dir === this.activeDir);
      const goldPad = this.pads.find((p) => p.dir === this.goldenDir);

      for (const ps of this.playersState.values()) {
        if (ps.scoredCurrentBeat || ps.stunTimer > 0) continue;
        if (activePad && Math.hypot(ps.x - activePad.x, ps.y - activePad.y) < 44) {
          const pts = 35 * ps.combo * (this.suddenDeath ? 2 : 1);
          ps.score += pts;
          ps.combo = Math.min(4, ps.combo + 1);
          this.audio.playScore();
          this.particles.emit(activePad.x, activePad.y, 16, activePad.color);
          this.addCallout(ps.x, ps.y - 20, `ON BEAT! +${pts} (${ps.combo}x)`, activePad.color);
        } else if (goldPad && Math.hypot(ps.x - goldPad.x, ps.y - goldPad.y) < 42) {
          const pts = 45 * (this.suddenDeath ? 2 : 1);
          ps.score += pts;
          this.audio.playScore();
          this.addCallout(ps.x, ps.y - 20, `FREESTYLE PAD! +${pts}`, '#fbbf24');
        } else {
          ps.combo = 1;
        }
      }

      this.audio.playTone(440, 0.09);
      this.pickNextBeat();
    }

    // Update Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) ps.stunTimer -= dt;

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const throttle = ps.stunTimer > 0 ? 0 : this.input.getThrottle(p.id);
      const isBot = p.type.startsWith('bot_');
      const actionHeld = ps.stunTimer <= 0 && (this.input.isActionPressed(p.id) || (isBot && this.input.isPressed(p.id)));

      const moveSpeed = 760 * (ps.underdog ? 1.18 : 1.0);
      ps.vx += steer * moveSpeed * dt;
      ps.vy += -throttle * moveSpeed * dt;

      // Hold-to-charge Bass-Drop Moonwalk & Boogie Shunt (72% - 98%)
      if (actionHeld) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.92);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        const activePad = this.pads.find((pad) => pad.dir === this.activeDir);
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          if (activePad) {
            const ang = Math.atan2(activePad.y - ps.y, activePad.x - ps.x);
            ps.vx += Math.cos(ang) * 420;
            ps.vy += Math.sin(ang) * 420;
          }
          const bonus = this.suddenDeath ? 95 : 65;
          ps.score += bonus;
          ps.combo = Math.min(4, ps.combo + 1);
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.3);
          this.particles.emit(ps.x, ps.y, 22, '#fde047');
          this.addCallout(ps.x, ps.y - 26, `BASS-DROP MOONWALK! +${bonus}`, '#fde047');

          // Boogie Shunt nearby rivals off the active pad!
          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.hypot(rival.x - ps.x, rival.y - ps.y) < 105) {
              const ang = Math.atan2(rival.y - ps.y, rival.x - ps.x);
              rival.vx += Math.cos(ang) * 380;
              rival.vy += Math.sin(ang) * 380;
              rival.stunTimer = 0.65;
              ps.score += 50;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 20, 'BOOGIE SHUNT! +50', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.45;
          this.audio.playBuzzer();
        } else if (activePad && Math.hypot(ps.x - activePad.x, ps.y - activePad.y) < 46 && !ps.scoredCurrentBeat) {
          // Early tap on pad
          ps.scoredCurrentBeat = true;
          const pts = 30 * ps.combo;
          ps.score += pts;
          this.audio.playScore();
          this.addCallout(ps.x, ps.y - 18, `GROOVE TAP! +${pts}`, activePad.color);
        }
        ps.charge = 0;
      }

      ps.vx *= Math.pow(0.015, dt);
      ps.vy *= Math.pow(0.015, dt);
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;
      ps.x = Math.max(36, Math.min(width - 36, ps.x));
      ps.y = Math.max(54, Math.min(height - 34, ps.y));
    }

    // Dancer-to-Dancer Stage Collisions
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 32) {
          const nx = dx / dist;
          const ny = dy / dist;
          a.vx -= nx * 240;
          a.vy -= ny * 240;
          b.vx += nx * 240;
          b.vy += ny * 240;
          this.audio.playBounce();
        }
      }
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer <= 0) {
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.34 : difficulty === 'bot_normal' ? 0.22 : 0.12;
      const targetPad = this.pads.find((p) => p.dir === this.activeDir);
      if (targetPad) {
        const jitter = difficulty === 'bot_easy' ? 32 : difficulty === 'bot_normal' ? 14 : 4;
        ps.botTargetX = targetPad.x + (Math.random() - 0.5) * jitter;
        ps.botTargetY = targetPad.y + (Math.random() - 0.5) * jitter;
      }
    }

    const dx = ps.botTargetX - ps.x;
    const dy = ps.botTargetY - ps.y;
    const dist = Math.hypot(dx, dy) || 1;
    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (Math.random() < 0.03) {
      press = true;
    }

    this.input.setBotInput(botId, press, dx / dist, -dy / dist);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];
    const cx = width / 2;
    const cy = height / 2 + 12;
    const discRadius = Math.min(width, height) * 0.34;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, width, height);

    // Spinning Holographic LaserDisc
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.discAngle);
    const grad = ctx.createRadialGradient(0, 0, 18, 0, 0, discRadius);
    grad.addColorStop(0, '#e2e8f0');
    grad.addColorStop(0.35, '#38bdf8');
    grad.addColorStop(0.68, theme.discAccent);
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, discRadius, 0, Math.PI * 2);
    ctx.fill();

    // Grooves
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    for (let r = 28; r < discRadius - 8; r += 14) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Expanding Beat Pulse Ring
    ctx.strokeStyle = theme.ringColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 18 + this.beatProgress * discRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Illuminated Stage Pads
    for (const pad of this.pads) {
      const isLit = pad.dir === this.activeDir;
      const isGold = pad.dir === this.goldenDir;
      ctx.save();
      ctx.translate(pad.x, pad.y);
      ctx.fillStyle = isLit ? pad.color : isGold ? 'rgba(251, 191, 36, 0.35)' : 'rgba(15, 23, 42, 0.78)';
      ctx.strokeStyle = isLit ? '#ffffff' : pad.color;
      ctx.lineWidth = isLit ? 3.5 : 2;
      ctx.beginPath();
      ctx.arc(0, 0, isLit ? 32 : 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isLit ? '#020617' : '#f8fafc';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pad.dir, 0, 4);
      ctx.restore();
    }

    // Dancers
    for (const ps of this.playersState.values()) {
      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = ps.stunTimer > 0 ? '#64748b' : ps.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score} (${ps.combo}x)`, 0, 26);
      ctx.restore();
    }

    for (const c of this.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
      ctx.fillStyle = c.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(9, 4, 22, 0.8)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Dance To Lit Pad • Hold (72-98%): Bass-Drop Moonwalk & Shunt', width - 14, 22);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.values())
      .sort((a, b) => b.score - a.score)
      .map((ps, idx) => ({
        playerId: ps.id,
        score: Math.round(ps.score),
        place: idx + 1
      }));

    return {
      winnerId: rankings[0]?.playerId ?? null,
      rankings,
      mvpHighlight: 'Owned the Holographic LaserDisc Stage with Bass-Drop Moonwalks!'
    };
  }

  public handlePointerDown(x: number, y: number, _width: number, _height: number): boolean {
    if (y <= 42 && x <= 260) {
      this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      this.audio.playSelect();
      return true;
    }
    return false;
  }
}
