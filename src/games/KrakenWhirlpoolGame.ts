import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type KrakenThemeId = 'maelstrom' | 'caribbean' | 'cyber_sea';

interface KrakenTheme {
  name: string;
  seaOuter: string;
  seaMid: string;
  seaEye: string;
  foamColor: string;
  krakenBody: string;
  krakenSucker: string;
  accent: string;
}

const THEMES: Record<KrakenThemeId, KrakenTheme> = {
  maelstrom: {
    name: 'Abyssal Kraken Maelstrom',
    seaOuter: '#041224',
    seaMid: '#0b2d48',
    seaEye: '#020710',
    foamColor: 'rgba(56, 189, 248, 0.28)',
    krakenBody: '#0d9488',
    krakenSucker: '#a855f7',
    accent: '#2dd4bf',
  },
  caribbean: {
    name: 'Cursed Galleon Lagoon',
    seaOuter: '#06343b',
    seaMid: '#0e606b',
    seaEye: '#03181c',
    foamColor: 'rgba(250, 204, 21, 0.26)',
    krakenBody: '#be123c',
    krakenSucker: '#facc15',
    accent: '#fbbf24',
  },
  cyber_sea: {
    name: 'Neon Leviathan Grid',
    seaOuter: '#090418',
    seaMid: '#1e1040',
    seaEye: '#04010a',
    foamColor: 'rgba(232, 121, 249, 0.30)',
    krakenBody: '#6366f1',
    krakenSucker: '#22d3ee',
    accent: '#e879f9',
  },
};

const THEME_ORDER: KrakenThemeId[] = ['maelstrom', 'caribbean', 'cyber_sea'];

interface Tentacle {
  id: number;
  angle: number;
  dist: number;
  warningTimer: number;
  slamTimer: number;
  active: boolean;
  hasHit: Set<PlayerId>;
}

interface Treasure {
  id: number;
  angle: number;
  dist: number;
  type: 'chest' | 'barrel' | 'pearl';
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

export interface SailorShip {
  id: PlayerId;
  angle: number;
  dist: number;
  radialVel: number;
  angularSpeed: number;
  direction: 1 | -1;
  score: number;
  combo: number;
  charge: number;
  charging: boolean;
  broadsideAnim: number;
  stunTimer: number;
  shuntCooldown: number;
  chestsCollected: number;
  tentaclesSevered: number;
  botReactionTimer: number;
  botTargetDist: number;
  botReleaseThreshold: number;
}

function normalizeAngle(a: number): number {
  const twoPi = Math.PI * 2;
  return ((a % twoPi) + twoPi) % twoPi;
}

function shortestAngleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

export class KrakenWhirlpoolGame extends BaseGame {
  public ships: Map<PlayerId, SailorShip> = new Map();
  public tentacles: Tentacle[] = [];
  public treasures: Treasure[] = [];
  public currentMapName: string = 'Abyssal Kraken Maelstrom';

