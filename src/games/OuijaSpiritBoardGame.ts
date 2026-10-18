import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type AstroTheme = 'royal_observatory' | 'nebula_orrery' | 'cyber_planetarium';

interface ThemePalette {
  name: string;
  bgInner: string;
  bgOuter: string;
  ringGold: string;
  runeColor: string;
  accent: string;
}

const THEMES: Record<AstroTheme, ThemePalette> = {
  royal_observatory: {
    name: 'Royal Observatory',
    bgInner: '#0c2448',
    bgOuter: '#040b1a',
    ringGold: '#facc15',
    runeColor: '#bae6fd',
    accent: '#38bdf8',
  },
  nebula_orrery: {
    name: 'Nebula Star Orrery',
    bgInner: '#2e1065',
    bgOuter: '#090418',
    ringGold: '#f472b6',
    runeColor: '#e9d5ff',
    accent: '#c084fc',
  },
  cyber_planetarium: {
    name: 'Cyber Planetarium',
    bgInner: '#063238',
    bgOuter: '#021014',
    ringGold: '#2dd4bf',
    runeColor: '#99f6e4',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: AstroTheme[] = ['royal_observatory', 'nebula_orrery', 'cyber_planetarium'];

interface StarRuneNode {
  char: string;
  x: number;
  y: number;
}

interface ShootingStarGem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gold: boolean;
  active: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface AstroCompassPilot {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  combo: number;
  pulseTimer: number;
  stunTimer: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  isUnderdog: boolean;
  botShouldHold: boolean;
}

export class OuijaSpiritBoardGame extends BaseGame {
  private pilots: Map<PlayerId, AstroCompassPilot> = new Map();
  private starNodes: StarRuneNode[] = [];
  private tracedPoints: { x: number; y: number }[] = [];
  private gems: ShootingStarGem[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextGemId: number = 1;
  private currentWord: string = 'COMET';
  private currentLetterIndex: number = 0;
  private wordList: string[] = [
    'COMET',
    'ORBIT',
    'SOLAR',
    'ASTRO',
    'NOVA',
    'STAR',
    'QUASAR',
    'GALAXY',
  ];
  private theme: AstroTheme = 'royal_observatory';
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAlerted: boolean = false;
  private botReactionTimers: Map<PlayerId, number> = new Map();
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

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.reset(width, height);

    if (!this.keyHandler && typeof window !== 'undefined') {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
          this.theme = THEME_ORDER[idx];
          this.audio.playTap();
        } else if (e.key === '1') {
          this.theme = 'royal_observatory';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'nebula_orrery';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_planetarium';
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public override destroy(): void {
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public handlePointerDown(x: number, y: number, _width: number, height: number): void {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.audio.playTap();
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAlerted = false;
    this.pilots.clear();
    this.starNodes = [];
    this.tracedPoints = [];
    this.gems = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.currentLetterIndex = 0;
    this.currentWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];

    // Build Circular Planetarium Star-Chart Ring (26 Constellation Runes in 2 Concentric Celestial Rings)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const centerX = width / 2;
    const centerY = height / 2 + 12;
    const outerRx = Math.min(width * 0.36, 300);
    const outerRy = Math.min(height * 0.29, 175);
    const innerRx = outerRx * 0.62;
    const innerRy = outerRy * 0.62;

    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 - Math.PI / 2;
      this.starNodes.push({
        char: alphabet[i],
        x: centerX + Math.cos(angle) * outerRx,
        y: centerY + Math.sin(angle) * outerRy,
      });
    }
    for (let i = 16; i < 26; i++) {
      const angle = ((i - 16) / 10) * Math.PI * 2 - Math.PI / 2;
      this.starNodes.push({
        char: alphabet[i],
        x: centerX + Math.cos(angle) * innerRx,
        y: centerY + Math.sin(angle) * innerRy,
      });
    }

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);

    active.forEach((p, idx) => {
      const ang = (idx * Math.PI * 2) / count;
      this.pilots.set(p.id, {
        id: p.id,
        x: centerX + Math.cos(ang) * 90,
        y: centerY + Math.sin(ang) * 70,
        vx: 0,
        vy: 0,
        angle: ang,
        score: 0,
        combo: 1,
        pulseTimer: 0,
        stunTimer: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
        isUnderdog: false,
        botShouldHold: false,
      });
      this.botReactionTimers.set(p.id, 0.2);
    });

    this.spawnStarGems(width, height, 3);
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1.35, vy: -28 });
  }

  private spawnStarGems(width: number, height: number, count: number): void {
    for (let i = 0; i < count; i++) {
      if (this.gems.filter((g) => g.active).length >= 7) break;
      this.gems.push({
        id: this.nextGemId++,
        x: 130 + Math.random() * (width - 260),
        y: 120 + Math.random() * (height - 250),
        vx: (Math.random() - 0.5) * 65,
        vy: (Math.random() - 0.5) * 65,
        gold: Math.random() < 0.4,
        active: true,
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - clampedDt * 28);
    }

    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    if (isSuddenDeath && !this.suddenDeathAlerted) {
      this.suddenDeathAlerted = true;
      this.audio.playFanfare();
      this.triggerScreenShake(9);
      this.addFloatingText(
        width * 0.5,
        102,
        '🌟 SUPERNOVA ALIGNMENT! 2X CONSTELLATION POINTS! 🌟',
        '#facc15'
      );
      this.spawnStarGems(width, height, 4);
    }

    const sdMult = isSuddenDeath ? 2 : 1;

    // Underdog Check
    let maxScore = 0;
    this.pilots.forEach((pl) => {
      if (pl.score > maxScore) maxScore = pl.score;
    });
    this.pilots.forEach((pl) => {
      pl.isUnderdog = maxScore - pl.score >= 110;
    });

    this.updateBots(clampedDt, width, height);

    const targetChar = this.currentWord[this.currentLetterIndex];
    const targetNode = this.starNodes.find((n) => n.char === targetChar);

    // Update Astro-Compass Pilots
    this.pilots.forEach((ps) => {
      const p = this.getPlayer(ps.id);
      if (!p) return;

      if (ps.pulseTimer > 0) ps.pulseTimer = Math.max(0, ps.pulseTimer - clampedDt);
      if (ps.overchargeLockout > 0)
        ps.overchargeLockout = Math.max(0, ps.overchargeLockout - clampedDt);

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - clampedDt);
        ps.charging = false;
        ps.charge = 0;
        ps.vx *= Math.pow(0.12, clampedDt);
        ps.vy *= Math.pow(0.12, clampedDt);
        ps.x = Math.max(65, Math.min(width - 65, ps.x + ps.vx * clampedDt));
        ps.y = Math.max(95, Math.min(height - 95, ps.y + ps.vy * clampedDt));
        return;
      }

      const isBot = p.type.startsWith('bot_');
      const hasSteer = this.input.hasSteer(ps.id);
      const speedMult = ps.isUnderdog ? 1.22 : 1.0;
      const steer = this.input.getSteer(ps.id);
      const throttle = this.input.getThrottle(ps.id);
      const holding = this.input.isActionPressed(ps.id) || (isBot && this.input.isPressed(ps.id)) || (!hasSteer && !isBot && this.input.isPressed(ps.id));
      const justPressed = this.input.justAction(ps.id) || (isBot && this.input.justPressed(ps.id)) || (!hasSteer && !isBot && this.input.justPressed(ps.id));
      const released = this.input.justReleased(ps.id) || (!holding && ps.charging);

      const accel = 640 * speedMult;
      if (Math.abs(steer) > 0.1 || Math.abs(throttle) > 0.1) {
        ps.vx += steer * accel * clampedDt;
        ps.vy += -throttle * accel * clampedDt;
        ps.angle = Math.atan2(-throttle, steer);
      } else if (targetNode && holding) {
        // Single-button / action-hold guidance towards the active Constellation Star
        const dx = targetNode.x - ps.x;
        const dy = targetNode.y - ps.y;
        const dist = Math.hypot(dx, dy) || 1;
        ps.vx += (dx / (dist || 0.001)) * accel * 0.85 * clampedDt;
        ps.vy += (dy / (dist || 0.001)) * accel * 0.85 * clampedDt;
        ps.angle = Math.atan2(dy, dx);
      }

      if (justPressed && ps.overchargeLockout <= 0) {
        ps.charging = true;
        ps.charge = 0;
      }

      if (!isBot) {
        if (holding && ps.charging && ps.overchargeLockout <= 0) {
          ps.charge += clampedDt * 0.88;
          if (ps.charge >= 1.0) {
            ps.charging = false;
            ps.charge = 0;
            ps.overchargeLockout = 0.85;
            ps.stunTimer = 0.6;
            this.audio.playStun();
            this.addFloatingText(ps.x, ps.y - 34, 'LENS FLARE OVERLOAD!', '#ef4444');
          }
        } else if (released && ps.charging) {
          if (ps.charge >= 0.72 && ps.charge <= 0.98) {
            this.fireSupernovaPulse(ps, p.color, targetNode, sdMult);
          }
          ps.charging = false;
          ps.charge = 0;
        } else if (!holding) {
          ps.charging = false;
          ps.charge = Math.max(0, ps.charge - clampedDt * 2.2);
        }
      } else {
        // Bot hold-to-charge handling
        if (ps.botShouldHold && ps.overchargeLockout <= 0) {
          ps.charging = true;
          ps.charge += clampedDt * 0.85;
          if (ps.charge >= 0.82) {
            this.fireSupernovaPulse(ps, p.color, targetNode, sdMult);
            ps.charging = false;
            ps.charge = 0;
            ps.botShouldHold = false;
          }
        } else {
          ps.charging = false;
          ps.charge = Math.max(0, ps.charge - clampedDt * 2.0);
        }
      }

      const maxSpeed = 290 * speedMult;
      const curSpeed = Math.hypot(ps.vx, ps.vy);
      if (curSpeed > maxSpeed) {
        ps.vx = (ps.vx / curSpeed) * maxSpeed;
        ps.vy = (ps.vy / curSpeed) * maxSpeed;
      }

      ps.vx *= Math.pow(0.18, clampedDt);
      ps.vy *= Math.pow(0.18, clampedDt);
      ps.x = Math.max(65, Math.min(width - 65, ps.x + ps.vx * clampedDt));
      ps.y = Math.max(95, Math.min(height - 95, ps.y + ps.vy * clampedDt));

      // Check lock-on collision with active Constellation Star Rune
      if (targetNode) {
        const dist = Math.hypot(ps.x - targetNode.x, ps.y - targetNode.y);
        if (dist < 32) {
          const pts = (30 + ps.combo * 5) * sdMult;
          ps.score += pts;
          ps.combo = Math.min(6, ps.combo + 1);
          ps.pulseTimer = 0.5;
          this.tracedPoints.push({ x: targetNode.x, y: targetNode.y });
          this.audio.playScore();
          this.particles.spawnSparks(targetNode.x, targetNode.y, '#facc15', 16);
          this.addFloatingText(
            targetNode.x,
            targetNode.y - 26,
            `+${pts} STAR '${targetNode.char}' LOCKED!`,
            p.color
          );

          this.currentLetterIndex++;
          if (this.currentLetterIndex >= this.currentWord.length) {
            const wordBonus = 65 * sdMult;
            ps.score += wordBonus;
            this.audio.playFanfare();
            this.triggerScreenShake(8);
            this.particles.spawnExplosion(width / 2, height / 2, '#facc15', 26);
            this.addFloatingText(
              width / 2,
              height / 2 - 20,
              `✨ ${this.currentWord} CONSTELLATION COMPLETE! +${wordBonus} ✨`,
              '#facc15'
            );
            this.currentLetterIndex = 0;
            this.tracedPoints = [];
            this.currentWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
            this.spawnStarGems(width, height, 3);
          }
        }
      }
    });

    // Elastic Astro-Compass Collisions (m1*v1 + m2*v2)
    const list = Array.from(this.pilots.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 44;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const impulse = 210;
          a.vx -= nx * impulse * (b.isUnderdog ? 1.35 : 1.0);
          a.vy -= ny * impulse * (b.isUnderdog ? 1.35 : 1.0);
          b.vx += nx * impulse * (a.isUnderdog ? 1.35 : 1.0);
          b.vy += ny * impulse * (a.isUnderdog ? 1.35 : 1.0);

          this.audio.playBounce();
          this.triggerScreenShake(5);
          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#facc15', 12);
        }
      }
    }

    // Update Shooting Star Gems
    for (const g of this.gems) {
      if (!g.active) continue;
      g.x += g.vx * clampedDt;
      g.y += g.vy * clampedDt;
      if (g.x < 90 || g.x > width - 90) g.vx *= -1;
      if (g.y < 105 || g.y > height - 115) g.vy *= -1;

      this.pilots.forEach((ps) => {
        if (!g.active || ps.stunTimer > 0) return;
        if (Math.hypot(ps.x - g.x, ps.y - g.y) < 32) {
          g.active = false;
          const pts = (g.gold ? 35 : 20) * sdMult;
          ps.score += pts;
          this.audio.playCoin();
          this.particles.spawnSparks(g.x, g.y, g.gold ? '#facc15' : '#38bdf8', 12);
          this.addFloatingText(
            g.x,
            g.y - 22,
            g.gold ? `+${pts} COMET CORE!` : `+${pts} STAR GEM`,
            g.gold ? '#facc15' : '#38bdf8'
          );
        }
      });
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private fireSupernovaPulse(
    ps: AstroCompassPilot,
    color: string,
    targetNode: StarRuneNode | undefined,
    sdMult: number
  ): void {
    const bonus = 45 * sdMult;
    ps.score += bonus;
    ps.pulseTimer = 0.7;
    this.audio.playScore();
    this.triggerScreenShake(8);
    this.particles.spawnExplosion(ps.x, ps.y, '#facc15', 22);
    this.addFloatingText(ps.x, ps.y - 36, `+${bonus} SUPERNOVA WARP PULSE!`, '#facc15');

    // Warp-dash boost toward active Constellation Star
    if (targetNode) {
      const dx = targetNode.x - ps.x;
      const dy = targetNode.y - ps.y;
      const dist = Math.hypot(dx, dy) || 1;
      ps.vx = (dx / (dist || 0.001)) * 340;
      ps.vy = (dy / (dist || 0.001)) * 340;
    }

    // Gravity Lens Shunt against nearby rival Astro-Compasses!
    this.pilots.forEach((other) => {
      if (other.id === ps.id) return;
      const dx = other.x - ps.x;
      const dy = other.y - ps.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= 165) {
        other.vx = (dx / (dist || 0.001)) * 320;
        other.vy = (dy / (dist || 0.001)) * 320;
        other.stunTimer = Math.max(other.stunTimer, 0.7);
        const shuntPts = 45 * sdMult;
        ps.score += shuntPts;
        this.audio.playBounce();
        this.particles.spawnExplosion(other.x, other.y, color, 18);
        this.addFloatingText(other.x, other.y - 32, `+${shuntPts} GRAVITY LENS SHUNT!`, color);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.pilots.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    const targetChar = this.currentWord[this.currentLetterIndex];
    const targetNode = this.starNodes.find((n) => n.char === targetChar);
    if (!targetNode) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      const reactDelay =
        difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.41;
      this.botReactionTimers.set(botId, reactDelay + Math.random() * 0.05);

      let rivalNearby = false;
      this.pilots.forEach((other) => {
        if (other.id !== ps.id && Math.hypot(other.x - ps.x, other.y - ps.y) < 145) {
          rivalNearby = true;
        }
      });
      ps.botShouldHold = rivalNearby && difficulty !== 'bot_easy';
    } else {
      this.botReactionTimers.set(botId, timer);
    }

    if (difficulty === 'bot_easy' && Math.random() < 0.2) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    const jitter = difficulty === 'bot_easy' ? 28 : difficulty === 'bot_normal' ? 10 : 2;
    const tx = targetNode.x + (Math.random() - 0.5) * jitter;
    const ty = targetNode.y + (Math.random() - 0.5) * jitter;
    const dx = tx - ps.x;
    const dy = ty - ps.y;
    const dist = Math.hypot(dx, dy) || 1;

    this.input.setBotInput(botId, true, dx / dist, -dy / dist);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    const cx = width / 2;
    const cy = height / 2 + 12;

    // 1. Deep Planetarium Star-Chart Dome Background
    const bgGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(width, height) * 0.65);
    bgGrad.addColorStop(0, pal.bgInner);
    bgGrad.addColorStop(1, pal.bgOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Twinkling background starfield
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 42; i++) {
      const sx = (i * 197) % width;
      const sy = (i * 131) % height;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 2. Celestial Armillary Brass Rings & Star-Chart Grid
    const outerRx = Math.min(width * 0.36, 300);
    const outerRy = Math.min(height * 0.29, 175);
    ctx.strokeStyle = pal.ringGold;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, outerRx, outerRy, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, outerRx * 0.62, outerRy * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 3. Connected Constellation Lines for Decoded Letters
    if (this.tracedPoints.length > 0) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.tracedPoints[0].x, this.tracedPoints[0].y);
      for (let i = 1; i < this.tracedPoints.length; i++) {
        ctx.lineTo(this.tracedPoints[i].x, this.tracedPoints[i].y);
      }
      ctx.stroke();
    }

    const targetChar = this.currentWord[this.currentLetterIndex];

    // 4. Render Star Rune Nodes
    for (const node of this.starNodes) {
      const isTarget = node.char === targetChar;
      ctx.save();
      ctx.translate(node.x, node.y);

      if (isTarget) {
        const pulseR = 20 + Math.sin(this.animTime * 7) * 3;
        ctx.fillStyle = 'rgba(250, 204, 21, 0.32)';
        ctx.beginPath();
        ctx.arc(0, 0, pulseR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = isTarget ? '#fef08a' : pal.runeColor;
      ctx.font = isTarget ? 'bold 16px sans-serif' : 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.char, 0, 1);
      ctx.restore();
    }

    // 5. Render Shooting Star Gems
    for (const g of this.gems) {
      if (!g.active) continue;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(this.animTime * 2.5);
      ctx.fillStyle = g.gold ? '#facc15' : '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const a2 = a1 + Math.PI / 5;
        ctx.lineTo(Math.cos(a1) * 12, Math.sin(a1) * 12);
        ctx.lineTo(Math.cos(a2) * 5, Math.sin(a2) * 5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 6. Render 2.5D Brass Astro-Compass Lenses & Mascot Astronomers
    this.pilots.forEach((ps) => {
      const p = this.getPlayer(ps.id);
      if (!p) return;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Brass Astro-Compass Ring
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Compass Cardinal Ticks
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + this.animTime;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
        ctx.lineTo(Math.cos(a) * 25, Math.sin(a) * 25);
        ctx.stroke();
      }
      ctx.restore();

      const mood =
        ps.stunTimer > 0
          ? 'shocked'
          : ps.pulseTimer > 0 || ps.combo >= 3
          ? 'triumph'
          : ps.charging
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(ctx, ps.id, ps.x, ps.y, 15, mood, this.animTime);

      // Hold-to-charge Supernova Pulse Ring (72%-98%)
      if (ps.charging && ps.charge > 0.04) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(ps.x, ps.y, 28, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }
    });

    // 7. Central Constellation Word Progress Display
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.ringGold;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(cx - 115, cy - 22, 230, 44, 14);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const donePart = this.currentWord.slice(0, this.currentLetterIndex);
    const nextChar = this.currentWord[this.currentLetterIndex] ?? '';
    const remPart = this.currentWord.slice(this.currentLetterIndex + 1);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(
      `⭐ ${donePart}[${nextChar}]${remPart}`,
      cx,
      cy + 1
    );

    // 8. Floating Combat Text
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.alpha);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 9. Top Instruction Banner (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 52, 520, 28, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🔭 LOCK STAR '${targetChar}' TO TRACE ${this.currentWord} • HOLD (72-98%): SUPERNOVA SHUNT!`,
      width * 0.5,
      70
    );

    // 10. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.pilots.get(p.id);
      if (!ps) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 + row * 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${Math.floor(ps.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        `${ps.combo}x Star Lock ${ps.isUnderdog ? '• ⚡SURGE' : ''}`,
        cardX + 10,
        cardY + 28
      );
    });

    // 11. Bottom-Left Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${pal.name} [T]`, 105, height - 24);

    ctx.restore();
  }

  public getScore(playerId: PlayerId): number {
    return this.pilots.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.pilots.entries())
      .map(([playerId, ps]) => ({ playerId, score: Math.floor(ps.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} charted the Celestial Constellations with master Astro-Compass precision!`
        : 'Celestial Star-Chart Showdown!',
    };
  }
}
