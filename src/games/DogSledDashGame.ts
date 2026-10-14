import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { CharacterMood } from '../core/CharacterRenderer';

interface SledTheme {
  id: string;
  name: string;
  skyTop: string;
  snowTop: string;
  snowTrack: string;
  divider: string;
  accent: string;
}

const THEMES: SledTheme[] = [
  {
    id: 'iditarod_tundra',
    name: 'Iditarod Tundra Trail',
    skyTop: '#0f172a',
    snowTop: '#f0f9ff',
    snowTrack: '#e0f2fe',
    divider: '#7dd3fc',
    accent: '#38bdf8',
  },
  {
    id: 'yukon_gold',
    name: 'Yukon Sunset Pass',
    skyTop: '#31102f',
    snowTop: '#fff7ed',
    snowTrack: '#ffedd5',
    divider: '#fdba74',
    accent: '#fb923c',
  },
  {
    id: 'aurora_pine',
    name: 'Northern Pine Run',
    skyTop: '#022c22',
    snowTop: '#f0fdf4',
    snowTrack: '#dcfce7',
    divider: '#6ee7b7',
    accent: '#34d399',
  },
];

interface TrailEntity {
  id: number;
  x: number;
  y: number;
  type: 'crevasse' | 'spruce_log' | 'serum_crate' | 'golden_trophy';
  radius: number;
  hitBy: Set<PlayerId>;
}

interface FxParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

interface MusherSled {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  zHeight: number;
  vz: number;
  radius: number;
  score: number;
  combo: number;
  isHolding: boolean;
  charge: number;
  overchargeTimer: number;
  dashTimer: number;
  gallopPhase: number;
  drafting: boolean;
  botTimer: number;
  botTargetX: number;
  botTargetY: number;
  botHoldTarget: number;
}

export class DogSledDashGame extends BaseGame {
  private floatingTexts: { x: number; y: number; text: string; color: string; alpha: number; vy: number; size: number }[] = [];
  public mushers: Map<PlayerId, MusherSled> = new Map();
  private entities: TrailEntity[] = [];
  private fxParticles: FxParticle[] = [];
  private nextEntityId = 1;
  private spawnTimer = 0.6;

