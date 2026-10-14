import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type PulsarTheme = 'crab_nebula' | 'arecibo_array' | 'cyber_quasar';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  bgBottom: string;
  pulsarCore: string;
  beamPrimary: string;
  beamSecondary: string;
  trackRing: string;
  accent: string;
}

const THEMES: Record<PulsarTheme, ThemePalette> = {
  crab_nebula: {
    name: 'Crab Nebula VLA',
    bgTop: '#040814',
    bgMid: '#111c38',
    bgBottom: '#05070f',
    pulsarCore: '#38bdf8',
    beamPrimary: 'rgba(250, 204, 21, 0.35)',
    beamSecondary: 'rgba(56, 189, 248, 0.30)',
    trackRing: '#334155',
    accent: '#38bdf8',
  },
  arecibo_array: {
    name: 'SETI Dish Array',
    bgTop: '#02100c',
    bgMid: '#072a20',
    bgBottom: '#020a08',
    pulsarCore: '#10b981',
    beamPrimary: 'rgba(16, 185, 129, 0.35)',
    beamSecondary: 'rgba(250, 204, 21, 0.30)',
    trackRing: '#1e3a2f',
    accent: '#10b981',
  },
  cyber_quasar: {
    name: 'Subspace Quasar',
    bgTop: '#0d0417',
    bgMid: '#270e40',
    bgBottom: '#08020f',
    pulsarCore: '#ec4899',
    beamPrimary: 'rgba(236, 72, 153, 0.35)',
    beamSecondary: 'rgba(0, 229, 255, 0.30)',
    trackRing: '#4c1d95',
    accent: '#ec4899',
  },
};

const THEME_ORDER: PulsarTheme[] = ['crab_nebula', 'arecibo_array', 'cyber_quasar'];

interface CosmicPacket {
  id: number;
  angle: number;
  value: number;
  life: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface DishCrawler {
  id: PlayerId;
  angle: number;
  omega: number;
  orbitDir: number;
  score: number;
  combo: number;
  signalsDecoded: number;
  staggerTimer: number;
  lockAnim: number;
  lockCooldown: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botReleaseTarget: number;
}

export class PulsarSignalGame extends BaseGame {
  public stations: Map<PlayerId, DishCrawler> = new Map();
  public currentMapName: string = 'Crab Nebula VLA';
  private theme: PulsarTheme = 'crab_nebula';
  private animTime: number = 0;
  private pulsarAngle: number = 0;
  private pulsarSpinSpeed: number = 1.45;
  private pulsarDir: number = 1;
  private packetIdCounter: number = 0;
  private packets: CosmicPacket[] = [];
  private packetSpawnTimer: number = 1.6;
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

  private screenShake: number = 0;

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  private normalizeAngle(a: number): number {
    return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  }

  private shortestAngleDiff(from: number, to: number): number {
    let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  private getCrawlerCoords(angle: number, width: number, height: number): { x: number; y: number; r: number } {
    const cx = width * 0.5;
    const cy = height * 0.52;
    const r = Math.min(width * 0.28, height * 0.30, 175);
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      r,
    };
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.currentMapName = THEMES[this.theme].name;
    this.reset(width, height);
  }

  public reset(_width: number, _height: number): void {
    this.isFinished = false;
    this.roundTimer = 40.0;
    this.animTime = 0;
    this.pulsarAngle = 0;
    this.pulsarSpinSpeed = 1.45;
    this.pulsarDir = 1;
    this.suddenDeathAlerted = false;
    this.stations.clear();
    this.packets = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);

