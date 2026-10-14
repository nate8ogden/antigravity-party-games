import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type AbductionTheme = 'area_51' | 'roswell_desert' | 'cyber_farm';

interface ThemePalette {
  name: string;
  skyTop: string;
  skyMid: string;
  groundFill: string;
  fenceColor: string;
  beamFill: string;
  beamStroke: string;
  accent: string;
}

const THEMES: Record<AbductionTheme, ThemePalette> = {
  area_51: {
    name: 'Area 51 Ranch',
    skyTop: '#030712',
    skyMid: '#0f172a',
    groundFill: '#064e3b',
    fenceColor: '#92400e',
    beamFill: 'rgba(16, 185, 129, 0.28)',
    beamStroke: '#10b981',
    accent: '#10b981',
  },
  roswell_desert: {
    name: 'Roswell Mesa 1947',
    skyTop: '#1c091a',
    skyMid: '#3b122c',
    groundFill: '#7c2d12',
    fenceColor: '#b45309',
    beamFill: 'rgba(250, 204, 21, 0.28)',
    beamStroke: '#facc15',
    accent: '#facc15',
  },
  cyber_farm: {
    name: 'Synth-Pasture 3099',
    skyTop: '#080314',
    skyMid: '#1e0b36',
    groundFill: '#1e1b4b',
    fenceColor: '#ec4899',
    beamFill: 'rgba(0, 229, 255, 0.28)',
    beamStroke: '#00e5ff',
    accent: '#00e5ff',
  },
};

const THEME_ORDER: AbductionTheme[] = ['area_51', 'roswell_desert', 'cyber_farm'];

