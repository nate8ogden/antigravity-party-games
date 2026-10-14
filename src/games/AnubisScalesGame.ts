import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type AnubisThemeId = 'duat' | 'karnak' | 'cyber_anubis';

interface AnubisTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  floorTop: string;
  floorBot: string;
  scaleGold: string;
  featherColor: string;
  accent: string;
}

const THEMES: Record<AnubisThemeId, AnubisTheme> = {
  duat: {
    name: 'Hall of Two Truths',
    skyTop: '#0b0914',
    skyMid: '#1e1633',
    skyBot: '#2e1f47',
    floorTop: '#3b2854',
    floorBot: '#140d21',
    scaleGold: '#facc15',
    featherColor: '#38bdf8',
    accent: '#facc15',
  },
  karnak: {
    name: 'Sun Temple of Ra',
    skyTop: '#451a03',
    skyMid: '#9a3412',
    skyBot: '#d97706',
    floorTop: '#b45309',
    floorBot: '#451a03',
    scaleGold: '#fde047',
    featherColor: '#2dd4bf',
    accent: '#fbbf24',
  },
  cyber_anubis: {
    name: 'Neon Duat Mainframe',
    skyTop: '#030712',
    skyMid: '#0f172a',
    skyBot: '#1e1b4b',
    floorTop: '#1e293b',
    floorBot: '#020617',
    scaleGold: '#22d3ee',
    featherColor: '#e879f9',
    accent: '#22d3ee',
  },
};

const THEME_ORDER: AnubisThemeId[] = ['duat', 'karnak', 'cyber_anubis'];

interface FallingRelic {
  id: number;
  x: number;
  y: number;
  vy: number;
  weight: number;
  kind: 'lapis' | 'jar' | 'ankh' | 'feather' | 'sin';
  color: string;
  label: string;
  collected: boolean;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface ScalesStation {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  patrolDir: 1 | -1;
  anchorX: number;
  currentWeight: number;
  targetWeight: number;
  tiltAngle: number;
  score: number;
  combo: number;
  charge: number;
  charging: boolean;
  judgmentAnim: number;
  lockoutTimer: number;
  shuntCooldown: number;
  heartsWeighed: number;
  shuntsLanded: number;
  botReactionTimer: number;
  botTargetX: number;
  botReleaseThreshold: number;
}

export class AnubisScalesGame extends BaseGame {
  public stations: Map<PlayerId, ScalesStation> = new Map();
  public relics: FallingRelic[] = [];
  public currentMapName: string = 'Hall of Two Truths';

