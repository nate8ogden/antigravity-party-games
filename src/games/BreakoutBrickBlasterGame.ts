import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  points: number;
  hp: number;
  maxHp: number;
  isTNT: boolean;
  alive: boolean;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  lastHitter: PlayerId | null;
  supernovaTimer: number;
}

interface PowerCapsule {
  x: number;
  y: number;
  vy: number;
  type: 'MULTI_BALL' | 'WIDE_PADDLE' | 'BONUS_GOLD';
  color: string;
  label: string;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface PaddlePlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  baseWidth: number;
  wideTimer: number;
  stunTimer: number;
  score: number;
  combo: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botReactionTimer: number;
  botTargetX: number;
}

interface ThemePalette {
  id: string;
  name: string;
  bgTop: string;
  bgBot: string;
  frameStroke: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'arkanoid_prime',
    name: 'Arkanoid Cosmic Neon',
    bgTop: '#020617',
    bgBot: '#0f172a',
    frameStroke: '#38bdf8'
  },
  {
    id: 'prism_glass',
    name: 'Crystal Prism Vault',
    bgTop: '#160424',
    bgBot: '#090212',
    frameStroke: '#ec4899'
  },
  {
    id: 'synth_gold',
    name: 'Imperial Gold Breaker',
    bgTop: '#180d03',
    bgBot: '#0c0602',
    frameStroke: '#fbbf24'
  }
];