  private themeIndex = 0;
  private elapsed = 0;
  private hitStopTimer = 0;
  private screenShake = 0;
  private suddenDeath = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public get currentMapName(): string {
    return THEMES[this.themeIndex]?.name ?? 'Iditarod Tundra Trail';
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    if (typeof window === 'undefined') return;
    this.cleanupThemeControls();

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

    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx = (e.clientX - rect.left) * scaleX;
      const cy = (e.clientY - rect.top) * scaleY;

      const px = 20;
      const py = canvas.height - 44;
      const pw = 170;
      const ph = 32;
      if (cx >= px && cx <= px + pw && cy >= py && cy <= py + ph) {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
        this.audio.playTap();
      }
    };

    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private cleanupThemeControls(): void {
    if (typeof window === 'undefined') return;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public cleanup(): void {
    this.cleanupThemeControls();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.elapsed = 0;
    this.hitStopTimer = 0;
    this.screenShake = 0;
    this.suddenDeath = false;
    this.entities = [];
    this.fxParticles = [];
    this.mushers.clear();

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    active.forEach((p, idx) => {
      const sx = width * 0.22 + (idx % 2) * 55;
      const sy = height * (0.28 + (idx / Math.max(1, count - 1 || 1)) * 0.48);
      this.mushers.set(p.id, {
        id: p.id,
        x: sx,
        y: sy,
        vx: 0,
        vy: 0,
        zHeight: 0,
        vz: 0,
        radius: 24,
        score: 0,
        combo: 1,
        isHolding: false,
        charge: 0,
        overchargeTimer: 0,
        dashTimer: 0,
        gallopPhase: Math.random() * Math.PI * 2,
        drafting: false,
        botTimer: 0.2 + Math.random() * 0.2,
        botTargetX: sx,
        botTargetY: sy,
        botHoldTarget: 0,
      });
    });

    for (let i = 0; i < 5; i++) {
      this.spawnEntity(width, height, true);
    }
  }

  private triggerScreenShake(amount: number): void {
    this.screenShake = Math.min(18, Math.max(this.screenShake, amount));
  }

  private applyScreenShake(ctx: CanvasRenderingContext2D): void {
    if (this.screenShake > 0.2) {
      const dx = (Math.random() - 0.5) * this.screenShake * 1.6;
      const dy = (Math.random() - 0.5) * this.screenShake * 1.6;
      ctx.translate(dx, dy);
    }
  }

  private emitFx(x: number, y: number, color: string, count = 12, speed = 150): void {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.fxParticles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.3,
      });
    }
  }

  private spawnEntity(width: number, height: number, randomX = false): void {
    const roll = Math.random();
    const type: TrailEntity['type'] =
      roll < (this.suddenDeath ? 0.28 : 0.18)
        ? 'golden_trophy'
        : roll < 0.52
        ? 'serum_crate'
        : roll < 0.76
        ? 'crevasse'
        : 'spruce_log';

    const sx = randomX ? width * (0.38 + Math.random() * 0.55) : width + 45;
    const sy = height * (0.22 + Math.random() * 0.58);
    this.entities.push({
      id: this.nextEntityId++,
      x: sx,
      y: sy,
      type,
      radius: type === 'crevasse' ? 22 : 18,
      hitBy: new Set(),
    });
  }

  private getMaxScore(): number {
    let max = 0;
    this.mushers.forEach((m) => {
      if (m.score > max) max = m.score;
    });
    return max;
  }

  private isUnderdog(m: MusherSled): boolean {
    return this.getMaxScore() - m.score >= 150;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    const safeDt = Math.min(0.05, dt);
    this.elapsed += safeDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - safeDt * 28);
    }

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= safeDt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - safeDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupThemeControls();
      return;
    }

    if (this.roundTimer <= 12.0 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.triggerScreenShake(10);
      this.audio.playExplosion();
      this.addFloatingText(width * 0.5, height * 0.18, '⚡ SUDDEN DEATH: BLIZZARD SPRINT! ⚡', '#facc15', 22);
    }

    this.spawnTimer -= safeDt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.suddenDeath ? 0.55 : 0.85;
      if (this.entities.length < 12) {
        this.spawnEntity(width, height, false);
      }
    }

    this.updateBots(safeDt, width, height);

    const scrollSpeed = this.suddenDeath ? 275 : 220;

    // Update Musher Sleds
    this.mushers.forEach((m) => {
      const p = this.getPlayer(m.id);
      if (m.overchargeTimer > 0) m.overchargeTimer = Math.max(0, m.overchargeTimer - safeDt);
      if (m.dashTimer > 0) m.dashTimer = Math.max(0, m.dashTimer - safeDt);
      m.gallopPhase += safeDt * (m.dashTimer > 0 ? 22 : 15);

      // Slipstream drafting behind a leading sled
      m.drafting = false;
      this.mushers.forEach((other) => {
        if (other.id === m.id) return;
        if (other.x > m.x + 25 && other.x < m.x + 150 && Math.abs(other.y - m.y) < 34) {
          m.drafting = true;
        }
      });

      const underdog = this.isUnderdog(m);
      const speedMult =
        (underdog ? 1.18 : 1.0) *
        (m.drafting ? 1.24 : 1.0) *
        (m.overchargeTimer > 0 ? 0.55 : 1.0);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(m.id), y: -this.input.getThrottle(m.id) };
        if (Math.hypot(move.x, move.y) > 0.08) {
          m.vx += move.x * 740 * speedMult * safeDt;
          m.vy += move.y * 740 * speedMult * safeDt;
        }

        const holding = this.input.isActionPressed(m.id) || this.input.isPressed(m.id);
        if (holding && m.overchargeTimer <= 0) {
          m.isHolding = true;
          m.charge = Math.min(1.15, m.charge + safeDt * 0.85);
          if (m.charge >= 1.05) {
            this.triggerTangleStun(m);
          }
        } else if (m.isHolding) {
          m.isHolding = false;
          if (m.charge >= 0.72 && m.charge <= 0.98) {
            this.executeBlizzCharge(m);
          } else {
            this.executeMushLeap(m);
          }
          m.charge = 0;
        } else if (this.input.justPressed(m.id) || this.input.justAction(m.id)) {
          this.executeMushLeap(m);
        }
      }

      // Jump arc physics
      if (m.zHeight > 0 || m.vz !== 0) {
        m.zHeight += m.vz * safeDt;
        m.vz -= 920 * safeDt;
        if (m.zHeight <= 0) {
          m.zHeight = 0;
          m.vz = 0;
          this.emitFx(m.x, m.y + 8, '#ffffff', 6, 100);
        }
      }

      m.x += m.vx * safeDt;
      m.y += m.vy * safeDt;
      const damp = Math.pow(0.09, safeDt);
      m.vx *= damp;
      m.vy *= damp;

      // Keep inside shared snowfield bounds
      const minX = 75;
      const maxX = width * 0.74;
      const minY = 115;
      const maxY = height - 70;
      if (m.x < minX) {
        m.x = minX;
        m.vx = Math.abs(m.vx) * 0.4;
      } else if (m.x > maxX) {
        m.x = maxX;
        m.vx = -Math.abs(m.vx) * 0.4;
      }
      if (m.y < minY) {
        m.y = minY;
        m.vy = Math.abs(m.vy) * 0.4;
      } else if (m.y > maxY) {
        m.y = maxY;
        m.vy = -Math.abs(m.vy) * 0.4;
      }
    });

    // Elastic Sled-to-Sled Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.mushers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = a.radius + b.radius;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const impulse = -velAlongNormal * 1.2;
            a.vx -= nx * (impulse + 140);
            a.vy -= ny * (impulse + 140);
            b.vx += nx * (impulse + 140);
            b.vy += ny * (impulse + 140);
            this.audio.playBounce();
            this.emitFx((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#ffffff', 10, 140);
          }
        }
      }
    }

    // Update trail entities
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.x -= scrollSpeed * safeDt;

      let removeEntity = false;
      this.mushers.forEach((m) => {
        if (removeEntity || e.hitBy.has(m.id)) return;
        const d = Math.hypot(m.x + 12 - e.x, m.y - e.y);
        if (d < m.radius + e.radius) {
          if (e.type === 'serum_crate' || e.type === 'golden_trophy') {
            removeEntity = true;
            const basePts = e.type === 'golden_trophy' ? 90 : 45;
            const mult = Math.min(4, m.combo);
            const total = basePts * mult;
            m.score += total;
            m.combo = Math.min(4, m.combo + 1);
            this.audio.playScore();
            const col = e.type === 'golden_trophy' ? '#facc15' : '#38bdf8';
            this.emitFx(e.x, e.y, col, 16, 170);
            this.addFloatingText(
              e.x,
              e.y - 24,
              e.type === 'golden_trophy' ? `🏆 IDITAROD TROPHY! +${total}` : `📦 SERUM CRATE! +${total}`,
              col,
              16
            );
          } else {
            // Obstacle: crevasse or spruce_log
            e.hitBy.add(m.id);
            if (m.zHeight > 16 || m.dashTimer > 0) {
              // Cleared obstacle with a Mush Leap or Blizz-Charge!
              const bonus = 40 * Math.min(4, m.combo);
              m.score += bonus;
              m.combo = Math.min(4, m.combo + 1);
              this.audio.playTone(720, 0.1, 'sine');
              this.emitFx(e.x, e.y, '#34d399', 12, 150);
              this.addFloatingText(e.x, e.y - 24, `🐕 MUSH LEAP! +${bonus}`, '#34d399', 15);
            } else if (!this.isUnderdog(m)) {
              m.overchargeTimer = 0.95;
              m.combo = 1;
              m.score = Math.max(0, m.score - 20);
              m.vx -= 220;
              this.triggerScreenShake(7);
              this.audio.playExplosion();
              this.emitFx(e.x, e.y, '#ef4444', 16, 180);
              this.addFloatingText(e.x, e.y - 24, '💥 TRAIL CRASH! -20', '#ef4444', 15);
            }
          }
        }
      });

      if (removeEntity || e.x < -60) {
        this.entities.splice(i, 1);
      }
    }

    // Update FX particles
    for (let i = this.fxParticles.length - 1; i >= 0; i--) {
      const p = this.fxParticles[i];
      p.life += safeDt;
      p.x += p.vx * safeDt;
      p.y += p.vy * safeDt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.fxParticles.splice(i, 1);
      }
    }
  }

  private executeMushLeap(m: MusherSled): void {
    if (m.zHeight <= 2) {
      m.vz = 340;
      m.vx += 130;
      this.audio.playWhoosh();
      this.emitFx(m.x - 18, m.y + 8, '#e0f2fe', 10, 130);
    }
  }

  private executeBlizzCharge(m: MusherSled): void {
    m.dashTimer = 0.85;
    m.vz = 320;
    m.vx += 340;
    m.score += 85;
    m.combo = Math.min(4, m.combo + 1);

    this.hitStopTimer = 0.045;
    this.triggerScreenShake(11);
    this.audio.playBoost();
    this.emitFx(m.x, m.y, '#facc15', 22, 240);
    this.addFloatingText(m.x, m.y - 34, '🐕 LEAD-HUSKY BLIZZ-CHARGE! +85', '#facc15', 18);

    // Snow-Wake Shunt blasts rival sleds sideways!
    const underdog = this.isUnderdog(m);
    this.mushers.forEach((other) => {
      if (other.id === m.id) return;
      const dx = other.x - m.x;
      const dy = other.y - m.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 190) {
        const pushA = Math.atan2(dy, dx);
        const force = underdog ? 580 : 460;
        other.vx += Math.cos(pushA) * force;
        other.vy += Math.sin(pushA) * force;
        m.score += 70;
        this.addFloatingText(other.x, other.y - 26, '❄️ SNOW-WAKE SHUNT! +70', '#38bdf8', 16);
      }
    });
  }

  private triggerTangleStun(m: MusherSled): void {
    m.isHolding = false;
    m.charge = 0;
    m.overchargeTimer = 1.15;
    m.combo = 1;
    this.triggerScreenShake(6);
    this.audio.playBuzzer();
    this.emitFx(m.x, m.y, '#ef4444', 14, 150);
    this.addFloatingText(m.x, m.y - 28, '⚠️ HARNESS TANGLE!', '#ef4444', 15);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const m = this.mushers.get(botId);
    if (!m || m.overchargeTimer > 0) return;

    m.botTimer -= dt;
    if (m.botTimer <= 0) {
      const delay = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.28 : 0.42;
      m.botTimer = delay + Math.random() * 0.1;

      // Look for crates/trophies ahead
      let bestPickup: TrailEntity | null = null;
      let bestScore = -9999;
      for (const e of this.entities) {
        if (e.x < m.x - 10) continue;
        if (e.type === 'serum_crate' || e.type === 'golden_trophy') {
          const d = Math.hypot(e.x - m.x, e.y - m.y);
          const val = (e.type === 'golden_trophy' ? 300 : 160) - d * 0.5;
          if (val > bestScore) {
            bestScore = val;
            bestPickup = e;
          }
        }
      }

      if (bestPickup) {
        m.botTargetX = Math.min(width * 0.62, bestPickup.x - 20);
        m.botTargetY = bestPickup.y;
      } else {
        m.botTargetX = width * 0.35;
        m.botTargetY = height * (0.3 + Math.random() * 0.45);
      }

      // Leap if obstacle is directly ahead
      const hazard = this.entities.find(
        (e) =>
          (e.type === 'crevasse' || e.type === 'spruce_log') &&
          e.x > m.x &&
          e.x < m.x + 115 &&
          Math.abs(e.y - m.y) < 36
      );
      if (hazard && m.zHeight <= 2) {
        this.executeMushLeap(m);
      } else if (!m.isHolding && Math.random() < (difficulty === 'bot_hard' ? 0.45 : 0.25)) {
        m.isHolding = true;
        m.charge = 0;
        m.botHoldTarget = 0.76 + Math.random() * 0.18;
      }
    }

    const dx = m.botTargetX - m.x;
    const dy = m.botTargetY - m.y;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const aimA = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.14;
      const spd = difficulty === 'bot_hard' ? 680 : difficulty === 'bot_normal' ? 590 : 490;
      m.vx += Math.cos(aimA) * spd * dt;
      m.vy += Math.sin(aimA) * spd * dt;
    }

    if (m.isHolding) {
      m.charge += dt * 0.85;
      if (m.charge >= m.botHoldTarget) {
        m.isHolding = false;
        if (m.charge >= 0.72 && m.charge <= 0.98) {
          this.executeBlizzCharge(m);
        } else {
          this.executeMushLeap(m);
        }
        m.charge = 0;
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.mushers.forEach((m, id) => scores.set(id, Math.floor(m.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.mushers.entries())
      .map(([playerId, m]) => ({ playerId, score: Math.floor(m.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId = rankings.length > 0 ? rankings[0].playerId : null;
    const winnerName = winnerId ? this.getPlayer(winnerId)?.name ?? winnerId : 'Nobody';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winnerName} mushed their Husky Sled Team to Iditarod victory!`,
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex] ?? THEMES[0];

    ctx.save();
    this.applyScreenShake(ctx);

    // 1. Arctic Horizon & Shared Snow Trail
    ctx.fillStyle = theme.skyTop;
    ctx.fillRect(0, 0, width, 95);

    const snowGrad = ctx.createLinearGradient(0, 95, 0, height);
    snowGrad.addColorStop(0, theme.snowTop);
    snowGrad.addColorStop(1, theme.snowTrack);
    ctx.fillStyle = snowGrad;
    ctx.fillRect(0, 95, width, height - 95);

    // Scrolling pine trees along top ridge
    for (let i = 0; i < 12; i++) {
      const tx = ((i * 95 - ((this.elapsed * 180) % 95)) + width) % width;
      ctx.fillStyle = '#064e3b';
      ctx.beginPath();
      ctx.moveTo(tx, 58);
      ctx.lineTo(tx - 16, 95);
      ctx.lineTo(tx + 16, 95);
      ctx.closePath();
      ctx.fill();
    }

    // Dashed trail markers across snowfield
    ctx.strokeStyle = theme.divider;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 18]);
    ctx.lineDashOffset = (this.elapsed * 240) % 36;
    for (let l = 1; l <= 3; l++) {
      const ly = 100 + ((height - 150) * l) / 4;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 2. Render Trail Entities (Crevasses, Spruce Logs, Serum Crates, Golden Trophies)
    for (const e of this.entities) {
      ctx.save();
      ctx.translate(e.x, e.y);

      if (e.type === 'crevasse') {
        ctx.fillStyle = '#082f49';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 32, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (e.type === 'spruce_log') {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.roundRect(-12, -24, 24, 48, 8);
        ctx.fill();
        ctx.strokeStyle = '#451a03';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (e.type === 'serum_crate') {
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.roundRect(-15, -15, 30, 30, 6);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✚', 0, 5);
      } else {
        // Golden Iditarod Trophy
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🏆', 0, 5);
      }
      ctx.restore();
    }

    // 3. Render 2.5D Musher Sled Teams & Galloping Huskies
    this.mushers.forEach((m, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const underdog = this.isUnderdog(m);

      ctx.save();
      ctx.translate(m.x, m.y);

      // Ground shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.ellipse(12, 14, 38, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Apply jump height
      ctx.translate(0, -m.zHeight);

      // Hold-to-charge ring (72%-98% Sweet Spot)
      if (m.isHolding && m.charge > 0.04) {
        const ringR = m.radius + 12;
        const inSweet = m.charge >= 0.72 && m.charge <= 0.98;
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5 + 0.72 * Math.PI * 2, -Math.PI * 0.5 + 0.98 * Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = inSweet ? '#facc15' : color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + Math.min(1, m.charge) * Math.PI * 2);
        ctx.stroke();
      }

      if (underdog || m.drafting) {
        ctx.strokeStyle = underdog ? '#facc15' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, m.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Harness towline to lead Huskies
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, 2);
      ctx.lineTo(48, 2);
      ctx.stroke();

      // Two Galloping Huskies in tandem ahead of sled
      const legSwing = Math.sin(m.gallopPhase) * 5;
      [26, 46].forEach((dogX) => {
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.roundRect(dogX - 9, -6, 18, 11, 4);
        ctx.fill();
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(dogX + 7, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dogX - 5, 5);
        ctx.lineTo(dogX - 5 - legSwing, 11);
        ctx.moveTo(dogX + 5, 5);
        ctx.lineTo(dogX + 5 + legSwing, 11);
        ctx.stroke();
      });

      // 2.5D Wooden Sled & Steel Runners
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-22, -8, 32, 16, 5);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const mood: CharacterMood =
        m.overchargeTimer > 0
          ? 'shocked'
          : m.dashTimer > 0 || m.zHeight > 8
          ? 'triumph'
          : m.isHolding
          ? 'focused'
          : 'happy';
      this.drawPlayerMascot(ctx, pId, -6, -12, 14, mood, this.elapsed, 0);

      // Score Tag
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(m.score)}`, 6, -32);

      if (m.combo > 1) {
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${m.combo}x MUSH`, 6, 26);
      }

      ctx.restore();
    });

    // 4. FX Particles
    for (const p of this.fxParticles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.renderFloatingTexts(ctx);

    // 5. Top Control Banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 295, 12, 590, 30, 15);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🐕 Steer: Carve Snow Trail • Tap: Mush Leap • Hold (72–98%): Lead-Husky Blizz-Charge & Shunt!',
      width * 0.5,
      31
    );

    // 6. Clickable Bottom-Left Theme Pill
    const px = 20;
    const py = height - 44;
    const pw = 170;
    const ph = 32;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${theme.name} [T]`, px + pw * 0.5, py + 20);

    ctx.restore();
  }

  private addFloatingText(x: number, y: number, text: string, color: string, size = 16): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1, vy: -38, size });
  }

  private renderFloatingTexts(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, ft.alpha));
      ctx.font = `900 ${ft.size}px "Outfit", system-ui, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(2, 6, 23, 0.9)";
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

}