  private themeId: AnubisThemeId = 'duat';
  private callouts: Callout[] = [];
  private relicIdCounter: number = 0;
  private nextRelicTimer: number = 0.65;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('duat');
      } else if (e.key === '2') {
        this.setTheme('karnak');
      } else if (e.key === '3') {
        this.setTheme('cyber_anubis');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: AnubisThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.stations.clear();
    this.relics = [];
    this.callouts = [];
    this.nextRelicTimer = 0.5;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const colWidth = (width - 140) / count;
    const groundY = height * 0.72;

    active.forEach((p, idx) => {
      const cx = 70 + idx * colWidth + colWidth * 0.5;
      this.stations.set(p.id, {
        id: p.id,
        x: cx,
        y: groundY,
        vx: 0,
        patrolDir: idx % 2 === 0 ? 1 : -1,
        anchorX: cx,
        currentWeight: 25,
        targetWeight: 75,
        tiltAngle: -0.25,
        score: 0,
        combo: 0,
        charge: 0,
        charging: false,
        judgmentAnim: 0,
        lockoutTimer: 0,
        shuntCooldown: 0,
        heartsWeighed: 0,
        shuntsLanded: 0,
        botReactionTimer: 0.15,
        botTargetX: cx,
        botReleaseThreshold: 0.82,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnRelic(width);
    }
  }

  private spawnRelic(width: number): void {
    const roll = Math.random();
    let kind: FallingRelic['kind'] = 'lapis';
    let weight = 15;
    let color = '#38bdf8';
    let label = '+15';

    if (roll < 0.14) {
      kind = 'feather';
      weight = 0;
      color = '#2dd4bf';
      label = 'MAAT';
    } else if (roll < 0.30) {
      kind = 'sin';
      weight = 35;
      color = '#ef4444';
      label = '+35 SIN';
    } else if (roll < 0.56) {
      kind = 'ankh';
      weight = 30;
      color = '#facc15';
      label = '+30';
    } else if (roll < 0.80) {
      kind = 'jar';
      weight = 20;
      color = '#f8fafc';
      label = '+20';
    }

    this.relics.push({
      id: ++this.relicIdCounter,
      x: 90 + Math.random() * (width - 180),
      y: 88,
      vy: 125 + Math.random() * 45,
      weight,
      kind,
      color,
      label,
      collected: false,
    });
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.stations.forEach((st) => {
      if (st.score > best) best = st.score;
    });
    return best;
  }

  private isUnderdog(st: ScalesStation): boolean {
    return this.getLeaderScore() - st.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.22, '⚖️ ANUBIS FINAL JUDGMENT (2X SCORE)! ⚖️', '#facc15');
    }

    const hallLeft = 80;
    const hallRight = width - 80;
    const groundY = height * 0.72;
    const scoreMult = suddenDeath ? 2 : 1;

    // Spawn falling soul offerings across the shared hall
    this.nextRelicTimer -= dt * (suddenDeath ? 1.35 : 1.0);
    if (this.nextRelicTimer <= 0 && this.relics.length < 8) {
      this.spawnRelic(width);
      this.nextRelicTimer = 0.75 + Math.random() * 0.35;
    }

    this.updateBots(dt, width, height);

    // Update Stations / Scribes
    this.stations.forEach((st) => {
      st.y = groundY;
      if (st.lockoutTimer > 0) st.lockoutTimer = Math.max(0, st.lockoutTimer - dt);
      if (st.shuntCooldown > 0) st.shuntCooldown = Math.max(0, st.shuntCooldown - dt);
      if (st.judgmentAnim > 0) st.judgmentAnim = Math.max(0, st.judgmentAnim - dt * 3.0);

      const weightDiff = st.currentWeight - st.targetWeight;
      const desiredTilt = Math.max(-0.45, Math.min(0.45, (weightDiff / st.targetWeight) * 0.45));
      st.tiltAngle += (desiredTilt - st.tiltAngle) * dt * 5;

      const p = this.getPlayer(st.id);
      const underdog = this.isUnderdog(st);
      const moveSpeed = underdog ? 255 : 220;

      if (p && !p.type.startsWith('bot_') && st.lockoutTimer <= 0) {
        const steer = this.input.getSteer(st.id);
        const holdAction = this.input.isActionPressed(st.id) || this.input.isPressed(st.id);

        if (Math.abs(steer) > 0.1) {
          st.vx += steer * moveSpeed * 5.4 * dt;
          st.patrolDir = steer >= 0 ? 1 : -1;
        } else {
          st.vx += st.patrolDir * 85 * dt;
          if (st.x > hallRight - 40) st.patrolDir = -1;
          if (st.x < hallLeft + 40) st.patrolDir = 1;
        }

        if (holdAction) {
          st.charging = true;
          st.charge = Math.min(1.0, st.charge + dt * 1.1);
          if (st.charge >= 1.0) {
            st.charging = false;
            st.charge = 0;
          }
        } else if (st.charging) {
          const released = st.charge;
          st.charging = false;
          st.charge = 0;
          // Note: both human & bot can trigger Ma'at Judgment at any time by releasing Action!
          this.executeMaatJudgment(st, released, scoreMult);
        }
      }

      st.vx *= Math.pow(0.06, dt);
      st.x += st.vx * dt;
      if (st.x < hallLeft) {
        st.x = hallLeft;
        st.vx = Math.abs(st.vx) * 0.4;
        st.patrolDir = 1;
      } else if (st.x > hallRight) {
        st.x = hallRight;
        st.vx = -Math.abs(st.vx) * 0.4;
        st.patrolDir = -1;
      }
    });

    // Elastic Player-to-Player Collisions
    const list = Array.from(this.stations.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        if (Math.abs(dx) < 38) {
          const dir = dx >= 0 ? 1 : -1;
          const overlap = 38 - Math.abs(dx);
          a.x -= dir * overlap * 0.5;
          b.x += dir * overlap * 0.5;
          const vRel = b.vx - a.vx;
          if (vRel * dir < 0) {
            const imp = -vRel * 0.85 + 60;
            a.vx -= dir * imp;
            b.vx += dir * imp;
            this.audio.playBounce();
            this.particles.spawnSparks((a.x + b.x) * 0.5, groundY - 22, '#facc15', 8);
          }
        }
      }
    }

    // Update Falling Relics
    for (let i = this.relics.length - 1; i >= 0; i--) {
      const r = this.relics[i];
      r.y += r.vy * dt;

      for (const st of list) {
        if (!r.collected && st.lockoutTimer <= 0 && Math.hypot(r.x - st.x, r.y - (st.y - 24)) < 38) {
          r.collected = true;
          this.applyOfferingToScale(st, r, scoreMult);
          break;
        }
      }

      if (r.collected || r.y > groundY + 14) {
        this.relics.splice(i, 1);
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private applyOfferingToScale(
    st: ScalesStation,
    r: FallingRelic,
    scoreMult: number
  ): void {
    if (r.kind === 'feather') {
      // Feather of Ma'at instantly aligns weight to targetWeight and awards Pure Heart Judgment!
      st.currentWeight = st.targetWeight;
      this.judgeScales(st, true, scoreMult);
      return;
    }

    if (r.kind === 'sin' && this.isUnderdog(st)) {
      this.audio.playBounce();
      this.spawnCallout(st.x, st.y - 52, 'SURGE ARMOR!', '#38bdf8');
      return;
    }

    st.currentWeight += r.weight;
    this.audio.playCoin();
    this.particles.spawnSparks(st.anchorX + 38, st.y - 115, r.color, 10);

    // Auto-judge if within ±10 wt of equilibrium!
    if (Math.abs(st.currentWeight - st.targetWeight) <= 10) {
      this.judgeScales(st, false, scoreMult);
    } else if (st.currentWeight > st.targetWeight + 22) {
      // Scale Overloaded!
      st.score = Math.max(0, st.score - 20);
      st.combo = 0;
      st.lockoutTimer = 0.65;
      st.currentWeight = 15;
      this.audio.playStun();
      this.particles.spawnExplosion(st.anchorX, st.y - 120, '#ef4444', 16);
      this.spawnCallout(st.x, st.y - 54, '-20 AMMIT OVERLOAD!', '#ef4444');
    } else {
      const pts = 12 * scoreMult;
      st.score += pts;
      this.spawnCallout(st.x, st.y - 48, `${r.label} (+${pts})`, r.color);
    }
  }

  private judgeScales(st: ScalesStation, isSweetSpot: boolean, scoreMult: number): void {
    const diff = Math.abs(st.currentWeight - st.targetWeight);
    const tolerance = isSweetSpot ? 26 : 15;
    if (diff <= tolerance) {
      st.heartsWeighed++;
      st.combo++;
      const baseBonus = diff <= 5 ? 65 : 42;
      const pts = Math.round(
        (baseBonus + Math.min(35, st.combo * 5)) * (isSweetSpot ? 1.55 : 1.0) * scoreMult
      );
      st.score += pts;
      st.judgmentAnim = 1.0;
      this.audio.playScore();
      this.particles.spawnConfetti(st.anchorX, st.y - 130, 18);
      this.spawnCallout(
        st.x,
        st.y - 62,
        isSweetSpot ? `⚖️ MA'AT PURE HEART! +${pts}` : `⚖️ BALANCED! +${pts}`,
        '#facc15'
      );
      st.currentWeight = 15 + Math.floor(Math.random() * 3) * 10;
      st.targetWeight = 70 + Math.floor(Math.random() * 4) * 15;
    } else {
      // If not close enough to targetWeight yet, holding & releasing in the sweet spot nudges weight +15 closer to targetWeight!
      if (isSweetSpot) {
        const step = Math.min(20, Math.abs(st.targetWeight - st.currentWeight));
        st.currentWeight += Math.sign(st.targetWeight - st.currentWeight) * step;
        const pts = 25 * scoreMult;
        st.score += pts;
        this.audio.playCoin();
        this.spawnCallout(st.x, st.y - 56, `🪶 FEATHER ALIGN +${pts}`, '#2dd4bf');
        if (Math.abs(st.currentWeight - st.targetWeight) <= 10) {
          this.judgeScales(st, true, scoreMult);
        }
      }
    }
  }

  private executeMaatJudgment(st: ScalesStation, chargeLevel: number, scoreMult: number): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    st.judgmentAnim = 1.0;

    if (isSweetSpot) {
      this.screenShake = Math.min(12, this.screenShake + 6);
      this.audio.playExplosion();
    } else {
      this.audio.playTap();
    }

    this.judgeScales(st, isSweetSpot, scoreMult);

    // Sweet-Spot Ammit Soul-Tip Shunt against nearby rivals!
    if (isSweetSpot) {
      this.stations.forEach((other) => {
        if (other.id === st.id || other.shuntCooldown > 0) return;
        const dx = other.x - st.x;
        if (Math.abs(dx) <= 110) {
          const dir = dx >= 0 ? 1 : -1;
          other.vx += dir * 280;
          other.currentWeight += 20; // Drops a Sin weight onto rival's scale!
          other.shuntCooldown = 1.2;
          const pts = 65 * scoreMult;
          st.score += pts;
          st.shuntsLanded++;
          this.audio.playStun();
          this.particles.spawnExplosion(other.x, other.y - 24, '#facc15', 14);
          this.spawnCallout(other.x, other.y - 64, `🐊 SCALE TIP SHUNT! +${pts}`, '#facc15');
        }
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.lockoutTimer > 0) return;

    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    st.botReactionTimer -= dt;
    if (st.botReactionTimer <= 0) {
      st.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.40;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      const needed = st.targetWeight - st.currentWeight;

      // If already within ±22 of targetWeight, charge Ma'at Judgment!
      if (Math.abs(needed) <= 22 && !st.charging && Math.random() > blunder) {
        st.charging = true;
        st.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
      }

      // Find best falling relic that fits needed weight (and avoid 'sin' stones!)
      let bestRelic: FallingRelic | null = null;
      let bestScore = -Infinity;
      for (const r of this.relics) {
        if (r.collected) continue;
        if (r.kind === 'sin' && Math.random() > blunder) continue;
        const fitBonus =
          r.kind === 'feather'
            ? 140
            : Math.abs(needed - r.weight) <= 15
            ? 110
            : r.weight <= needed + 10
            ? 65
            : -90;
        const score = fitBonus + r.y * 0.25 - Math.abs(r.x - st.x) * 0.35;
        if (score > bestScore) {
          bestScore = score;
          bestRelic = r;
        }
      }

      if (bestRelic && bestScore > 0) {
        st.botTargetX = bestRelic.x;
      } else {
        st.botTargetX = st.anchorX + Math.sin(this.animTime * 2 + Number(botId)) * 45;
      }
    }

    const dx = st.botTargetX - st.x;
    if (Math.abs(dx) > 10) {
      const moveSpeed = this.isUnderdog(st) ? 245 : 210;
      st.vx += Math.sign(dx) * moveSpeed * 4.8 * dt;
    }

    if (st.charging) {
      st.charge = Math.min(1.0, st.charge + dt * 1.1);
      if (st.charge >= st.botReleaseThreshold) {
        const released = st.charge;
        st.charging = false;
        st.charge = 0;
        this.executeMaatJudgment(st, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const groundY = height * 0.72;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Hall of Two Truths Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.skyTop);
    bgGrad.addColorStop(0.6, theme.skyMid);
    bgGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Hieroglyphic Gold Temple Columns
    ctx.fillStyle = 'rgba(250, 204, 21, 0.08)';
    for (let x = 55; x < width - 40; x += 120) {
      ctx.fillRect(x - 12, 95, 24, groundY - 95);
      ctx.fillRect(x - 18, 88, 36, 8);
    }

    // 2. Temple Floor
    const floorGrad = ctx.createLinearGradient(0, groundY, 0, height);
    floorGrad.addColorStop(0, theme.floorTop);
    floorGrad.addColorStop(1, theme.floorBot);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // 3. Overhead 2.5D Golden Scales of Anubis for each Player
    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#facc15';
      const sx = st.anchorX;
      const sy = 152;

      ctx.save();
      ctx.translate(sx, sy);

      // Pillar & Fulcrum
      ctx.fillStyle = theme.scaleGold;
      ctx.fillRect(-3, -24, 6, 62);
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();

      // Tilting Scale Beam
      ctx.save();
      ctx.rotate(st.tiltAngle);
      ctx.fillStyle = theme.scaleGold;
      ctx.fillRect(-46, -3, 92, 6);

      // Left Pan: Feather of Ma'at (Target Weight)
      ctx.strokeStyle = theme.scaleGold;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(-42, 28);
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(-42, 30, 15, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = theme.featherColor;
      ctx.beginPath();
      ctx.ellipse(-42, 21, 4, 10, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Right Pan: Soul Offerings (Current Weight)
      ctx.beginPath();
      ctx.moveTo(42, 0);
      ctx.lineTo(42, 28);
      ctx.stroke();
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.ellipse(42, 30, 15, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      const gems = Math.min(5, Math.ceil(st.currentWeight / 20));
      ctx.fillStyle = color;
      for (let i = 0; i < gems; i++) {
        ctx.beginPath();
        ctx.arc(42 + (i % 2 === 0 ? -4 : 4), 25 - i * 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Scale Readout Badge
      const balanced = Math.abs(st.currentWeight - st.targetWeight) <= 15;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(-48, 42, 96, 22, 8);
      ctx.fill();
      ctx.strokeStyle = balanced ? '#4ade80' : color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = balanced ? '#4ade80' : '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚖️ ${st.currentWeight} / ${st.targetWeight} wt`, 0, 57);
      ctx.restore();
    });

    // 4. Render Falling Soul Offerings
    this.relics.forEach((r) => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(r.label, 0, -16);
      ctx.restore();
    });

    // 5. Render 2.5D Scribe Mascots on the Hall Floor
    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const isSweetSpot = st.charge >= 0.72 && st.charge <= 0.98;

      ctx.save();
      ctx.translate(st.x, st.y);

      if (st.judgmentAnim > 0) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${st.judgmentAnim})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -22, (1 - st.judgmentAnim) * 90 + 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 4, 20, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -22,
        19,
        st.lockoutTimer > 0 ? 'shocked' : st.judgmentAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Ma'at Feather Gauge (72%–98% Sweet Spot)
      if (st.charging && st.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -56, bw + 2, 7);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -55, bw * 0.26, 5);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -55, bw * st.charge, 5);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}`, 0, 20);
      ctx.restore();
    });

    // 6. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 7. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '⚖️ STEER: CATCH OFFERINGS • HOLD & RELEASE (72–98%): MAAT JUDGMENT & SCALE SHUNT!',
      width / 2,
      74
    );

    // 8. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const st = this.stations.get(p.id);
      if (!st) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(st.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`⚖️${st.heartsWeighed} 🐊${st.shuntsLanded}`, cardX + 150, cardY + 37);
    });

    // 9. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, Math.floor(st.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: Math.floor(st.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} weighed a pure heart before Anubis with ${rankings[0].score} pts!`
        : 'All souls were devoured by Ammit!',
    };
  }
}