interface PastureTarget {
  id: number;
  x: number;
  vx: number;
  type: 'cow' | 'golden_bull' | 'dynamite_tractor';
  beamedProgress: number; // 0 (on ground) to 1 (in saucer bay)
  beamedBy: PlayerId | null;
  flungBy: PlayerId | null;
  abducted: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface SaucerPilot {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  dir: 1 | -1;
  beamActive: boolean;
  score: number;
  combo: number;
  abductedCount: number;
  stunTimer: number;
  charge: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class AlienAbductionGame extends BaseGame {
  public saucers: Map<PlayerId, SaucerPilot> = new Map();
  public currentMapName: string = 'Area 51 Ranch';
  private theme: AbductionTheme = 'area_51';
  private animTime: number = 0;
  private screenShake: number = 0;
  private targetIdCounter: number = 0;
  private targets: PastureTarget[] = [];
  private spawnTimer: number = 1.0;
  private floatingTexts: FloatingText[] = [];
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private suddenDeathAlerted: boolean = false;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 40.0;
  }

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.currentMapName = THEMES[this.theme].name;
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 40.0;
    this.animTime = 0;
    this.suddenDeathAlerted = false;
    this.saucers.clear();
    this.targets = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();
    this.spawnTimer = 0.8;

    for (let i = 0; i < 7; i++) {
      this.spawnTarget(width);
    }

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    const span = width - 160;

    active.forEach((p, idx) => {
      const cx = 80 + ((idx + 0.5) / count) * span;
      this.saucers.set(p.id, {
        id: p.id,
        x: cx,
        y: height * 0.27 + (idx % 2) * 18,
        vx: 0,
        dir: idx % 2 === 0 ? 1 : -1,
        beamActive: false,
        score: 0,
        combo: 0,
        abductedCount: 0,
        stunTimer: 0,
        charge: 0,
        lastTapTime: -10,
        isUnderdog: false,
        botReleaseTarget: 0.84,
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.currentMapName = THEMES[this.theme].name;
      this.audio.playTap();
    } else if (e.key === '1') {
      this.theme = 'area_51';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'roswell_desert';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_farm';
      this.currentMapName = THEMES[this.theme].name;
    }
  }

  public handlePointerDown(x: number, y: number, width: number, height: number): void {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.currentMapName = THEMES[this.theme].name;
      this.audio.playTap();
    }
  }

  private spawnTarget(width: number): void {
    const roll = Math.random();
    const type: PastureTarget['type'] =
      roll < 0.52 ? 'cow' : roll < 0.78 ? 'golden_bull' : 'dynamite_tractor';
    this.targets.push({
      id: ++this.targetIdCounter,
      x: 75 + Math.random() * (width - 150),
      vx: (Math.random() < 0.5 ? 1 : -1) * (type === 'golden_bull' ? 58 : 34),
      type,
      beamedProgress: 0,
      beamedBy: null,
      flungBy: null,
      abducted: false,
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    if (isSuddenDeath && !this.suddenDeathAlerted) {
      this.suddenDeathAlerted = true;
      this.audio.playFanfare();
      this.triggerScreenShake(7);
      this.floatingTexts.push({
        x: width * 0.5,
        y: height * 0.18,
        text: '🛸 MOTHERSHIP STAMPEDE! 2X ABDUCTION POINTS! 🛸',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Underdog Check
    let maxScore = 0;
    this.saucers.forEach((s) => {
      if (s.score > maxScore) maxScore = s.score;
    });
    this.saucers.forEach((s) => {
      s.isUnderdog = maxScore - s.score >= 150;
    });

    this.spawnTimer -= clampedDt;
    if (this.spawnTimer <= 0 && this.targets.length < (isSuddenDeath ? 12 : 9)) {
      this.spawnTarget(width);
      this.spawnTimer = isSuddenDeath ? 0.75 : 1.3;
    }

    this.updateBots(clampedDt, width, height);

    const sdMult = isSuddenDeath ? 2 : 1;

    // Update Saucers
    this.saucers.forEach((s, pId) => {
      const p = this.getPlayer(pId);
      if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - clampedDt);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(pId);
        const holding = this.input.isActionPressed(pId) || this.input.isPressed(pId);
        const justPressed = this.input.justPressed(pId) || this.input.justAction(pId);
        const released = this.input.justReleased(pId);

        if (s.stunTimer <= 0) {
          if (Math.abs(steer) > 0.15) {
            s.vx += steer * (s.isUnderdog ? 480 : 400) * clampedDt;
            s.dir = steer >= 0 ? 1 : -1;
          } else {
            s.vx += s.dir * (holding ? 115 : 195) * clampedDt;
          }

          if (justPressed) {
            if (this.animTime - s.lastTapTime < 0.26) {
              s.dir = (s.dir * -1) as 1 | -1;
            }
            s.lastTapTime = this.animTime;
          }

          s.beamActive = holding;
          if (holding) {
            s.charge = Math.min(1.0, s.charge + clampedDt * 0.78);
          } else if (released && s.charge > 0) {
            const c = s.charge;
            s.charge = 0;
            if (c >= 0.72 && c <= 0.98) {
              this.triggerGravitonPulse(s, sdMult);
            }
          }
        } else {
          s.beamActive = false;
          s.charge = 0;
        }
      }

      s.vx *= Math.pow(0.06, clampedDt);
      s.x += s.vx * clampedDt;
      if (s.x < 68) {
        s.x = 68;
        s.vx = Math.abs(s.vx) * 0.6;
        s.dir = 1;
      } else if (s.x > width - 68) {
        s.x = width - 68;
        s.vx = -Math.abs(s.vx) * 0.6;
        s.dir = -1;
      }
    });

    // Elastic UFO-to-UFO Collisions (ramming drops levitating targets!)
    const saucerArr = Array.from(this.saucers.values());
    for (let i = 0; i < saucerArr.length; i++) {
      for (let j = i + 1; j < saucerArr.length; j++) {
        const a = saucerArr[i];
        const b = saucerArr[j];
        const dx = b.x - a.x;
        const minDist = 60;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = (minDist - Math.abs(dx)) * 0.5;
          a.x -= sign * overlap;
          b.x += sign * overlap;

          const impulse = 210;
          a.vx = -sign * impulse * (b.isUnderdog ? 1.35 : 1.0);
          b.vx = sign * impulse * (a.isUnderdog ? 1.35 : 1.0);
          a.dir = (-sign) as 1 | -1;
          b.dir = sign as 1 | -1;

          this.particles.spawnSparks((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, '#00e5ff', 12);
          this.audio.playBounce();
        }
      }
    }

    // Update Pasture Targets & Tractor Beam Levitation
    for (const tgt of this.targets) {
      if (tgt.abducted) continue;

      if (tgt.beamedProgress <= 0.05) {
        tgt.x += tgt.vx * clampedDt;
        if (tgt.x < 65) {
          tgt.x = 65;
          tgt.vx = Math.abs(tgt.vx);
        } else if (tgt.x > width - 65) {
          tgt.x = width - 65;
          tgt.vx = -Math.abs(tgt.vx);
        }
      }

      // Check which active saucer beam is closest to this target
      let activePuller: SaucerPilot | null = null;
      let bestDist = 42;
      this.saucers.forEach((s) => {
        if (s.beamActive && s.stunTimer <= 0) {
          const d = Math.abs(s.x - tgt.x);
          if (d < bestDist) {
            bestDist = d;
            activePuller = s;
          }
        }
      });

      if (activePuller) {
        const puller = activePuller as SaucerPilot;
        // Mid-air rustle bonus if stealing from another saucer!
        if (tgt.beamedBy && tgt.beamedBy !== puller.id && tgt.beamedProgress > 0.25 && tgt.type !== 'dynamite_tractor') {
          puller.score += 35;
          this.audio.playChime();
          this.floatingTexts.push({
            x: tgt.x,
            y: height * 0.52,
            text: '🐄 MID-AIR RUSTLE! +35',
            color: '#facc15',
            alpha: 1.1,
            vy: -34,
          });
        }
        tgt.beamedBy = puller.id;
        tgt.x += (puller.x - tgt.x) * clampedDt * 6;
        tgt.beamedProgress += clampedDt * (puller.isUnderdog ? 1.55 : 1.3);

        if (tgt.beamedProgress >= 1.0) {
          tgt.abducted = true;
          if (tgt.type === 'dynamite_tractor') {
            puller.stunTimer = 0.95;
            puller.combo = 0;
            puller.charge = 0;
            puller.score = Math.max(0, puller.score - 25);
            this.audio.playExplosion();
            this.triggerScreenShake(5);
            this.particles.spawnExplosion(puller.x, puller.y, '#ef4444', 22);
            this.floatingTexts.push({
              x: puller.x,
              y: puller.y - 24,
              text: '💥 DYNAMITE TRACTOR! -25',
              color: '#ef4444',
              alpha: 1.1,
              vy: -32,
            });
          } else {
            puller.combo = Math.min(6, puller.combo + 1);
            puller.abductedCount++;
            const basePts = tgt.type === 'golden_bull' ? 75 : 40;
            const pts = (basePts + puller.combo * 8) * sdMult;
            puller.score += pts;
            this.audio.playScore();
            this.particles.spawnExplosion(puller.x, puller.y + 10, '#10b981', 18);
            this.floatingTexts.push({
              x: puller.x,
              y: puller.y - 24,
              text: tgt.type === 'golden_bull' ? `🐂 GOLDEN BULL! +${pts}` : `+${pts} ABDUCTED!`,
              color: tgt.type === 'golden_bull' ? '#facc15' : '#10b981',
              alpha: 1.15,
              vy: -36,
            });
          }
        }
      } else {
        tgt.beamedProgress = Math.max(0, tgt.beamedProgress - clampedDt * 1.4);
        if (tgt.beamedProgress === 0) tgt.beamedBy = null;
      }
    }

    this.targets = this.targets.filter((t) => !t.abducted);

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private triggerGravitonPulse(s: SaucerPilot, sdMult: number): void {
    this.audio.playExplosion();
    this.triggerScreenShake(6);
    this.particles.spawnExplosion(s.x, s.y + 16, '#facc15', 22);

    // 1. Instant Warp-Hoist any cow or bull inside wider 64px cone!
    for (const tgt of this.targets) {
      if (!tgt.abducted && Math.abs(tgt.x - s.x) < 64) {
        if (tgt.type !== 'dynamite_tractor') {
          tgt.abducted = true;
          s.combo = Math.min(6, s.combo + 1);
          s.abductedCount++;
          const basePts = tgt.type === 'golden_bull' ? 75 : 40;
          const pts = Math.round((basePts + s.combo * 8) * 1.65 * sdMult);
          s.score += pts;
          this.floatingTexts.push({
            x: s.x,
            y: s.y - 28,
            text: `⚡ WARP HOIST! +${pts}`,
            color: '#facc15',
            alpha: 1.25,
            vy: -42,
          });
        }
      }
    }

    // 2. EMP Saucer-Flip Shunt against nearby rival UFOs!
    this.saucers.forEach((other) => {
      if (other.id === s.id) return;
      const dx = other.x - s.x;
      if (Math.abs(dx) < 155) {
        const sign = dx >= 0 ? 1 : -1;
        other.vx += sign * 280;
        other.stunTimer = Math.max(other.stunTimer, 0.65);
        other.beamActive = false;
        s.score += 70;
        this.particles.spawnExplosion(other.x, other.y, '#f43f5e', 18);
        this.floatingTexts.push({
          x: other.x,
          y: other.y - 30,
          text: 'UFO EMP SHUNT! +70',
          color: '#f43f5e',
          alpha: 1.2,
          vy: -42,
        });
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
    const s = this.saucers.get(botId);
    if (!s || s.stunTimer > 0) return;

    const isSuddenDeath = this.roundTimer <= 12.0;
    const sdMult = isSuddenDeath ? 2 : 1;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.4 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.23 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const blunder = difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Find best cow/bull target
      let bestTgt: PastureTarget | null = null;
      let bestScore = -Infinity;
      for (const t of this.targets) {
        if (t.abducted) continue;
        if (t.type === 'dynamite_tractor' && Math.random() >= blunder) continue;
        const val = t.type === 'golden_bull' ? 120 : 60;
        const score = val - Math.abs(t.x - s.x) * 0.4;
        if (score > bestScore) {
          bestScore = score;
          bestTgt = t;
        }
      }

      if (bestTgt) {
        const dx = bestTgt.x - s.x;
        if (Math.abs(dx) > 22) {
          s.dir = dx >= 0 ? 1 : -1;
          s.vx += s.dir * (difficulty === 'bot_hard' ? 230 : 170);
          s.beamActive = false;
        } else {
          s.beamActive = true;
          s.botReleaseTarget =
            difficulty === 'bot_hard' ? 0.8 + Math.random() * 0.14 : 0.65 + Math.random() * 0.25;
        }
      } else {
        s.beamActive = false;
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (s.beamActive) {
      s.charge = Math.min(1.0, s.charge + dt * 0.78);
      if (s.charge >= s.botReleaseTarget) {
        const c = s.charge;
        s.charge = 0;
        s.beamActive = false;
        if (c >= 0.72 && c <= 0.98) {
          this.triggerGravitonPulse(s, sdMult);
        }
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.saucers.forEach((s, pId) => scores.set(pId, s.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.saucers.entries())
      .map(([playerId, s]) => ({ playerId, score: s.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} beamed up the prize livestock!`
        : 'All saucers were repelled by the ranch!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    const groundY = height * 0.76;

    // 1. Night Sky & Pasture Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, pal.skyTop);
    skyGrad.addColorStop(1, pal.skyMid);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, groundY);

    ctx.fillStyle = pal.groundFill;
    ctx.fillRect(0, groundY, width, height - groundY);

    // 2. Ranch Wooden Fence along Horizon
    ctx.strokeStyle = pal.fenceColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, groundY - 8);
    ctx.lineTo(width - 40, groundY - 8);
    ctx.moveTo(40, groundY - 18);
    ctx.lineTo(width - 40, groundY - 18);
    for (let fx = 50; fx < width - 40; fx += 45) {
      ctx.moveTo(fx, groundY);
      ctx.lineTo(fx, groundY - 24);
    }
    ctx.stroke();

    // 3. Tractor Beam Cones beneath Active Saucers
    this.saucers.forEach((s) => {
      if (s.beamActive && s.stunTimer <= 0) {
        const coneW = 36 + s.charge * 18;
        ctx.fillStyle = pal.beamFill;
        ctx.beginPath();
        ctx.moveTo(s.x - 14, s.y + 8);
        ctx.lineTo(s.x + 14, s.y + 8);
        ctx.lineTo(s.x + coneW, groundY);
        ctx.lineTo(s.x - coneW, groundY);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = s.charge >= 0.72 && s.charge <= 0.98 ? '#facc15' : pal.beamStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // 4. Render Pasture Livestock & Dynamite Tractors
    for (const tgt of this.targets) {
      if (tgt.abducted) continue;
      const puller = tgt.beamedBy ? this.saucers.get(tgt.beamedBy) : null;
      const topY = puller ? puller.y + 18 : height * 0.3;
      const floatY = groundY - 14 - tgt.beamedProgress * (groundY - topY);

      ctx.save();
      ctx.translate(tgt.x, floatY);
      if (tgt.beamedProgress > 0.05) {
        ctx.rotate(Math.sin(this.animTime * 12 + tgt.id) * 0.25);
      }

      if (tgt.type === 'cow' || tgt.type === 'golden_bull') {
        const isGold = tgt.type === 'golden_bull';
        ctx.fillStyle = isGold ? '#facc15' : '#f8fafc';
        ctx.strokeStyle = isGold ? '#ca8a04' : '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-14, -9, 28, 18, 5);
        ctx.fill();
        ctx.stroke();

        if (!isGold) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(-5, -2, 4, 0, Math.PI * 2);
          ctx.arc(5, 3, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Head & Horns
        ctx.fillStyle = isGold ? '#eab308' : '#fed7aa';
        ctx.beginPath();
        ctx.arc(14, -4, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Red Dynamite Tractor Hazard
        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-14, -11, 28, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TNT', 0, 0);
      }

      ctx.restore();
    }

    // 5. Render 2.5D Flying Saucers & Mascot Commanders
    this.saucers.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#10b981';

      ctx.save();
      ctx.translate(s.x, s.y);

      if (s.stunTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      } else {
        ctx.rotate(Math.max(-0.22, Math.min(0.22, s.vx * 0.0008)));
      }

      // Mascot Commander inside UFO Glass Dome
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -12,
        14,
        s.stunTimer > 0 ? 'shocked' : s.beamActive ? 'triumph' : 'focused',
        this.animTime
      );

      // Transparent Glass Bubble Canopy
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -10, 16, Math.PI, 0);
      ctx.stroke();

      // Metallic Saucer Disc
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating Rim Lights
      for (let i = -2; i <= 2; i++) {
        ctx.fillStyle = s.beamActive ? '#facc15' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(i * 11, 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Hold-to-Charge Graviton Capacitor Bar (72%–98% Sweet Spot)
      if (s.beamActive && s.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -36, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -35, bw * 0.26, 4);
        const isSweet = s.charge >= 0.72 && s.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#10b981';
        ctx.fillRect(-bw / 2, -35, bw * Math.min(1, s.charge), 4);
      }

      ctx.restore();
    });

    // 6. Floating Combat Text
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

    // 7. Top Instruction Banner (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 260, 56, 520, 26, 13);
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🛸 STEER UFO • HOLD: BEAM UP COWS • RELEASE (72–98%): WARP HOIST & EMP SHUNT!',
      width * 0.5,
      73
    );

    // 8. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.saucers.get(p.id);
      if (!s) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 + row * 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${s.score}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Abducted: ${s.abductedCount} • ${s.combo}x Beam`, cardX + 10, cardY + 28);
    });

    // 9. Bottom-Left Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${pal.name} [T]`, 105, height - 24);
  }
}