    active.forEach((p, idx) => {
      const startAngle = this.normalizeAngle((idx / count) * Math.PI * 2);
      this.stations.set(p.id, {
        id: p.id,
        angle: startAngle,
        omega: 0,
        orbitDir: idx % 2 === 0 ? 1 : -1,
        score: 0,
        combo: 0,
        signalsDecoded: 0,
        staggerTimer: 0,
        lockAnim: 0,
        lockCooldown: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
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
      this.theme = 'crab_nebula';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '2') {
      this.theme = 'arecibo_array';
      this.currentMapName = THEMES[this.theme].name;
    } else if (e.key === '3') {
      this.theme = 'cyber_quasar';
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
        y: 102,
        text: '📡 MILLISECOND MAGNETAR BURST! 2X SIGNAL POINTS! 📡',
        color: '#facc15',
        alpha: 1.5,
        vy: -20,
      });
    }

    // Rotate central twin-beam Neutron Star Pulsar
    const spinMult = isSuddenDeath ? 1.45 : 1.0;
    this.pulsarAngle = this.normalizeAngle(this.pulsarAngle + this.pulsarDir * this.pulsarSpinSpeed * spinMult * clampedDt);

    // Underdog Check
    let maxScore = 0;
    this.stations.forEach((st) => {
      if (st.score > maxScore) maxScore = st.score;
    });
    this.stations.forEach((st) => {
      st.isUnderdog = maxScore - st.score >= 150;
    });

    // Spawn Cosmic Data Packets on the VLA ring
    this.packetSpawnTimer -= clampedDt;
    if (this.packetSpawnTimer <= 0 && this.packets.length < 4) {
      this.packetSpawnTimer = isSuddenDeath ? 1.3 : 2.1;
      this.packets.push({
        id: ++this.packetIdCounter,
        angle: Math.random() * Math.PI * 2,
        value: isSuddenDeath ? 70 : 45,
        life: 8.5,
      });
    }

    for (let i = this.packets.length - 1; i >= 0; i--) {
      const pk = this.packets[i];
      pk.life -= clampedDt;
      if (pk.life <= 0) {
        this.packets.splice(i, 1);
      }
    }

    this.updateBots(clampedDt, width, height);

    // Update Dish Crawlers
    this.stations.forEach((st) => {
      const p = this.getPlayer(st.id);
      if (st.staggerTimer > 0) st.staggerTimer = Math.max(0, st.staggerTimer - clampedDt);
      if (st.lockAnim > 0) st.lockAnim = Math.max(0, st.lockAnim - clampedDt * 2.5);
      if (st.lockCooldown > 0) st.lockCooldown = Math.max(0, st.lockCooldown - clampedDt);
      if (st.overchargeLockout > 0) st.overchargeLockout = Math.max(0, st.overchargeLockout - clampedDt);

      const pos = this.getCrawlerCoords(st.angle, width, height);

      if (p && !p.type.startsWith('bot_')) {
        const move = { x: this.input.getSteer(st.id), y: -this.input.getThrottle(st.id) };
        const holding = this.input.isActionPressed(st.id) || this.input.isPressed(st.id);
        const justPressed = this.input.justPressed(st.id) || this.input.justAction(st.id);
        const released = this.input.justReleased(st.id);

        if (st.staggerTimer <= 0) {
          if (Math.abs(move.x) > 0.1 || Math.abs(move.y) > 0.1) {
            if (Math.abs(move.x) > 0.2 && Math.abs(move.y) < 0.2) {
              const signY = Math.sin(st.angle) >= 0 ? -1 : 1;
              st.omega += move.x * signY * 8.5 * clampedDt;
            } else {
              const desiredA = Math.atan2(move.y, move.x);
              const diff = this.shortestAngleDiff(st.angle, desiredA);
              st.omega += Math.sign(diff) * Math.min(Math.abs(diff) * 6, 9.2) * clampedDt;
            }
          } else if (holding) {
            st.omega += st.orbitDir * 4.8 * clampedDt;
          }

          if (justPressed) {
            if (this.animTime - st.lastTapTime < 0.26) {
              st.orbitDir *= -1;
            }
            st.lastTapTime = this.animTime;
            if (st.overchargeLockout <= 0) {
              st.charging = true;
              st.charge = 0;
            }
          }

          if (holding && st.charging && st.overchargeLockout <= 0) {
            st.charge += clampedDt * 0.95;
            if (st.charge >= 1.0) {
              st.charging = false;
              st.charge = 0;
              st.overchargeLockout = 0.95;
              this.audio.playStun();
              this.particles.spawnExplosion(pos.x, pos.y, '#ef4444', 12);
              this.floatingTexts.push({
                x: pos.x,
                y: pos.y - 26,
                text: 'MASER OVERLOAD!',
                color: '#ef4444',
                alpha: 1,
                vy: -30,
              });
            }
          }

          if (released && st.charging) {
            const c = st.charge;
            st.charging = false;
            st.charge = 0;
            this.tuneFrequency(st, c >= 0.72 && c <= 0.98, width, height);
          }
        } else {
          st.charging = false;
          st.charge = 0;
        }
      }

      const maxOmega = st.isUnderdog ? 4.2 : 3.5;
      st.omega = Math.max(-maxOmega, Math.min(maxOmega, st.omega));
      st.angle = this.normalizeAngle(st.angle + st.omega * clampedDt);
      st.omega *= Math.pow(0.06, clampedDt);

      // Collect Cosmic Data Packets on ring
      for (let i = this.packets.length - 1; i >= 0; i--) {
        const pk = this.packets[i];
        if (Math.abs(this.shortestAngleDiff(st.angle, pk.angle)) < 0.24) {
          st.score += pk.value;
          this.audio.playCoin();
          this.particles.spawnSparks(pos.x, pos.y, '#facc15', 14);
          this.floatingTexts.push({
            x: pos.x,
            y: pos.y - 24,
            text: `+${pk.value} DATA PACKET!`,
            color: '#facc15',
            alpha: 1,
            vy: -34,
          });
          this.packets.splice(i, 1);
        }
      }
    });

    // Elastic Dish Crawler Collisions on VLA Track
    const stArr = Array.from(this.stations.values());
    for (let i = 0; i < stArr.length; i++) {
      for (let j = i + 1; j < stArr.length; j++) {
        const a = stArr[i];
        const b = stArr[j];
        const diff = this.shortestAngleDiff(a.angle, b.angle);
        const minAng = 0.26;
        if (Math.abs(diff) < minAng) {
          const push = (minAng - Math.abs(diff)) * 0.52;
          const sign = diff >= 0 ? 1 : -1;
          a.angle = this.normalizeAngle(a.angle - sign * push);
          b.angle = this.normalizeAngle(b.angle + sign * push);

          const temp = a.omega;
          a.omega = (b.omega * 0.85 - sign * 2.2) * (a.isUnderdog ? 1.35 : 1.05);
          b.omega = (temp * 0.85 + sign * 2.2) * (b.isUnderdog ? 1.35 : 1.05);

          const posA = this.getCrawlerCoords(a.angle, width, height);
          const posB = this.getCrawlerCoords(b.angle, width, height);
          this.particles.spawnSparks((posA.x + posB.x) * 0.5, (posA.y + posB.y) * 0.5, '#38bdf8', 10);
          this.audio.playBounce();
        }
      }
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.9;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private getBeamAlignmentDiff(crawlerAngle: number): { diff: number; isPrimary: boolean } {
    const diff1 = Math.abs(this.shortestAngleDiff(crawlerAngle, this.pulsarAngle));
    const secondaryBeam = this.normalizeAngle(this.pulsarAngle + Math.PI);
    const diff2 = Math.abs(this.shortestAngleDiff(crawlerAngle, secondaryBeam));
    if (diff1 <= diff2) {
      return { diff: diff1, isPrimary: true };
    }
    return { diff: diff2, isPrimary: false };
  }

  private tuneFrequency(st: DishCrawler, isSweetSpot: boolean, width: number, height: number): void {
    if (st.lockCooldown > 0) return;
    const pos = this.getCrawlerCoords(st.angle, width, height);
    const { diff, isPrimary } = this.getBeamAlignmentDiff(st.angle);
    const tolerance = isSweetSpot ? 0.58 : 0.38;
    const isSuddenDeath = this.roundTimer <= 12.0;
    const sdMult = isSuddenDeath ? 2 : 1;

    if (diff <= tolerance) {
      st.lockAnim = 1.0;
      st.lockCooldown = 0.38;
      st.combo = Math.min(6, st.combo + 1);
      st.signalsDecoded++;
      const basePts = isPrimary ? 55 : 45;
      const mult = isSweetSpot ? 1.65 : 1.0;
      const pts = Math.round((basePts + st.combo * 10) * mult * sdMult);
      st.score += pts;

      // Shift pulsar phase slightly to keep players chasing the beam!
      this.pulsarAngle = this.normalizeAngle(this.pulsarAngle + this.pulsarDir * 0.55);
      if (st.signalsDecoded % 3 === 0) {
        this.pulsarDir *= -1;
      }

      this.audio.playScore();
      this.triggerScreenShake(isSweetSpot ? 6 : 3);
      this.particles.spawnExplosion(pos.x, pos.y, isSweetSpot ? '#facc15' : '#38bdf8', 20);
      this.floatingTexts.push({
        x: pos.x,
        y: pos.y - 26,
        text: isSweetSpot ? `📡 QUASAR OVERCLOCK! +${pts}` : `SIGNAL LOCK +${pts} (${st.combo}x)`,
        color: isSweetSpot ? '#facc15' : '#38bdf8',
        alpha: 1.2,
        vy: -38,
      });

      if (isSweetSpot) {
        // EMP Dish-Jammer Shunt against nearby rival dishes!
        this.stations.forEach((other) => {
          if (other.id === st.id) return;
          const odiff = this.shortestAngleDiff(st.angle, other.angle);
          if (Math.abs(odiff) < 0.85) {
            const sign = odiff >= 0 ? 1 : -1;
            other.omega += sign * (st.isUnderdog ? 6.5 : 5.0);
            other.staggerTimer = Math.max(other.staggerTimer, 0.65);
            st.score += 70;
            const opos = this.getCrawlerCoords(other.angle, width, height);
            this.particles.spawnExplosion(opos.x, opos.y, '#f43f5e', 18);
            this.floatingTexts.push({
              x: opos.x,
              y: opos.y - 30,
              text: 'SIGNAL JAM SHUNT! +70',
              color: '#f43f5e',
              alpha: 1.2,
              vy: -42,
            });
          }
        });
      }
    } else {
      // Missed beam cone — static feedback!
      st.staggerTimer = 0.45;
      st.combo = 0;
      st.score = Math.max(0, st.score - 12);
      this.audio.playStun();
      this.particles.spawnSparks(pos.x, pos.y, '#94a3b8', 10);
      this.floatingTexts.push({
        x: pos.x,
        y: pos.y - 22,
        text: 'STATIC MISS! -12',
        color: '#94a3b8',
        alpha: 1,
        vy: -28,
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const st = this.stations.get(botId);
    if (!st || st.staggerTimer > 0 || st.overchargeLockout > 0) return;

    // Steer toward closest pulsar beam or data packet
    const diff1 = this.shortestAngleDiff(st.angle, this.pulsarAngle);
    const diff2 = this.shortestAngleDiff(st.angle, this.normalizeAngle(this.pulsarAngle + Math.PI));
    const targetBeamDiff = Math.abs(diff1) <= Math.abs(diff2) ? diff1 : diff2;

    const steerRate = difficulty === 'bot_hard' ? 7.8 : difficulty === 'bot_normal' ? 6.0 : 4.2;
    if (Math.abs(targetBeamDiff) > 0.08) {
      st.omega += Math.sign(targetBeamDiff) * steerRate * dt;
    }

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer <= 0) {
      timer =
        difficulty === 'bot_easy'
          ? 0.4 + Math.random() * 0.06
          : difficulty === 'bot_normal'
            ? 0.23 + Math.random() * 0.04
            : 0.1 + Math.random() * 0.03;

      const { diff } = this.getBeamAlignmentDiff(st.angle);
      const blunder = difficulty === 'bot_easy' ? 0.21 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      if (diff < 0.36 && st.lockCooldown <= 0 && Math.random() >= blunder) {
        if (!st.charging && difficulty === 'bot_hard' && Math.random() < 0.65) {
          st.charging = true;
          st.charge = 0;
          st.botReleaseTarget = 0.78 + Math.random() * 0.15;
        } else if (!st.charging) {
          this.tuneFrequency(st, false, width, height);
        }
      }
    }
    this.botReactionTimers.set(botId, timer);

    if (st.charging) {
      st.charge += dt * 0.95;
      if (st.charge >= st.botReleaseTarget) {
        const c = st.charge;
        st.charging = false;
        st.charge = 0;
        this.tuneFrequency(st, c >= 0.72 && c <= 0.98, width, height);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.stations.forEach((st, pId) => scores.set(pId, st.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.stations.entries())
      .map(([playerId, st]) => ({ playerId, score: st.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${this.getPlayer(winnerId)?.name ?? winnerId} decoded the pulsar lighthouse signals!`
        : 'All radio dishes lost lock in cosmic static!',
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    const cx = width * 0.5;
    const cy = height * 0.52;
    const ringR = Math.min(width * 0.28, height * 0.30, 175);

    // 1. Deep Cosmos Nebula Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(width, height) * 0.7);
    bgGrad.addColorStop(0, pal.bgMid);
    bgGrad.addColorStop(0.55, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Twin Sweeping Lighthouse Pulsar Cones from Central Neutron Star
    ctx.save();
    ctx.translate(cx, cy);

    // Primary Golden Beam Cone
    ctx.fillStyle = pal.beamPrimary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ringR + 36, this.pulsarAngle - 0.34, this.pulsarAngle + 0.34);
    ctx.closePath();
    ctx.fill();

    // Secondary Cyan Harmonic Beam Cone (180 degrees opposite)
    const secAngle = this.pulsarAngle + Math.PI;
    ctx.fillStyle = pal.beamSecondary;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, ringR + 36, secAngle - 0.30, secAngle + 0.30);
    ctx.closePath();
    ctx.fill();

    // Expanding Radio Wavefront Rings
    for (let w = 0; w < 3; w++) {
      const wr = ((this.animTime * 90 + w * 65) % (ringR + 20));
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, wr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Central 2.5D Magnetar Neutron Star Core
    ctx.fillStyle = pal.pulsarCore;
    ctx.shadowColor = pal.pulsarCore;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, 22 + Math.sin(this.animTime * 16) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Shared Circular VLA Dish Track
    ctx.strokeStyle = pal.trackRing;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // 4. Render Cosmic Data Packets on the Ring
    for (const pk of this.packets) {
      const px = cx + Math.cos(pk.angle) * ringR;
      const py = cy + Math.sin(pk.angle) * ringR;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.animTime * 4);
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render 2.5D Mobile VLA Dish Crawlers & Mascot Engineers
    this.stations.forEach((st, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const pos = this.getCrawlerCoords(st.angle, width, height);
      const { diff } = this.getBeamAlignmentDiff(st.angle);
      const inBeam = diff <= 0.38;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      if (st.staggerTimer > 0) {
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }

      if (inBeam || st.lockAnim > 0) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 26 + st.lockAnim * 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Parabolic Radio Dish oriented inward toward the Central Pulsar
      const inwardAngle = Math.atan2(cy - pos.y, cx - pos.x);
      ctx.save();
      ctx.rotate(inwardAngle);
      ctx.strokeStyle = inBeam ? '#facc15' : '#e2e8f0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(10, 0, 16, Math.PI * 0.65, Math.PI * 1.35);
      ctx.stroke();
      // Receiver Feed Horn
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.restore();

      // Mascot Astro-Engineer on Crawler Deck
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        0,
        15,
        st.staggerTimer > 0 ? 'shocked' : st.lockAnim > 0.2 ? 'triumph' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Maser Amplifier Bar (72%–98% Sweet Spot)
      if (st.charging && st.charge > 0.04) {
        const bw = 42;
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(-bw / 2 - 1, -32, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -31, bw * 0.26, 4);
        const isSweet = st.charge >= 0.72 && st.charge <= 0.98;
        ctx.fillStyle = isSweet ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -31, bw * Math.min(1, st.charge), 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId} (${st.combo}x)`, 0, 28);

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
      '📡 ORBIT PULSAR RING • TAP IN BEAM TO LOCK SIGNAL • HOLD (72–98%): QUASAR JAM SHUNT!',
      width * 0.5,
      73
    );

    // 8. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const st = this.stations.get(p.id);
      if (!st) return;
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
      ctx.fillText(`${p.name}: ${st.score}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(`Signals: ${st.signalsDecoded} • ${st.combo}x Lock`, cardX + 10, cardY + 28);
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