export class BreakoutBrickBlasterGame extends BaseGame {
  private playersState: Map<PlayerId, PaddlePlayer> = new Map();
  private bricks: Brick[] = [];
  private balls: Ball[] = [];
  private capsules: PowerCapsule[] = [];
  private callouts: FloatingCallout[] = [];
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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.playersState.clear();
    this.bricks = [];
    this.balls = [];
    this.capsules = [];
    this.callouts = [];
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const paddleW = Math.max(58, (width - 70) / (count * 1.45));
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const startX = spacing * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: startX,
        y: height - 42,
        vx: 0,
        baseWidth: paddleW,
        wideTimer: 0,
        stunTimer: 0,
        score: 0,
        combo: 1,
        charge: 0,
        isCharging: false,
        underdog: false,
        botReactionTimer: 0,
        botTargetX: startX
      });
    });

    this.spawnBall(width, height, active[0]?.id ?? null);
    this.buildBrickFortress(width);
  }

  private spawnBall(width: number, height: number, owner: PlayerId | null): void {
    this.balls.push({
      x: width / 2 + (Math.random() - 0.5) * 40,
      y: height - 115,
      vx: Math.random() < 0.5 ? 210 : -210,
      vy: -265,
      radius: 7,
      lastHitter: owner,
      supernovaTimer: 0
    });
  }

  private buildBrickFortress(width: number): void {
    this.bricks = [];
    const rows = 5;
    const cols = 8;
    const brickW = (width - 44) / cols;
    const brickH = 16;
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
    const points = [25, 20, 15, 12, 10];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isTNT = r === 2 && (c === 2 || c === 5);
        const isArmor = r === 0 && c % 2 === 1;
        this.bricks.push({
          x: 22 + c * brickW,
          y: 52 + r * (brickH + 5),
          w: brickW - 5,
          h: brickH,
          color: isTNT ? '#f43f5e' : isArmor ? '#94a3b8' : colors[r],
          points: isTNT ? 40 : isArmor ? 35 : points[r],
          hp: isArmor ? 2 : 1,
          maxHp: isArmor ? 2 : 1,
          isTNT,
          alive: true
        });
      }
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
      this.spawnBall(width, height, null);
      this.audio.playBoost();
      this.addCallout(width / 2, height * 0.42, 'MULTI-BALL FRENZY! 2X BRICKS!', '#fde047');
    }

    this.updateBots(dt, width, height);

    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 95;
    }

    // Update Balls
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const ball = this.balls[bi];
      if (ball.supernovaTimer > 0) ball.supernovaTimer -= dt;

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x - ball.radius < 12) {
        ball.x = 12 + ball.radius;
        ball.vx = Math.abs(ball.vx);
        this.audio.playBounce();
      }
      if (ball.x + ball.radius > width - 12) {
        ball.x = width - 12 - ball.radius;
        ball.vx = -Math.abs(ball.vx);
        this.audio.playBounce();
      }
      if (ball.y - ball.radius < 42) {
        ball.y = 42 + ball.radius;
        ball.vy = Math.abs(ball.vy);
        this.audio.playBounce();
      }

      if (ball.y > height + 18) {
        if (this.balls.length > 1) {
          this.balls.splice(bi, 1);
          continue;
        } else {
          ball.x = width / 2;
          ball.y = height - 120;
          ball.vx = Math.random() < 0.5 ? 210 : -210;
          ball.vy = -265;
          ball.supernovaTimer = 0;
          this.audio.playBuzzer();
        }
      }

      // Brick Collisions
      for (const b of this.bricks) {
        if (!b.alive) continue;
        if (
          ball.x + ball.radius >= b.x &&
          ball.x - ball.radius <= b.x + b.w &&
          ball.y + ball.radius >= b.y &&
          ball.y - ball.radius <= b.y + b.h
        ) {
          b.hp--;
          if (ball.supernovaTimer <= 0) {
            ball.vy *= -1;
          }
          if (b.hp <= 0 || ball.supernovaTimer > 0) {
            b.alive = false;
            const hitter = ball.lastHitter ? this.playersState.get(ball.lastHitter) : null;
            const mult = this.suddenDeath ? 2 : 1;
            if (hitter) {
              const pts = b.points * mult;
              hitter.score += pts;
              hitter.combo = Math.min(4, hitter.combo + 1);
            }

            // TNT chain explosion!
            if (b.isTNT) {
              this.hitStopTimer = 0.045;
              this.particles.shake(0.32);
              for (const nb of this.bricks) {
                if (nb.alive && Math.hypot(nb.x - b.x, nb.y - b.y) < 75) {
                  nb.alive = false;
                  if (hitter) hitter.score += 18;
                  this.particles.emit(nb.x + nb.w / 2, nb.y + nb.h / 2, 8, '#f97316');
                }
              }
              this.addCallout(b.x + b.w / 2, b.y, 'TNT CHAIN BLAST!', '#f43f5e');
            }

            // Chance to drop a Neon Power Capsule
            if (Math.random() < 0.24) {
              const roll = Math.random();
              const type: PowerCapsule['type'] =
                roll < 0.34 ? 'MULTI_BALL' : roll < 0.68 ? 'WIDE_PADDLE' : 'BONUS_GOLD';
              this.capsules.push({
                x: b.x + b.w / 2,
                y: b.y + b.h / 2,
                vy: 135,
                type,
                color: type === 'MULTI_BALL' ? '#38bdf8' : type === 'WIDE_PADDLE' ? '#22c55e' : '#fbbf24',
                label: type === 'MULTI_BALL' ? 'M' : type === 'WIDE_PADDLE' ? 'W' : '$'
              });
            }

            this.audio.playExplosion();
            this.particles.emit(b.x + b.w / 2, b.y + b.h / 2, 12, b.color);
          } else {
            this.audio.playBounce();
          }
          break;
        }
      }
    }

    // Update Power Capsules
    for (let ci = this.capsules.length - 1; ci >= 0; ci--) {
      const cap = this.capsules[ci];
      cap.y += cap.vy * dt;
      if (cap.y > height + 20) {
        this.capsules.splice(ci, 1);
        continue;
      }
      for (const ps of this.playersState.values()) {
        const w = ps.baseWidth * (ps.wideTimer > 0 ? 1.4 : 1);
        if (Math.abs(cap.y - ps.y) < 16 && Math.abs(cap.x - ps.x) <= w / 2 + 10) {
          if (cap.type === 'MULTI_BALL') {
            this.spawnBall(width, height, ps.id);
            ps.score += 40;
            this.addCallout(ps.x, ps.y - 22, 'MULTI-BALL CAPSULE! +40', '#38bdf8');
          } else if (cap.type === 'WIDE_PADDLE') {
            ps.wideTimer = 6.0;
            ps.score += 35;
            this.addCallout(ps.x, ps.y - 22, 'MEGA PADDLE! +35', '#22c55e');
          } else {
            ps.score += 65;
            this.addCallout(ps.x, ps.y - 22, 'GOLD CAPSULE! +65', '#fbbf24');
          }
          this.audio.playBoost();
          this.particles.emit(ps.x, ps.y, 16, cap.color);
          this.capsules.splice(ci, 1);
          break;
        }
      }
    }

    // Update Players & Paddle Volley
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.wideTimer > 0) ps.wideTimer -= dt;
      if (ps.stunTimer > 0) ps.stunTimer -= dt;

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const isPressed = ps.stunTimer <= 0 && this.input.isPressed(p.id);

      // Hold-to-charge Supernova Smash Volley & Magnetic Shunt (72% - 98%)
      if (isPressed) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * 0.9);
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          ps.score += 45;
          for (const ball of this.balls) {
            if (Math.hypot(ball.x - ps.x, ball.y - ps.y) < 110) {
              ball.vy = -340;
              ball.lastHitter = ps.id;
              ball.supernovaTimer = 3.0;
            }
          }
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.28);
          this.particles.emit(ps.x, ps.y, 20, '#fde047');
          this.addCallout(ps.x, ps.y - 26, 'SUPERNOVA SMASH! +45', '#fde047');

          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            if (Math.abs(rival.x - ps.x) < 105) {
              rival.vx += (rival.x >= ps.x ? 1 : -1) * 340;
              rival.stunTimer = 0.55;
              ps.score += 45;
              this.audio.playBounce();
              this.addCallout(rival.x, rival.y - 18, 'MAGNETIC SHUNT! +45', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          ps.stunTimer = 0.45;
          this.audio.playBuzzer();
        }
        ps.charge = 0;
      }

      const speedMult = ps.underdog ? 1.18 : 1.0;
      ps.vx += steer * 1150 * speedMult * dt;
      ps.vx *= Math.pow(0.01, dt);
      ps.x += ps.vx * dt;

      const curW = ps.baseWidth * (ps.wideTimer > 0 ? 1.4 : 1);
      ps.x = Math.max(curW / 2 + 14, Math.min(width - curW / 2 - 14, ps.x));

      for (const ball of this.balls) {
        if (
          ball.vy > 0 &&
          ball.y + ball.radius >= ps.y - 8 &&
          ball.y - ball.radius <= ps.y + 8 &&
          ball.x >= ps.x - curW / 2 - 4 &&
          ball.x <= ps.x + curW / 2 + 4
        ) {
          ball.vy = -Math.max(265, Math.abs(ball.vy));
          const hitOffset = (ball.x - ps.x) / (curW / 2);
          ball.vx = hitOffset * 300;
          ball.lastHitter = p.id;
          ps.score += 10;
          this.audio.playBounce();
          this.particles.emit(ball.x, ball.y, 10, p.color);
        }
      }
    }

    // Paddle-to-Paddle Bump
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const minDist = (a.baseWidth + b.baseWidth) * 0.42;
        const dx = b.x - a.x;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          a.vx -= sign * 220;
          b.vx += sign * 220;
          this.audio.playBounce();
        }
      }
    }

    if (this.bricks.every((b) => !b.alive)) {
      this.buildBrickFortress(width);
      this.audio.playScore();
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
      ps.botReactionTimer = difficulty === 'bot_easy' ? 0.28 : difficulty === 'bot_normal' ? 0.18 : 0.1;
      const targetBall = this.balls[0];
      if (targetBall) {
        const jitter = difficulty === 'bot_easy' ? 36 : difficulty === 'bot_normal' ? 16 : 5;
        ps.botTargetX = targetBall.x + (Math.random() - 0.5) * jitter;
      }
    }

    const dx = ps.botTargetX - ps.x;
    const steer = Math.abs(dx) > 10 ? Math.sign(dx) : 0;
    let press = false;
    if (ps.isCharging) {
      press = ps.charge < 0.82;
    } else if (Math.random() < 0.03) {
      press = true;
    }

    this.input.setBotInput(botId, press, steer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, theme.bgTop);
    bg.addColorStop(1, theme.bgBot);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = theme.frameStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 40, width - 20, height - 46);

    // Bricks
    for (const b of this.bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(b.x, b.y, b.w, 3);
      if (b.isTNT) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TNT', b.x + b.w / 2, b.y + 11);
      }
    }

    // Power Capsules
    for (const cap of this.capsules) {
      ctx.fillStyle = cap.color;
      ctx.beginPath();
      ctx.roundRect(cap.x - 12, cap.y - 7, 24, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#020617';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cap.label, cap.x, cap.y + 3.5);
    }

    // Paddles
    for (const ps of this.playersState.values()) {
      const curW = ps.baseWidth * (ps.wideTimer > 0 ? 1.4 : 1);
      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = ps.stunTimer > 0 ? '#64748b' : ps.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-curW / 2, -6, curW, 12, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name}: ${ps.score}`, 0, 22);
      ctx.restore();
    }

    // Balls
    for (const ball of this.balls) {
      ctx.fillStyle = ball.supernovaTimer > 0 ? '#fde047' : '#ffffff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.supernovaTimer > 0 ? 9 : ball.radius, 0, Math.PI * 2);
      ctx.fill();
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

    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`, 14, 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Steer: Slide Paddle & Catch Capsules • Hold (72-98%): Supernova Smash', width - 14, 22);
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
      mvpHighlight: 'Shattered the Rainbow Brick Fortress with Supernova Volleys!'
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}