  private themeId: KrakenThemeId = 'maelstrom';
  private callouts: Callout[] = [];
  private tentacleIdCounter: number = 0;
  private treasureIdCounter: number = 0;
  private nextTentacleSpawn: number = 1.4;
  private nextTreasureSpawn: number = 1.1;
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
        this.setTheme('maelstrom');
      } else if (e.key === '2') {
        this.setTheme('caribbean');
      } else if (e.key === '3') {
        this.setTheme('cyber_sea');
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

  private setTheme(id: KrakenThemeId): void {
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
    this.ships.clear();
    this.tentacles = [];
    this.treasures = [];
    this.callouts = [];
    this.nextTentacleSpawn = 1.2;
    this.nextTreasureSpawn = 0.9;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const maxRadius = Math.min(width, height) * 0.42;

    active.forEach((p, idx) => {
      const startAngle = normalizeAngle((idx / count) * Math.PI * 2);
      const startDist = 135 + (idx % 2) * 35;
      this.ships.set(p.id, {
        id: p.id,
        angle: startAngle,
        dist: Math.min(maxRadius - 20, startDist),
        radialVel: 0,
        angularSpeed: 1.75,
        direction: 1,
        score: 0,
        combo: 0,
        charge: 0,
        charging: false,
        broadsideAnim: 0,
        stunTimer: 0,
        shuntCooldown: 0,
        chestsCollected: 0,
        tentaclesSevered: 0,
        botReactionTimer: 0.14,
        botTargetDist: startDist,
        botReleaseThreshold: 0.82,
      });
    });

    // Seed initial floating treasures around the vortex
    for (let i = 0; i < 5; i++) {
      this.treasures.push({
        id: ++this.treasureIdCounter,
        angle: normalizeAngle((i / 5) * Math.PI * 2 + 0.3),
        dist: 85 + (i % 3) * 42,
        type: i % 2 === 0 ? 'chest' : 'barrel',
        collected: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.ships.forEach((s) => {
      if (s.score > best) best = s.score;
    });
    return best;
  }

  private isUnderdog(s: SailorShip): boolean {
    return this.getLeaderScore() - s.score >= 110;
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
      this.spawnCallout(width * 0.5, height * 0.2, '🐙 KRAKEN FURY MAELSTROM (2X SCORE)! 🐙', '#facc15');
    }

    const cx = width / 2;
    const cy = height / 2 + 12;
    const maxRadius = Math.min(width, height) * 0.42;
    const scoreMult = suddenDeath ? 2 : 1;

    // Tentacle spawning
    this.nextTentacleSpawn -= dt * (suddenDeath ? 1.4 : 1.0);
    if (this.nextTentacleSpawn <= 0 && this.tentacles.length < 6) {
      const shipList = Array.from(this.ships.values());
      const refShip = shipList[Math.floor(Math.random() * Math.max(1, shipList.length))];
      const targetAngle = refShip
        ? normalizeAngle(refShip.angle + 0.55 + (Math.random() - 0.5) * 0.5)
        : Math.random() * Math.PI * 2;
      const targetDist = refShip
        ? Math.max(72, Math.min(maxRadius - 22, refShip.dist + (Math.random() - 0.5) * 50))
        : 80 + Math.random() * (maxRadius - 100);

      this.tentacles.push({
        id: ++this.tentacleIdCounter,
        angle: targetAngle,
        dist: targetDist,
        warningTimer: 0.95,
        slamTimer: 0.55,
        active: true,
        hasHit: new Set(),
      });
      this.nextTentacleSpawn = 1.35 + Math.random() * 0.75;
      this.audio.playWhoosh();
    }

    // Treasure spawning
    this.nextTreasureSpawn -= dt;
    if (this.nextTreasureSpawn <= 0 && this.treasures.length < 9) {
      this.treasures.push({
        id: ++this.treasureIdCounter,
        angle: Math.random() * Math.PI * 2,
        dist: 70 + Math.random() * (maxRadius - 82),
        type: Math.random() > 0.38 ? 'chest' : 'barrel',
        collected: false,
      });
      this.nextTreasureSpawn = 1.45;
    }

    // Slowly rotate floating treasures with the vortex current
    this.treasures.forEach((tr) => {
      tr.angle = normalizeAngle(tr.angle + 0.32 * dt);
    });

    // Update Tentacles
    for (let i = this.tentacles.length - 1; i >= 0; i--) {
      const ten = this.tentacles[i];
      if (ten.warningTimer > 0) {
        ten.warningTimer -= dt;
        if (ten.warningTimer <= 0) {
          const tx = cx + Math.cos(ten.angle) * ten.dist;
          const ty = cy + Math.sin(ten.angle) * ten.dist;
          this.particles.spawnExplosion(tx, ty, '#2dd4bf', 16);
          this.audio.playBounce();
          this.screenShake = Math.min(10, this.screenShake + 4);
        }
      } else if (ten.slamTimer > 0) {
        ten.slamTimer -= dt;
      } else {
        this.tentacles.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    // Update Ships
    this.ships.forEach((s) => {
      if (s.stunTimer > 0) s.stunTimer = Math.max(0, s.stunTimer - dt);
      if (s.shuntCooldown > 0) s.shuntCooldown = Math.max(0, s.shuntCooldown - dt);
      if (s.broadsideAnim > 0) s.broadsideAnim = Math.max(0, s.broadsideAnim - dt * 3.2);

      const p = this.getPlayer(s.id);
      const underdog = this.isUnderdog(s);

      if (p && !p.type.startsWith('bot_')) {
        const steer = this.input.getSteer(s.id);
        const throttle = this.input.getThrottle(s.id);
        const justTapped = this.input.justPressed(s.id);
        const holdAction = this.input.isActionPressed(s.id) || this.input.isPressed(s.id);

        if (justTapped && Math.abs(steer) < 0.1 && Math.abs(throttle) < 0.1) {
          s.direction = (s.direction === 1 ? -1 : 1) as 1 | -1;
          this.audio.playTap();
        }

        // Explicit radial tacking with steer/throttle or 1-button toggle
        const radialInput = Math.abs(throttle) > 0.1 ? throttle : Math.abs(steer) > 0.1 ? steer : s.direction * 0.78;
        s.radialVel += radialInput * (underdog ? 290 : 250) * dt;
        if (radialInput !== 0) s.direction = radialInput >= 0 ? 1 : -1;

        if (holdAction && s.stunTimer <= 0) {
          s.charging = true;
          s.charge = Math.min(1.0, s.charge + dt * 1.05);
          if (s.charge >= 1.0) {
            s.charging = false;
            s.charge = 0;
            s.stunTimer = 0.45;
            this.audio.playStun();
          }
        } else if (s.charging) {
          const released = s.charge;
          s.charging = false;
          s.charge = 0;
          this.executeHarpoonBroadside(s, released, cx, cy, scoreMult);
        }
      }

      // Angular orbit speed (faster closer to the vortex eye + underdog surge)
      const innerBoost = 1 + Math.max(0, (maxRadius - s.dist) / maxRadius) * 0.45;
      const targetAngular = (underdog ? 1.98 : 1.75) * innerBoost;
      s.angularSpeed += (targetAngular - s.angularSpeed) * Math.min(1, dt * 6);
      s.angle = normalizeAngle(s.angle + s.angularSpeed * dt);

      // Radial vortex suction vs ship rudder velocity
      const vortexPull = (suddenDeath ? 34 : 25) * dt;
      s.radialVel *= Math.pow(0.12, dt);
      s.dist += s.radialVel * dt - vortexPull;

      // Inner Kraken Maw hazard vs Outer Reef boundary
      if (s.dist < 54) {
        s.dist = 60;
        s.radialVel = 135;
        s.direction = 1;
        if (!underdog) {
          s.score = Math.max(0, s.score - 15);
          s.combo = 0;
          this.audio.playStun();
          const sx = cx + Math.cos(s.angle) * s.dist;
          const sy = cy + Math.sin(s.angle) * s.dist;
          this.spawnCallout(sx, sy - 24, '-15 KRAKEN MAW!', '#ef4444');
        }
      } else if (s.dist > maxRadius) {
        s.dist = maxRadius;
        s.radialVel = -90;
        s.direction = -1;
      }

      const sx = cx + Math.cos(s.angle) * s.dist;
      const sy = cy + Math.sin(s.angle) * s.dist;

      // Treasure collection (using shortestAngleDiff so wrap-around works 100% forever!)
      const magnetRadius = s.charging ? 46 : 34;
      this.treasures.forEach((tr) => {
        if (tr.collected) return;
        const tx = cx + Math.cos(tr.angle) * tr.dist;
        const ty = cy + Math.sin(tr.angle) * tr.dist;
        const distPx = Math.hypot(tx - sx, ty - sy);

        if (distPx < magnetRadius) {
          tr.collected = true;
          s.chestsCollected++;
          s.combo++;
          const basePts = tr.type === 'pearl' ? 80 : tr.type === 'chest' ? 42 : 22;
          const innerMult = s.dist < 115 ? 1.5 : 1.0;
          const pts = Math.round((basePts + Math.min(30, s.combo * 3)) * innerMult * scoreMult);
          s.score += pts;
          this.audio.playCoin();
          this.particles.spawnConfetti(tx, ty, 12);
          this.spawnCallout(
            tx,
            ty - 22,
            tr.type === 'pearl' ? `🔮 +${pts} PEARL!` : innerMult > 1 ? `💰 1.5x +${pts}` : `+${pts}`,
            tr.type === 'pearl' ? '#e879f9' : '#facc15'
          );
        }
      });

      // Tentacle slam collision (using exact pixel distance + shortestAngleDiff)
      this.tentacles.forEach((ten) => {
        if (ten.warningTimer <= 0 && ten.slamTimer > 0 && !ten.hasHit.has(s.id)) {
          const tx = cx + Math.cos(ten.angle) * ten.dist;
          const ty = cy + Math.sin(ten.angle) * ten.dist;
          if (Math.hypot(tx - sx, ty - sy) < 38) {
            ten.hasHit.add(s.id);
            if (!underdog) {
              s.score = Math.max(0, s.score - 25);
              s.combo = 0;
              s.radialVel -= 140;
              s.stunTimer = 0.45;
              this.audio.playStun();
              this.particles.spawnExplosion(sx, sy, '#ef4444', 14);
              this.spawnCallout(sx, sy - 28, '-25 TENTACLE SLAM!', '#ef4444');
            } else {
              this.audio.playBounce();
              this.spawnCallout(sx, sy - 28, 'SURGE HULL ARMOR!', '#38bdf8');
            }
          }
        }
      });
    });

    // Elastic Ship-to-Ship Broadside Ramming
    const shipList = Array.from(this.ships.values());
    for (let i = 0; i < shipList.length; i++) {
      for (let j = i + 1; j < shipList.length; j++) {
        const a = shipList[i];
        const b = shipList[j];
        const ax = cx + Math.cos(a.angle) * a.dist;
        const ay = cy + Math.sin(a.angle) * a.dist;
        const bx = cx + Math.cos(b.angle) * b.dist;
        const by = cy + Math.sin(b.angle) * b.dist;
        const d = Math.hypot(bx - ax, by - ay);
        if (d < 34) {
          const pushDir = b.dist >= a.dist ? 1 : -1;
          a.radialVel -= pushDir * 115;
          b.radialVel += pushDir * 115;
          a.dist = Math.max(58, a.dist - pushDir * 6);
          b.dist = Math.min(maxRadius, b.dist + pushDir * 6);
          this.audio.playBounce();
          this.particles.spawnSparks((ax + bx) * 0.5, (ay + by) * 0.5, '#f59e0b', 8);
        }
      }
    }

    this.treasures = this.treasures.filter((t) => !t.collected);

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private executeHarpoonBroadside(
    s: SailorShip,
    chargeLevel: number,
    cx: number,
    cy: number,
    scoreMult: number
  ): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    const sx = cx + Math.cos(s.angle) * s.dist;
    const sy = cy + Math.sin(s.angle) * s.dist;

    s.broadsideAnim = 1.0;
    s.angularSpeed += isSweetSpot ? 1.35 : 0.65;
    s.radialVel += s.direction * (isSweetSpot ? 155 : 85);

    if (isSweetSpot) {
      this.screenShake = Math.min(14, this.screenShake + 7);
      this.audio.playExplosion();
      this.particles.spawnExplosion(sx, sy, '#facc15', 18);
    } else {
      this.audio.playWhoosh();
      this.particles.spawnSparks(sx, sy, '#38bdf8', 10);
    }

    const blastRadius = isSweetSpot ? 118 : 72;

    // Sever nearby tentacles & spawn Golden Kraken Pearl!
    for (let i = this.tentacles.length - 1; i >= 0; i--) {
      const ten = this.tentacles[i];
      const tx = cx + Math.cos(ten.angle) * ten.dist;
      const ty = cy + Math.sin(ten.angle) * ten.dist;
      if (Math.hypot(tx - sx, ty - sy) <= blastRadius) {
        const pts = (isSweetSpot ? 95 : 50) * scoreMult;
        s.score += pts;
        s.combo++;
        s.tentaclesSevered++;
        this.audio.playScore();
        this.particles.spawnExplosion(tx, ty, '#a855f7', 18);
        this.spawnCallout(
          tx,
          ty - 26,
          isSweetSpot ? `🔱 KRAKEN BANE! +${pts}` : `🔱 SEVERED +${pts}`,
          '#facc15'
        );
        if (isSweetSpot) {
          this.treasures.push({
            id: ++this.treasureIdCounter,
            angle: ten.angle,
            dist: ten.dist,
            type: 'pearl',
            collected: false,
          });
        }
        this.tentacles.splice(i, 1);
      }
    }

    // Sweet-Spot Broadside Wake Shunt against rival ships & magnetic chest pull!
    if (isSweetSpot) {
      this.treasures.forEach((tr) => {
        if (tr.collected) return;
        const tx = cx + Math.cos(tr.angle) * tr.dist;
        const ty = cy + Math.sin(tr.angle) * tr.dist;
        if (Math.hypot(tx - sx, ty - sy) <= 105) {
          tr.angle = s.angle;
          tr.dist = s.dist;
        }
      });

      this.ships.forEach((other) => {
        if (other.id === s.id || other.shuntCooldown > 0) return;
        const ox = cx + Math.cos(other.angle) * other.dist;
        const oy = cy + Math.sin(other.angle) * other.dist;
        if (Math.hypot(ox - sx, oy - sy) <= 105) {
          other.radialVel -= 240; // Shunt rival inward toward Kraken Maw!
          other.stunTimer = 0.5;
          other.shuntCooldown = 1.2;
          const pts = 70 * scoreMult;
          s.score += pts;
          this.audio.playStun();
          this.particles.spawnExplosion(ox, oy, '#facc15', 14);
          this.spawnCallout(ox, oy - 30, `💥 BROADSIDE SHUNT! +${pts}`, '#facc15');
        }
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
    const s = this.ships.get(botId);
    if (!s || s.stunTimer > 0) return;

    const cx = width / 2;
    const cy = height / 2 + 12;
    const maxRadius = Math.min(width, height) * 0.42;
    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    s.botReactionTimer -= dt;
    if (s.botReactionTimer <= 0) {
      s.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.23 : 0.40;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Check upcoming tentacle along forward orbit arc
      const dangerTentacle = this.tentacles.find((t) => {
        const diff = shortestAngleDiff(t.angle, s.angle);
        return diff > -0.15 && diff < 0.75 && Math.abs(t.dist - s.dist) < 46;
      });

      if (dangerTentacle && Math.random() > blunder) {
        // Either charge Harpoon to sever it or tack away radially
        s.botTargetDist =
          dangerTentacle.dist > maxRadius * 0.58
            ? Math.max(80, dangerTentacle.dist - 62)
            : Math.min(maxRadius - 20, dangerTentacle.dist + 62);
        if (!s.charging && difficulty !== 'bot_easy') {
          s.charging = true;
          s.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
        }
      } else {
        // Find upcoming treasure in forward arc
        let bestTreasure: Treasure | null = null;
        let bestScore = -Infinity;
        for (const tr of this.treasures) {
          if (tr.collected) continue;
          const diff = shortestAngleDiff(tr.angle, s.angle);
          if (diff > -0.1 && diff < 1.35) {
            const val = tr.type === 'pearl' ? 120 : tr.type === 'chest' ? 70 : 35;
            const score = val - Math.abs(tr.dist - s.dist) * 0.45 - diff * 30;
            if (score > bestScore) {
              bestScore = score;
              bestTreasure = tr;
            }
          }
        }
        if (bestTreasure && Math.random() > blunder) {
          s.botTargetDist = bestTreasure.dist;
        } else {
          s.botTargetDist = 115 + Math.sin(this.animTime + Number(botId)) * 40;
        }
      }
    }

    const distErr = s.botTargetDist - s.dist;
    s.direction = distErr >= 0 ? 1 : -1;
    s.radialVel += s.direction * (this.isUnderdog(s) ? 260 : 225) * dt;

    if (s.charging) {
      s.charge = Math.min(1.0, s.charge + dt * 1.05);
      if (s.charge >= s.botReleaseThreshold) {
        const released = s.charge;
        s.charging = false;
        s.charge = 0;
        this.executeHarpoonBroadside(s, released, cx, cy, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const cx = width / 2;
    const cy = height / 2 + 12;
    const maxRadius = Math.min(width, height) * 0.42;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Stormy Maelstrom Ocean Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 24, cx, cy, maxRadius * 1.45);
    bgGrad.addColorStop(0, theme.seaEye);
    bgGrad.addColorStop(0.55, theme.seaMid);
    bgGrad.addColorStop(1, theme.seaOuter);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Swirling Whirlpool Foam Rings & 1.5x Inner Ring Indicator
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate(this.animTime * (1.2 - i * 0.14) + i);
      ctx.strokeStyle = theme.foamColor;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 58 + i * 34, 0, Math.PI * 1.35);
      ctx.stroke();
      ctx.restore();
    }

    // 1.5x Inner Whirlpool Bonus Ring
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 115, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Colossal 2.5D Kraken Boss Head in the Eye of the Vortex
    const pulse = Math.sin(this.animTime * 4) * 3;
    const krakenGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, 44 + pulse);
    krakenGrad.addColorStop(0, theme.accent);
    krakenGrad.addColorStop(0.6, theme.krakenBody);
    krakenGrad.addColorStop(1, '#020617');
    ctx.fillStyle = krakenGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 40 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Kraken Eyes & Snapping Beak
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.ellipse(-14, -6, 6, 4, -0.3, 0, Math.PI * 2);
    ctx.ellipse(14, -6, 6, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.arc(0, 10, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4. Floating Treasures (Barrels, Gold Chests & Kraken Pearls)
    this.treasures.forEach((tr) => {
      const tx = cx + Math.cos(tr.angle) * tr.dist;
      const ty = cy + Math.sin(tr.angle) * tr.dist;
      ctx.save();
      ctx.translate(tx, ty);
      if (tr.type === 'pearl') {
        const pGlow = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
        pGlow.addColorStop(0, '#ffffff');
        pGlow.addColorStop(0.5, '#e879f9');
        pGlow.addColorStop(1, 'rgba(232, 121, 249, 0)');
        ctx.fillStyle = pGlow;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5d0fe';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
      } else if (tr.type === 'chest') {
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-10, -8, 20, 16, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(-3, -3, 6, 6);
      } else {
        ctx.fillStyle = '#78350f';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    });

    // 5. Kraken Tentacles (Warning Reticles & 2.5D Sucker Tentacle Slams)
    this.tentacles.forEach((ten) => {
      const tx = cx + Math.cos(ten.angle) * ten.dist;
      const ty = cy + Math.sin(ten.angle) * ten.dist;

      if (ten.warningTimer > 0) {
        const ratio = 1 - ten.warningTimer / 0.95;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.45 + ratio * 0.5})`;
        ctx.fillStyle = `rgba(239, 68, 68, ${0.15 + ratio * 0.25})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30 * (1.2 - ratio * 0.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(ten.angle + Math.PI / 2);
        ctx.fillStyle = theme.krakenBody;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing Suckers
        ctx.fillStyle = theme.krakenSucker;
        for (let s = -18; s <= 18; s += 12) {
          ctx.beginPath();
          ctx.arc(-5, s, 3.5, 0, Math.PI * 2);
          ctx.arc(5, s, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    });

    // 6. Render 2.5D Longships with Mascot Captains
    this.ships.forEach((s, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#ef4444';
      const sx = cx + Math.cos(s.angle) * s.dist;
      const sy = cy + Math.sin(s.angle) * s.dist;
      const isSweetSpot = s.charge >= 0.72 && s.charge <= 0.98;

      ctx.save();
      ctx.translate(sx, sy);

      // Broadside Harpoon Shockwave Ring
      if (s.broadsideAnim > 0) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${s.broadsideAnim})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, (1 - s.broadsideAnim) * 95 + 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.save();
      ctx.rotate(s.angle + Math.PI / 2 + (s.direction === 1 ? 0.25 : -0.25));

      // Wake foam
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-7, 16);
      ctx.lineTo(-13, 28);
      ctx.moveTo(7, 16);
      ctx.lineTo(13, 28);
      ctx.stroke();

      // Timber Longship Hull
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.quadraticCurveTo(13, 0, 9, 18);
      ctx.lineTo(-9, 18);
      ctx.quadraticCurveTo(-13, 0, 0, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Billowing Team Sail
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.quadraticCurveTo(0, -14, 14, -4);
      ctx.lineTo(11, 5);
      ctx.quadraticCurveTo(0, -3, -11, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Captain Mascot at the Helm
      this.drawPlayerMascot(
        ctx,
        pId,
        0,
        -4,
        13,
        s.stunTimer > 0 ? 'shocked' : 'focused',
        this.animTime
      );

      // Hold-to-Charge Harpoon Broadside Bar (72%–98% Sweet Spot)
      if (s.charging && s.charge > 0.04) {
        const bw = 42;
        const bh = 6;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -34, bw + 2, bh + 2);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -33, bw * 0.26, bh);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -33, bw * s.charge, bh);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? pId}: ${Math.floor(s.score)}`, 0, 28);
      ctx.restore();
    });

    // 7. Callouts
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

    // 8. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🐙 STEER/TAP: TACK IN/OUT • HOLD ACTION: HARPOON BROADSIDE (72–98% SEVER TENTACLES!)',
      width / 2,
      74
    );

    // 9. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const s = this.ships.get(p.id);
      if (!s) return;
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
      ctx.fillText(`${Math.floor(s.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`💰${s.chestsCollected} 🔱${s.tentaclesSevered}`, cardX + 150, cardY + 37);
    });

    // 10. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
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
    this.ships.forEach((s, pId) => scores.set(pId, Math.floor(s.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.ships.entries())
      .map(([playerId, s]) => ({ playerId, score: Math.floor(s.score), place: 1 }))
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
        ? `${winnerCfg.name} conquered the Kraken Maelstrom with ${rankings[0].score} pts!`
        : 'All ships pulled to Davy Jones!',
    };
  }
}
